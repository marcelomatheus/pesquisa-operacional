from __future__ import annotations

from itertools import combinations
from math import ceil, floor, hypot, sqrt

from .domain import LinearProgram, is_feasible


def objective_contours(objective, polygon, viewport, segmenter, optimum=None, tolerance=1e-8):
    if len(objective) != 2 or max(abs(c) for c in objective) <= tolerance or not polygon:
        return []
    values = [sum(c * x for c, x in zip(objective, point, strict=True)) for point in polygon]
    low, high = min(values), max(values)
    if high - low <= tolerance * (1 + abs(high) + abs(low)):
        candidates = [high]
    else:
        candidates = [low + (high - low) * index / 5 for index in range(1, 5)]
        if optimum is not None and low - tolerance <= optimum <= high + tolerance:
            candidates.append(optimum)
    unique = []
    for value in sorted(candidates):
        if any(abs(value - other) <= tolerance * (1 + abs(value) + abs(other)) for other in unique):
            continue
        segment = segmenter({'coefficients': list(objective), 'rhs': value}, viewport, tolerance)
        if len(segment) == 2:
            unique.append(value)
    return [{'value': value, 'segment': segmenter(
        {'coefficients': list(objective), 'rhs': value}, viewport, tolerance),
        'optimal': optimum is not None and abs(value - optimum) <= tolerance * (1 + abs(optimum))}
        for value in unique]


def optimal_face(polygon, objective, optimum, tolerance=1e-8):
    if optimum is None or not polygon or max(abs(c) for c in objective) <= tolerance:
        return []
    matches = []
    for first, second in zip(polygon, polygon[1:] + polygon[:1]):
        v1 = sum(c * x for c, x in zip(objective, first, strict=True)) - optimum
        v2 = sum(c * x for c, x in zip(objective, second, strict=True)) - optimum
        scale = tolerance * (1 + abs(optimum) + abs(v1) + abs(v2))
        if abs(v1) <= scale:
            matches.append(tuple(first))
        if v1 * v2 < 0 and abs(v1 - v2) > tolerance:
            ratio = v1 / (v1 - v2)
            matches.append(tuple(a + ratio * (b - a) for a, b in zip(first, second, strict=True)))
    if len(matches) < 2:
        return []
    length, left, right = max(
        ((hypot(a[0] - b[0], a[1] - b[1]), a, b) for a, b in combinations(matches, 2)),
        key=lambda value: value[0])
    if length <= tolerance * (1 + hypot(*left) + hypot(*right)):
        return []
    return [list(left), list(right)]


def integer_lattice(model: LinearProgram, viewport: dict, max_points: int = 300,
                    force_all_integer: bool = False):
    if len(model.variables) != 2:
        return {'points': [], 'sampled': False, 'mode': 'unavailable', 'checked': 0}
    if not force_all_integer and any(v.domain != 'integer' for v in model.variables):
        return {'points': [], 'sampled': False, 'mode': 'mixed_or_continuous', 'checked': 0}
    x0, x1 = ceil(viewport['x_min']), floor(viewport['x_max'])
    y0, y1 = ceil(viewport['y_min']), floor(viewport['y_max'])
    size = max(0, x1 - x0 + 1) * max(0, y1 - y0 + 1)
    stride = max(1, ceil(sqrt(size / max_points))) if size else 1
    points = []
    checked = 0
    for x in range(x0, x1 + 1, stride):
        for y in range(y0, y1 + 1, stride):
            checked += 1
            if is_feasible(model, (float(x), float(y))):
                points.append([float(x), float(y)])
    return {'points': points, 'sampled': stride > 1,
            'mode': 'forced_all' if force_all_integer else 'declared_integer',
            'checked': checked, 'stride': stride}
