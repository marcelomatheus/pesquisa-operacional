import math

import pytest

from pivonauta.domain import Constraint, InvalidModel, LinearProgram, Variable, is_feasible
from pivonauta.simplex import solve_simplex


def lp(sense, objective, constraints, variables=None):
    variables = variables or [Variable(f"x{i + 1}") for i in range(len(objective))]
    return LinearProgram(
        "test", sense, tuple(objective),
        tuple(Constraint(tuple(c), op, rhs, id=f"r{i}") for i, (c, op, rhs) in enumerate(constraints)),
        tuple(variables),
    )


@pytest.mark.parametrize("sense,c,cons,status,z,x", [
    ("max", [3, 5], [([1, 0], "le", 4), ([0, 2], "le", 12), ([3, 2], "le", 18)],
     "optimal", 36, (2, 6)),
    ("min", [.4, .5], [([.3, .1], "le", 2.7), ([.5, .5], "eq", 6), ([.6, .4], "ge", 6)],
     "optimal", 5.25, (7.5, 4.5)),
    ("min", [1], [([1], "ge", 2), ([1], "le", 4)], "optimal", 2, (2,)),
    ("max", [1], [([-1], "le", -2), ([1], "le", 4)], "optimal", 4, (4,)),
    ("max", [1], [([1], "le", 1), ([1], "ge", 2)], "infeasible", None, None),
    ("max", [1], [([1], "ge", 0)], "unbounded", None, None),
    ("max", [0, 0], [([1, 1], "eq", 0)], "optimal", 0, (0, 0)),
])
def test_regression_cases(sense, c, cons, status, z, x):
    model = lp(sense, c, cons)
    result = solve_simplex(model)
    assert result.status == status
    if z is not None:
        assert result.objective_value == pytest.approx(z)
        values = tuple(result.variables[f"x{i+1}"] for i in range(len(c)))
        assert values == pytest.approx(x)
        assert is_feasible(model, values)
        assert result.iterations[-1]["event"] == "optimal"
    else:
        assert result.objective_value is None


def test_optimal_alternatives_has_feasible_answer():
    model = lp("max", [1, 1], [([1, 1], "le", 4), ([1, 0], "le", 3), ([0, 1], "le", 3)])
    result = solve_simplex(model)
    assert result.status == "optimal"
    assert result.objective_value == pytest.approx(4)


def test_free_variable_can_be_negative():
    model = lp("max", [-1], [([1], "ge", -5), ([1], "le", 3)],
               variables=[Variable("x1", lower_bound=None)])
    sol = solve_simplex(model)
    assert sol.status == "optimal"
    assert sol.variables["x1"] == pytest.approx(-5)
    assert sol.objective_value == pytest.approx(5)


def test_variable_bounds_shift_and_cap():
    model = lp("max", [2], [], variables=[Variable("x1", lower_bound=3, upper_bound=7)])
    result = solve_simplex(model)
    assert result.status == "optimal"
    assert result.variables["x1"] == pytest.approx(7)
    assert result.objective_value == pytest.approx(14)


def test_simplex_trace_records_pivots():
    model = lp("max", [3, 5], [([1, 0], "le", 4), ([0, 2], "le", 12), ([3, 2], "le", 18)])
    result = solve_simplex(model)
    assert result.pivot_count > 0
    assert len([s for s in result.iterations if s["event"] == "pivot"]) == result.pivot_count
    assert all("matrix" in step and "basis" in step for step in result.iterations)
    for step in result.iterations:
        assert len(step["matrix"]) == len(step["basis"]) + 1
        assert all(len(row) == len(step["columns"]) for row in step["matrix"])


def test_iteration_limit_does_not_claim_optimality():
    model = lp("max", [3, 5], [([1, 0], "le", 4), ([0, 2], "le", 12), ([3, 2], "le", 18)])
    result = solve_simplex(model, max_iterations=1)
    assert result.status == "iteration_limit"
    assert result.objective_value is None


def test_exact_one_pivot_is_still_optimal():
    model = lp("max", [1], [([1], "le", 3)])
    result = solve_simplex(model, max_iterations=1)
    assert result.status == "optimal"
    assert result.objective_value == pytest.approx(3)


def test_invalid_constraint_dimension():
    with pytest.raises(InvalidModel):
        lp("max", [1, 1], [([1], "le", 3)])
