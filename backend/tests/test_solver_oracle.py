import random

import pytest

from pivonauta.branch_bound import solve_branch_bound
from pivonauta.domain import Constraint, LinearProgram, Variable
from pivonauta.simplex import solve_simplex


scipy = pytest.importorskip("scipy.optimize")


def problem(rng, integer):
    limits = [rng.randint(2, 8), rng.randint(2, 8)]
    weights = [rng.randint(1, 5), rng.randint(1, 5)]
    capacity = rng.uniform(1, sum(a * b for a, b in zip(limits, weights, strict=True)))
    costs = [rng.uniform(-5, 5), rng.uniform(-5, 5)]
    sense = rng.choice(("min", "max"))
    constraints = (
        Constraint((1.0, 0.0), "le", float(limits[0]), "u1"),
        Constraint((0.0, 1.0), "le", float(limits[1]), "u2"),
        Constraint(tuple(float(w) for w in weights), "le", capacity, "cap"),
    )
    variables = (Variable("x1", "integer" if integer else "continuous"),
                 Variable("x2", "integer" if integer else "continuous"))
    return LinearProgram("oracle", sense, tuple(costs), constraints, variables)


def matrices(model):
    multiplier = -1 if model.sense == "max" else 1
    costs = [multiplier * c for c in model.objective]
    coefficients = [list(c.coefficients) for c in model.constraints]
    bounds = [c.rhs for c in model.constraints]
    return multiplier, costs, coefficients, bounds


def test_simplex_against_scipy_highs_on_reproducible_random_cases():
    rng = random.Random(271828)
    for _ in range(45):
        model = problem(rng, False)
        factor, costs, coefficients, bounds = matrices(model)
        expected = scipy.linprog(costs, A_ub=coefficients, b_ub=bounds, bounds=(0, None),
                                 method="highs")
        assert expected.success, expected.message
        actual = solve_simplex(model, include_trace=False)
        assert actual.status == "optimal", actual.message
        assert actual.objective_value == pytest.approx(factor * expected.fun, abs=1e-6)


def test_branch_bound_against_scipy_milp_on_reproducible_random_cases():
    rng = random.Random(314159)
    for _ in range(25):
        model = problem(rng, True)
        factor, costs, coefficients, bounds = matrices(model)
        expected = scipy.milp(
            c=costs, integrality=[1, 1],
            bounds=scipy.Bounds([0, 0], [float("inf"), float("inf")]),
            constraints=scipy.LinearConstraint(coefficients, [-float("inf")] * 3, bounds),
        )
        assert expected.success, expected.message
        actual = solve_branch_bound(model, time_limit=10.0, max_nodes=1000)
        assert actual.status == "optimal", actual.message
        assert actual.objective_value == pytest.approx(factor * expected.fun, abs=1e-6)
