import pytest

import pivonauta.alternatives as alternative_module
from pivonauta.alternatives import analyze_optima
from pivonauta.branch_bound import solve_branch_bound
from pivonauta.domain import Constraint, LinearProgram, Variable, is_feasible


def radiotherapy():
    return LinearProgram(
        "Radioterapia", "min", (0.4, 0.5),
        (
            Constraint((0.3, 0.1), "le", 2.7, "r1"),
            Constraint((0.5, 0.5), "eq", 6.0, "r2"),
            Constraint((0.6, 0.4), "ge", 6.0, "r3"),
        ),
        (Variable("x1", "integer"), Variable("x2", "integer")),
    )


def test_partial_integer_tree_reports_safe_global_bound_and_gap():
    result = solve_branch_bound(radiotherapy(), max_nodes=2)
    assert result.status == "node_limit"
    assert result.best_bound == pytest.approx(5.25)
    assert result.objective_value == pytest.approx(5.3)
    assert result.best_bound <= result.objective_value
    assert result.optimality_gap == pytest.approx(0.05 / 5.3)
    assert result.message.startswith("Node limit")
    assert result.best_rounding_candidate is not None
    assert result.best_rounding_candidate["feasible"] is True
    assert result.best_rounding_candidate["objective_value"] == pytest.approx(5.3)


def test_search_interrupted_without_incumbent_does_not_invent_optimality():
    result = solve_branch_bound(radiotherapy(), max_nodes=1)
    assert result.status == "node_limit"
    assert result.objective_value is None
    assert result.best_bound == pytest.approx(5.25)
    assert result.optimality_gap is None
    assert result.best_rounding_candidate is not None


def test_integer_optimum_remains_certified_when_search_finishes():
    result = solve_branch_bound(radiotherapy())
    assert result.status == "optimal"
    assert result.objective_value == pytest.approx(5.3)
    assert result.best_bound == pytest.approx(5.3)
    assert result.optimality_gap == pytest.approx(0)
    assert result.best_rounding_candidate["objective_value"] == pytest.approx(5.3)


def test_arbitrary_integer_candidates_are_not_reported_as_optimal():
    model = LinearProgram(
        "fractional", "max", (1.0,), (Constraint((1.0,), "eq", 0.5, "r1"),),
        (Variable("x1", "integer"),),
    )
    result = solve_branch_bound(model)
    assert result.status == "infeasible"
    assert result.objective_value is None
    assert result.best_rounding_candidate is None


def test_alternative_basis_exploration_respects_remaining_deadline(monkeypatch):
    model = LinearProgram(
        "unique", "max", (1.0,),
        (Constraint((1.0,), "le", 5.0, "r1"),), (Variable("x1"),),
    )
    calls = iter([100.0, 104.0])
    monkeypatch.setattr(alternative_module, "monotonic", lambda: next(calls))
    result = analyze_optima(model, time_limit=3.0)
    assert result.status == "undetermined"
    assert not result.certified
    assert "Time limit" in result.message


def test_public_integer_solution_is_feasible_for_original_constraints():
    model = radiotherapy()
    result = solve_branch_bound(model)
    assert result.variables is not None
    values = tuple(result.variables[v.id] for v in model.variables)
    assert is_feasible(model, values)
    assert all(float(value).is_integer() for value in values)
