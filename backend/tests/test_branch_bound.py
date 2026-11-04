import pytest

from pivonauta.branch_bound import solve_branch_bound
from pivonauta.domain import Constraint, LinearProgram, Variable, is_feasible


def example(sense, objective, constraints, all_integer=True):
    return LinearProgram(
        "test", sense, tuple(objective),
        tuple(Constraint(tuple(c), op, rhs) for c, op, rhs in constraints),
        tuple(Variable(f"x{i+1}", "integer" if all_integer else "continuous")
              for i in range(len(objective))),
    )


def test_radiotherapy_integer_optimum():
    model = example("min", [.4, .5], [([.3, .1], "le", 2.7),
                                          ([.5, .5], "eq", 6), ([.6, .4], "ge", 6)])
    result = solve_branch_bound(model)
    assert result.status == "optimal"
    assert result.objective_value == pytest.approx(5.3)
    assert result.variables == {"x1": 7, "x2": 5}
    assert result.explored_nodes >= 3
    assert result.best_bound == pytest.approx(5.3)
    assert result.optimality_gap == 0
    assert is_feasible(model, (7, 5))
    assert any(not item["feasible"] for item in result.rounding_candidates)


def test_integer_optimum_with_fractional_root():
    model = example("max", [5, 4], [([6, 4], "le", 24), ([1, 2], "le", 6)])
    result = solve_branch_bound(model)
    assert result.status == "optimal"
    assert result.variables is not None
    assert all(float(v).is_integer() for v in result.variables.values())
    assert result.objective_value <= 24


def test_infeasible_integer_but_feasible_continuous():
    model = example("max", [1], [([1], "eq", .5)])
    result = solve_branch_bound(model)
    assert result.status == "infeasible"
    assert result.variables is None


def test_node_limit_never_claims_integer_optimal():
    model = example("min", [.4, .5], [([.3, .1], "le", 2.7),
                                          ([.5, .5], "eq", 6), ([.6, .4], "ge", 6)])
    result = solve_branch_bound(model, max_nodes=1)
    assert result.status == "node_limit"
    assert result.best_bound is None
    assert result.optimality_gap is None


def test_continuous_model_requires_explicit_integer_mode():
    model = example("max", [1], [([1], "le", 2.5)], all_integer=False)
    with pytest.raises(ValueError):
        solve_branch_bound(model)
    sol = solve_branch_bound(model, force_all_integer=True)
    assert sol.status == "optimal"
    assert sol.objective_value == pytest.approx(2)
