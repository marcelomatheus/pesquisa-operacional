"""Two-variable feasible-region geometry computed from LP constraints in pure Python.

The viewport polygon is an explicitly clipped display representation. It is
never passed off as the full feasible set when the region is unbounded.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from itertools import combinations
from math import atan2, hypot, isfinite

from .domain import InvalidModel, LinearProgram, Variable, is_feasible
from .geometry_overlays import integer_lattice, objective_contours, optimal_face
from .simplex import solve_simplex


@dataclass(slots=True)
class GeometryResult:
    status: str
    region_type: str
    bounded: bool | None
    dimension: int | None
    viewport: dict[str, float]
    polygon: list[list[float]]
    vertices: list[list[float]]
    lines: list[dict]
    optimal_point: list[float] | None
    optimal_value: float | None
    message: str
    level_lines: list[dict] | None = None
    optimal_face: list[list[float]] | None = None
    integer_lattice: dict | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def _boundaries(model: LinearProgram) -> list[dict]:
    lines: list[dict] = []
    for index, c in enumerate(model.constraints):
        lines.append({'id': c.id or f'r{index + 1}', 'coefficients': list(c.coefficients),
                      'operator': c.operator, 'rhs': c.rhs, 'origin': 'constraint'})
    for index, var in enumerate(model.variables):
        a = [1.0 if j == index else 0.0 for j in range(2)]
        if var.lower_bound is not None:
            lines.append({'id': f'lower_{var.id}', 'coefficients': a, 'operator': 'ge',
                          'rhs': var.lower_bound, 'origin': 'lower_bound'})
        if var.upper_bound is not None:
            lines.append({'id': f'upper_{var.id}', 'coefficients': a, 'operator': 'le',
                          'rhs': var.upper_bound, 'origin': 'upper_bound'})
    return lines


def _halfplanes(lines: list[dict]) -> list[tuple[float, float, float]]:
    result = []
    for line in lines:
        a, b = line['coefficients']
        rhs = line['rhs']
        if line['operator'] in ('le', 'eq'):
            result.append((a, b, rhs))
        if line['operator'] in ('ge', 'eq'):
            result.append((-a, -b, -rhs))
    return result


def _satisfies(point: tuple[float, float], planes: list[tuple[float, float, float]],
               tol: float) -> bool:
    return all(a * point[0] + b * point[1] <= rhs +
               tol * (1 + abs(rhs) + abs(a * point[0]) + abs(b * point[1]))
               for a, b, rhs in planes)


def _dedup(points: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    result = []
    for pt in points:
        if not any(hypot(pt[0] - p[0], pt[1] - p[1]) <=
                   tol * (1 + hypot(*pt) + hypot(*p)) for p in result):
            result.append(pt)
    return result


def _clip_polygon(polygon: list[tuple[float, float]], plane: tuple[float, float, float],
                  tol: float) -> list[tuple[float, float]]:
    if not polygon:
        return []
    a, b, rhs = plane
    output = []
    previous = polygon[-1]
    before = a * previous[0] + b * previous[1] - rhs
    for point in polygon:
        after = a * point[0] + b * point[1] - rhs
        previous_inside = before <= tol * (1 + abs(rhs))
        inside = after <= tol * (1 + abs(rhs))
        if inside != previous_inside:
            denom = before - after
            if abs(denom) > 1e-15:
                t = min(1.0, max(0.0, before / denom))
                output.append((previous[0] + t * (point[0] - previous[0]),
                               previous[1] + t * (point[1] - previous[1])))
        if inside:
            output.append(point)
        previous, before = point, after
    return _dedup(output, tol)


def _viewport_segment(line: dict, viewport: dict, tol: float) -> list[list[float]]:
    a, b = line['coefficients']
    rhs = line['rhs']
    candidates = []
    if abs(b) > tol:
        for x in (viewport['x_min'], viewport['x_max']):
            y = (rhs - a * x) / b
            if viewport['y_min'] - tol <= y <= viewport['y_max'] + tol:
                candidates.append((x, y))
    if abs(a) > tol:
        for y in (viewport['y_min'], viewport['y_max']):
            x = (rhs - b * y) / a
            if viewport['x_min'] - tol <= x <= viewport['x_max'] + tol:
                candidates.append((x, y))
    candidates = _dedup(candidates, tol)
    if len(candidates) < 2:
        return []
    pairs = [(hypot(p[0]-q[0], p[1]-q[1]), p, q) for p, q in combinations(candidates, 2)]
    _, start, end = max(pairs, key=lambda pair: pair[0])
    return [list(start), list(end)]


def _unbounded_recession(planes: list[tuple[float, float, float]], tol: float) -> bool:
    # Every nontrivial 2D polyhedral recession cone has an axis direction or
    # an extreme ray parallel to one of the constraint boundary lines.
    dirs = [(1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0)]
    for a, b, _ in planes:
        norm = hypot(a, b)
        if norm > tol:
            dirs.extend([(b/norm, -a/norm), (-b/norm, a/norm)])
    return any(all(a * dx + b * dy <= tol * (1 + abs(a) + abs(b))
                   for a, b, _ in planes) for dx, dy in dirs)


def _dimension(points: list[tuple[float, float]], tol: float) -> int | None:
    if not points:
        return None
    if len(points) == 1:
        return 0
    diameter = max(hypot(p[0]-q[0], p[1]-q[1]) for p, q in combinations(points, 2))
    if diameter <= tol * (1 + max(hypot(*p) for p in points)):
        return 0
    p0 = points[0]
    p1 = max(points[1:], key=lambda p: hypot(p[0]-p0[0], p[1]-p0[1]))
    direction = (p1[0]-p0[0], p1[1]-p0[1])
    for pt in points[1:]:
        cross = abs(direction[0]*(pt[1]-p0[1]) - direction[1]*(pt[0]-p0[0]))
        if cross > tol * (1 + diameter * diameter):
            return 2
    return 1


def build_geometry(model: LinearProgram, *, tolerance: float = 1e-8,
                   show_integer_lattice: bool = True,
                   force_all_integer: bool = False,
                   max_integer_points: int = 300) -> GeometryResult:
    if len(model.variables) != 2:
        raise InvalidModel('Geometric view supports exactly two decision variables')
    lines = _boundaries(model)
    planes = _halfplanes(lines)
    feasibility_model = LinearProgram(model.name, 'max', (0.0, 0.0), model.constraints,
                                      tuple(Variable(v.id, 'continuous', v.lower_bound, v.upper_bound)
                                            for v in model.variables))
    feasible = solve_simplex(feasibility_model, tolerance=tolerance, include_trace=False)
    zero_view = {'x_min': 0.0, 'x_max': 10.0, 'y_min': 0.0, 'y_max': 10.0}
    if feasible.status == 'infeasible':
        return GeometryResult('infeasible', 'empty', None, None, zero_view, [], [], [],
                              None, None, 'The feasible region is empty')
    if feasible.status != 'optimal' or feasible.variables is None:
        return GeometryResult('not_certified', 'unknown', None, None, zero_view, [], [], [],
                              None, None, f'Feasibility solve ended with {feasible.status}')
    intersections = []
    for left, right in combinations(lines, 2):
        a, b = left['coefficients']
        c, d = right['coefficients']
        det = a*d-b*c
        scale = max(1.0, abs(a*d), abs(b*c))
        if abs(det) <= tolerance * scale:
            continue
        x = (left['rhs']*d - b*right['rhs']) / det
        y = (a*right['rhs'] - left['rhs']*c) / det
        if isfinite(x) and isfinite(y) and _satisfies((x, y), planes, tolerance):
            intersections.append((x, y))
    vertices = _dedup(intersections, tolerance)
    if len(vertices) >= 3:
        cx = sum(p[0] for p in vertices)/len(vertices)
        cy = sum(p[1] for p in vertices)/len(vertices)
        vertices.sort(key=lambda p: atan2(p[1]-cy, p[0]-cx))
    point = tuple(feasible.variables[v.id] for v in model.variables)
    optimum = solve_simplex(feasibility_model if all(c == 0 for c in model.objective)
                            else model, tolerance=tolerance, include_trace=False)
    opt_pt = ([optimum.variables[v.id] for v in model.variables]
              if optimum.status == 'optimal' and optimum.variables else None)
    anchors = vertices + [point] + ([tuple(opt_pt)] if opt_pt else [])
    radius = max(5.0, *(abs(value) for pt in anchors for value in pt)) * 1.25
    radius = max(radius, 5.0)
    viewport = {
        'x_min': 0.0 if model.variables[0].lower_bound == 0 else -radius,
        'x_max': radius,
        'y_min': 0.0 if model.variables[1].lower_bound == 0 else -radius,
        'y_max': radius,
    }
    polygon = [(viewport['x_min'], viewport['y_min']),
               (viewport['x_max'], viewport['y_min']),
               (viewport['x_max'], viewport['y_max']),
               (viewport['x_min'], viewport['y_max'])]
    for plane in planes:
        polygon = _clip_polygon(polygon, plane, tolerance)
        if not polygon:
            break
    clip_dim = _dimension(polygon, tolerance)
    bounded = not _unbounded_recession(planes, tolerance)
    if bounded and not vertices and polygon:
        # Singleton affine intersections can be represented as polygon points.
        vertices = _dedup(polygon, tolerance)
    if clip_dim is None:
        return GeometryResult('not_certified', 'unknown', bounded, None, viewport, [],
                              [list(v) for v in vertices], [], opt_pt, optimum.objective_value,
                              'Feasible point exists but viewport clipping failed')
    region_type = 'unbounded' if not bounded else {0: 'point', 1: 'segment', 2: 'polygon'}[clip_dim]
    result_lines = [{**line, 'segment': _viewport_segment(line, viewport, tolerance)}
                    for line in lines]
    levels = objective_contours(model.objective, polygon, viewport, _viewport_segment,
                                optimum.objective_value if optimum.status == 'optimal' else None,
                                tolerance)
    face = optimal_face(polygon, model.objective,
                        optimum.objective_value if optimum.status == 'optimal' else None,
                        tolerance)
    lattice = (integer_lattice(model, viewport, max_integer_points, force_all_integer)
               if show_integer_lattice else None)
    return GeometryResult('feasible', region_type, bounded, clip_dim, viewport,
                          [list(p) for p in polygon], [list(p) for p in vertices],
                          result_lines, opt_pt, optimum.objective_value,
                          'Viewport polygon is clipped; boundedness is evaluated independently',
                          levels, face, lattice)
