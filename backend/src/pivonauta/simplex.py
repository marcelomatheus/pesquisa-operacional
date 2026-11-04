"""Two-phase tableau Simplex, implemented using Python lists only.

Conventions: maximize internally; objective row has negative reduced costs, RHS
holds current objective. Bland's rule (smallest eligible column and basis-index
ratio tie-break) makes the pivot sequence deterministic, including degeneracy.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from time import monotonic

from .domain import LinearProgram, is_feasible, objective_value
from .tableau_trace import pivot_operations


@dataclass(slots=True)
class StandardForm:
    columns: list[str]
    rows: list[list[float]]
    right_hand_sides: list[float]
    basis: list[int]
    artificial: set[int]
    transformed_costs: list[float]
    reconstruction: list[tuple[float, list[tuple[int, float]]]]


@dataclass(slots=True)
class SimplexResult:
    status: str
    objective_value: float | None
    variables: dict[str, float] | None
    iterations: list[dict]
    pivot_count: int
    message: str

    def to_dict(self) -> dict:
        return asdict(self)


def standardize(model: LinearProgram, tolerance: float = 1e-9) -> StandardForm:
    """Transform bounded/free original variables into nonnegative columns."""
    columns: list[str] = []
    reconstruction: list[tuple[float, list[tuple[int, float]]]] = []
    costs: list[float] = []
    sign = 1 if model.sense == "max" else -1
    for var, cost in zip(model.variables, model.objective, strict=True):
        if var.lower_bound is None:
            pos = len(columns)
            columns.extend((f"{var.id}_pos", f"{var.id}_neg"))
            reconstruction.append((0.0, [(pos, 1.0), (pos + 1, -1.0)]))
            costs.extend((sign * cost, -sign * cost))
        else:
            pos = len(columns)
            columns.append(var.id)
            reconstruction.append((var.lower_bound, [(pos, 1.0)]))
            costs.append(sign * cost)

    n = len(columns)
    inequalities: list[tuple[list[float], str, float]] = []
    for con in model.constraints:
        coefficients = [0.0] * n
        offset = 0.0
        for coeff, (shift, parts) in zip(con.coefficients, reconstruction, strict=True):
            offset += coeff * shift
            for idx, factor in parts:
                coefficients[idx] += coeff * factor
        inequalities.append((coefficients, con.operator, con.rhs - offset))
    for var, (shift, parts) in zip(model.variables, reconstruction, strict=True):
        if var.upper_bound is not None:
            coefficients = [0.0] * n
            for idx, factor in parts:
                coefficients[idx] = factor
            inequalities.append((coefficients, "le", var.upper_bound - shift))

    rows: list[list[float]] = []
    rhs_values: list[float] = []
    basis: list[int] = []
    artificial: set[int] = set()

    def add_column(label: str) -> int:
        index = len(columns)
        columns.append(label)
        costs.append(0.0)
        for row in rows:
            row.append(0.0)
        return index

    for i, (coeff, relation, rhs) in enumerate(inequalities, start=1):
        current = list(coeff) + [0.0] * (len(columns) - len(coeff))
        if rhs < -tolerance:
            current = [-value for value in current]
            rhs = -rhs
            relation = {"le": "ge", "ge": "le", "eq": "eq"}[relation]
        elif abs(rhs) <= tolerance:
            rhs = 0.0
        rows.append(current)
        rhs_values.append(rhs)
        if relation == "le":
            idx = add_column(f"s{i}")
            rows[-1][idx] = 1.0
            basis.append(idx)
        else:
            if relation == "ge":
                idx = add_column(f"e{i}")
                rows[-1][idx] = -1.0
            idx = add_column(f"a{i}")
            rows[-1][idx] = 1.0
            basis.append(idx)
            artificial.add(idx)
    return StandardForm(columns, rows, rhs_values, basis, artificial, costs, reconstruction)


def _objective_row(tableau: list[list[float]], basis: list[int], costs: list[float],
                   tolerance: float) -> None:
    row = [-c for c in costs] + [0.0]
    for i, basic in enumerate(basis, start=1):
        factor = row[basic]
        if abs(factor) > tolerance:
            row = [x - factor * y for x, y in zip(row, tableau[i], strict=True)]
    tableau[0] = row


def _pivot(tableau: list[list[float]], basis: list[int], row: int, col: int,
           tolerance: float) -> None:
    pivot = tableau[row][col]
    if abs(pivot) <= tolerance:
        raise ArithmeticError("Cannot pivot on a near-zero element")
    tableau[row] = [value / pivot for value in tableau[row]]
    for i in range(len(tableau)):
        if i == row:
            continue
        factor = tableau[i][col]
        if abs(factor) > tolerance:
            tableau[i] = [x - factor * y for x, y in zip(tableau[i], tableau[row], strict=True)]
    basis[row - 1] = col


def solve_simplex(model: LinearProgram, *, max_iterations: int = 500,
                  time_limit: float = 3.0, tolerance: float = 1e-9,
                  include_trace: bool = True) -> SimplexResult:
    if max_iterations < 1 or time_limit <= 0 or tolerance <= 0:
        raise ValueError("Iteration limit, time limit and tolerance must be positive")
    started = monotonic()
    standard = standardize(model, tolerance)
    columns = standard.columns.copy()
    basis = standard.basis.copy()
    tableau = [[0.0] * (len(columns) + 1)] + [
        row.copy() + [rhs] for row, rhs in zip(standard.rows, standard.right_hand_sides, strict=True)
    ]
    trace: list[dict] = []
    pivots = 0

    def snapshot(phase: str, event: str, pivot: dict | None = None) -> None:
        if include_trace:
            trace.append({
                "phase": phase, "iteration": pivots, "event": event,
                "columns": [*columns, "rhs"],
                "basis": [columns[index] for index in basis],
                "matrix": [[0.0 if abs(v) < tolerance else v for v in row] for row in tableau],
                "pivot": pivot,
                "row_operations": pivot_operations(tableau, pivot["row"], pivot["column"], tolerance)
                if event == "pivot" and pivot and "row" in pivot and "column" in pivot else [],
                "reduced_costs": [{"column": columns[j], "value": -tableau[0][j]}
                                  for j in range(len(columns)) if j not in basis],
            })

    def run(phase: str, allowed: list[int]) -> str:
        nonlocal pivots
        while True:
            if monotonic() - started > time_limit:
                snapshot(phase, "time_limit")
                return "time_limit"
            basic_set = set(basis)
            entering = next((j for j in allowed if j not in basic_set and tableau[0][j] < -tolerance), None)
            if entering is None:
                snapshot(phase, "optimal")
                return "optimal"
            if pivots >= max_iterations:
                snapshot(phase, "iteration_limit")
                return "iteration_limit"
            ratios = []
            for i in range(1, len(tableau)):
                coeff = tableau[i][entering]
                if coeff > tolerance:
                    ratio = tableau[i][-1] / coeff
                    if ratio < -tolerance:
                        return "numerical_error"
                    ratios.append((max(0.0, ratio), basis[i - 1], i))
            if not ratios:
                snapshot(phase, "unbounded", {"entering": columns[entering]})
                return "unbounded"
            ratio, _, leaving_row = min(ratios)
            info = {
                "entering": columns[entering],
                "leaving": columns[basis[leaving_row - 1]],
                "row": leaving_row,
                "column": entering,
                "value": tableau[leaving_row][entering],
                "min_ratio": ratio,
                "ratio_test": [
                    {"row": row, "value": value}
                    for value, _basic, row in sorted(ratios, key=lambda a: a[2])
                ],
            }
            snapshot(phase, "pivot", info)
            _pivot(tableau, basis, leaving_row, entering, tolerance)
            pivots += 1

    if standard.artificial:
        phase_one = [-1.0 if i in standard.artificial else 0.0 for i in range(len(columns))]
        _objective_row(tableau, basis, phase_one, tolerance)
        result = run("phase_1", [i for i in range(len(columns)) if i not in standard.artificial])
        if result != "optimal":
            return SimplexResult("numerical_error" if result == "unbounded" else result,
                                 None, None, trace, pivots, f"Phase I stopped: {result}")
        if tableau[0][-1] < -tolerance * (1 + abs(tableau[0][-1])):
            return SimplexResult("infeasible", None, None, trace, pivots,
                                 "Phase I optimum is negative; no feasible basis exists")
        # Pivot zero-valued artificial basics out. All-zero rows are redundant.
        for row in range(len(basis), 0, -1):
            if basis[row - 1] not in standard.artificial:
                continue
            if abs(tableau[row][-1]) > tolerance:
                return SimplexResult("infeasible", None, None, trace, pivots,
                                     "Positive artificial basic variable")
            candidate = next((j for j in range(len(columns))
                              if j not in standard.artificial and j not in basis
                              and abs(tableau[row][j]) > tolerance), None)
            if candidate is None:
                snapshot("phase_1_cleanup", "remove_redundant_row")
                tableau.pop(row)
                basis.pop(row - 1)
            else:
                info = {"entering": columns[candidate], "leaving": columns[basis[row-1]],
                        "row": row, "column": candidate, "value": tableau[row][candidate]}
                snapshot("phase_1_cleanup", "pivot", info)
                _pivot(tableau, basis, row, candidate, tolerance)
                pivots += 1
        kept = [j for j in range(len(columns)) if j not in standard.artificial]
        index_map = {old: new for new, old in enumerate(kept)}
        tableau = [[row[j] for j in kept] + [row[-1]] for row in tableau]
        basis = [index_map[index] for index in basis]
        columns = [columns[index] for index in kept]
        phase_two_costs = [standard.transformed_costs[index] for index in kept]
    else:
        phase_two_costs = standard.transformed_costs
    _objective_row(tableau, basis, phase_two_costs, tolerance)
    result = run("phase_2", list(range(len(columns))))
    if result != "optimal":
        return SimplexResult(result, None, None, trace, pivots, f"Phase II stopped: {result}")
    y = [0.0] * len(columns)
    for i, basic in enumerate(basis, start=1):
        y[basic] = tableau[i][-1]
    original = tuple(shift + sum(factor * y[index] for index, factor in parts)
                     for shift, parts in standard.reconstruction)
    if not is_feasible(model, original, tol=max(tolerance * 100, 1e-7)):
        return SimplexResult("numerical_error", None, None, trace, pivots,
                             "Reconstructed solution violates original constraints")
    z = objective_value(model, original)
    return SimplexResult("optimal", z,
                         {variable.id: value for variable, value in zip(model.variables, original, strict=True)},
                         trace, pivots, "Optimal continuous solution certified by tableau")
