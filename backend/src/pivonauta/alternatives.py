"""Certify distinct optimal points by walking zero-reduced-cost optimal bases.

A zero reduced cost by itself does *not* prove different optima: degeneracy
and the positive/negative parts of free variables can change the basis without
changing the primal decision vector. We require a distinct feasible witness.
"""
from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass
from math import isfinite

from .domain import LinearProgram, is_feasible, objective_value
from .simplex import _pivot, solve_simplex, standardize


@dataclass(slots=True)
class AlternativeOptimaResult:
    status: str
    certified: bool
    objective_value: float | None
    reference: dict[str, float] | None
    alternative: dict[str, float] | None
    explored_bases: int
    zero_reduced_cost_columns: list[str]
    message: str

    def to_dict(self) -> dict:
        return asdict(self)


def analyze_optima(model: LinearProgram, *, max_bases: int = 200,
                   tolerance: float = 1e-8, max_iterations: int = 500,
                   time_limit: float = 3.0) -> AlternativeOptimaResult:
    if not 1 <= max_bases <= 1000:
        raise ValueError('max_bases must be between 1 and 1000')
    solved = solve_simplex(model, max_iterations=max_iterations, time_limit=time_limit,
                           tolerance=tolerance, include_trace=True)
    if solved.status != 'optimal' or solved.variables is None:
        return AlternativeOptimaResult('not_certified', False, None, None, None, 0, [],
                                       f'Simplex termination was {solved.status}')
    optimal = next((step for step in reversed(solved.iterations)
                    if step['phase'] == 'phase_2' and step['event'] == 'optimal'), None)
    if optimal is None:
        return AlternativeOptimaResult('not_certified', False, solved.objective_value,
                                       solved.variables, None, 0, [], 'Missing final optimal tableau')
    columns = optimal['columns'][:-1]
    current = [row[:] for row in optimal['matrix']]
    bases = [columns.index(name) for name in optimal['basis']]
    reconstruction = standardize(model, tolerance).reconstruction
    primal_original = tuple(solved.variables[var.id] for var in model.variables)
    scale = max(1.0, abs(solved.objective_value or 0))
    zero_initial = [name for i, name in enumerate(columns)
                    if i not in bases and abs(current[0][i]) <= tolerance * scale]

    def original_point(tableau: list[list[float]], basis: list[int], entering: int,
                       distance: float) -> tuple[float, ...]:
        values = [0.0] * len(columns)
        for row_idx, basic in enumerate(basis, 1):
            values[basic] = tableau[row_idx][-1] - tableau[row_idx][entering] * distance
        values[entering] = distance
        return tuple(shift + sum(factor * values[index] for index, factor in components)
                     for shift, components in reconstruction)

    queue = deque([(current, bases)])
    visited = set()
    while queue and len(visited) < max_bases:
        tableau, basis = queue.popleft()
        key = tuple(basis)
        if key in visited:
            continue
        visited.add(key)
        for entering in range(len(columns)):
            if entering in basis or abs(tableau[0][entering]) > tolerance * scale:
                continue
            ratios = [(max(0.0, tableau[i][-1] / tableau[i][entering]), basis[i-1], i)
                      for i in range(1, len(tableau)) if tableau[i][entering] > tolerance]
            distance = min((v[0] for v in ratios), default=float('inf'))
            if distance > tolerance:
                step = min(1.0, distance) if isfinite(distance) else 1.0
                candidate = original_point(tableau, basis, entering, step)
                different = any(abs(a - b) > 1e-6 * (1 + abs(a) + abs(b))
                                for a, b in zip(candidate, primal_original, strict=True))
                if (different and is_feasible(model, candidate, tol=1e-6)
                        and abs(objective_value(model, candidate) - solved.objective_value)
                        <= 1e-6 * (1 + abs(solved.objective_value))):
                    return AlternativeOptimaResult(
                        'multiple', True, solved.objective_value, solved.variables,
                        {var.id: candidate[i] for i, var in enumerate(model.variables)},
                        len(visited), zero_initial,
                        'Distinct feasible points with identical objective value were verified')
            # Degenerate pivots may be necessary before a distinct direction appears.
            if ratios:
                _, _, leaving_row = min(ratios)
                new_tableau = [row[:] for row in tableau]
                new_basis = basis[:]
                _pivot(new_tableau, new_basis, leaving_row, entering, tolerance)
                if tuple(new_basis) not in visited:
                    queue.append((new_tableau, new_basis))
    if queue:
        return AlternativeOptimaResult('undetermined', False, solved.objective_value,
                                       solved.variables, None, len(visited), zero_initial,
                                       'Maximum number of optimal bases reached')
    return AlternativeOptimaResult('unique', True, solved.objective_value,
                                   solved.variables, None, len(visited), zero_initial,
                                   'No distinct optimal decision point exists in explored optimal bases')
