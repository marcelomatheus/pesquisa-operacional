"""Hand-written Branch and Bound; every LP relaxation uses our own tableau Simplex."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from math import ceil, floor, isfinite
from time import monotonic

from .domain import Constraint, LinearProgram, is_feasible, objective_value
from .simplex import solve_simplex


@dataclass(slots=True)
class BranchNode:
    id: str
    parent_id: str | None
    depth: int
    branch_constraint: str | None
    status: str
    relaxation_status: str
    relaxation_objective: float | None
    relaxation_variables: dict[str, float] | None
    pivot_count: int
    children: list[str]


@dataclass(slots=True)
class BranchBoundResult:
    status: str
    objective_value: float | None
    variables: dict[str, float] | None
    explored_nodes: int
    nodes: list[BranchNode]
    best_bound: float | None
    optimality_gap: float | None
    rounding_candidates: list[dict]
    message: str

    def to_dict(self) -> dict:
        return asdict(self)


def _bound_is_worse(sense: str, bound: float, incumbent: float, tol: float) -> bool:
    return bound <= incumbent + tol if sense == "max" else bound >= incumbent - tol


def rounding_candidates(model: LinearProgram, continuous: dict[str, float],
                        max_candidates: int = 256, tol: float = 1e-7) -> list[dict]:
    """Try nearby floor/ceil combinations; none is presumed optimal."""
    values = [continuous[v.id] for v in model.variables]
    candidate_vectors: list[tuple[float, ...]] = [tuple(values)]
    for index, var in enumerate(model.variables):
        if var.domain != "integer":
            continue
        expanded: list[tuple[float, ...]] = []
        for candidate in candidate_vectors:
            for integer in sorted({floor(values[index]), ceil(values[index])}):
                modified = list(candidate)
                modified[index] = float(integer)
                expanded.append(tuple(modified))
                if len(expanded) >= max_candidates:
                    break
            if len(expanded) >= max_candidates:
                break
        candidate_vectors = expanded
    unique = list(dict.fromkeys(candidate_vectors))
    results: list[dict] = []
    for candidate in unique:
        feasible = is_feasible(model, candidate, tol)
        results.append({
            "values": {v.id: candidate[i] for i, v in enumerate(model.variables)},
            "feasible": feasible,
            "objective_value": objective_value(model, candidate) if feasible else None,
        })
    return results


def solve_branch_bound(model: LinearProgram, *, max_nodes: int = 200,
                       time_limit: float = 10.0, max_iterations: int = 500,
                       tolerance: float = 1e-7, force_all_integer: bool = False) -> BranchBoundResult:
    if not 1 <= max_nodes <= 10000 or time_limit <= 0:
        raise ValueError("Invalid node or time limit")
    if force_all_integer:
        model = model.with_integer_variables()
    integer_indices = [i for i, v in enumerate(model.variables) if v.domain == "integer"]
    if not integer_indices:
        raise ValueError("At least one integer variable is required")
    started = monotonic()
    pending: list[tuple[str, str | None, int, LinearProgram, str | None]] = [
        ("P0", None, 0, model, None)
    ]
    nodes: list[BranchNode] = []
    by_id: dict[str, BranchNode] = {}
    incumbent: tuple[float, ...] | None = None
    incumbent_z: float | None = None
    candidates: list[dict] = []
    termination: str | None = None
    while pending:
        if len(nodes) >= max_nodes:
            termination = "node_limit"
            break
        remaining = time_limit - (monotonic() - started)
        if remaining <= 0:
            termination = "time_limit"
            break
        node_id, parent, depth, local_model, branch_label = pending.pop()
        lp = solve_simplex(local_model, max_iterations=max_iterations,
                           time_limit=remaining, tolerance=1e-9,
                           include_trace=False)
        node = BranchNode(node_id, parent, depth, branch_label, "processing", lp.status,
                          lp.objective_value, lp.variables, lp.pivot_count, [])
        nodes.append(node)
        by_id[node_id] = node
        if parent is not None:
            by_id[parent].children.append(node_id)
        if lp.status == "infeasible":
            node.status = "infeasible"
            continue
        if lp.status == "unbounded":
            node.status = "relaxation_unbounded"
            termination = "unbounded_relaxation"
            break
        if lp.status != "optimal" or lp.variables is None or lp.objective_value is None:
            node.status = lp.status
            termination = lp.status
            break
        if node_id == "P0":
            candidates = rounding_candidates(model, lp.variables)
        z = lp.objective_value
        if incumbent_z is not None and _bound_is_worse(model.sense, z, incumbent_z, tolerance):
            node.status = "pruned_bound"
            continue
        vals = tuple(lp.variables[v.id] for v in model.variables)
        fractional = [(abs(vals[i] - round(vals[i])), i) for i in integer_indices
                      if abs(vals[i] - round(vals[i])) > tolerance]
        if not fractional:
            rounded = tuple(float(round(v)) if i in integer_indices else v
                            for i, v in enumerate(vals))
            if is_feasible(model, rounded, tol=tolerance):
                exact_z = objective_value(model, rounded)
                if incumbent_z is None or (exact_z > incumbent_z + tolerance if model.sense == "max"
                                           else exact_z < incumbent_z - tolerance):
                    incumbent, incumbent_z = rounded, exact_z
                node.status = "integer"
                continue
            # Close-to-integer numerics must not be mistaken for an integer certificate.
            node.status = "numerical_error"
            termination = "numerical_error"
            break
        _, branch_index = max(fractional, key=lambda item: (item[0], -item[1]))
        value = vals[branch_index]
        coefficients = tuple(1.0 if i == branch_index else 0.0
                             for i in range(len(model.objective)))
        left_rhs = floor(value)
        right_rhs = ceil(value)
        left = local_model.with_constraint(Constraint(coefficients, "le", float(left_rhs),
                                                       id=f"{node_id}_left"))
        right = local_model.with_constraint(Constraint(coefficients, "ge", float(right_rhs),
                                                        id=f"{node_id}_right"))
        node.status = "branched"
        var_name = model.variables[branch_index].id
        # LIFO DFS: left branch visited before right.
        pending.append((f"{node_id}.R", node_id, depth + 1, right,
                        f"{var_name} >= {right_rhs}"))
        pending.append((f"{node_id}.L", node_id, depth + 1, left,
                        f"{var_name} <= {left_rhs}"))

    status = termination or ("optimal" if incumbent is not None else "infeasible")
    # If the tree wasn't exhausted, a feasible incumbent is NOT proven optimal.
    message = {
        "optimal": "All nodes explored/pruned: integer optimum certified",
        "infeasible": "No feasible integer solution was found after exhaustive search",
        "node_limit": "Node limit reached; incumbent is not certified optimal",
        "time_limit": "Time limit reached; incumbent is not certified optimal",
        "unbounded_relaxation": "LP relaxation unbounded; integer optimality undetermined",
    }.get(status, "Branch and Bound stopped without an optimality certificate")
    return BranchBoundResult(
        status, incumbent_z,
        {var.id: incumbent[i] for i, var in enumerate(model.variables)} if incumbent else None,
        len(nodes), nodes,
        incumbent_z if status == "optimal" else None,
        0.0 if status == "optimal" else None,
        candidates, message,
    )
