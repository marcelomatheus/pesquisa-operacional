import random

import pytest

from pivonauta.branch_bound import solve_branch_bound
from pivonauta.domain import Constraint, LinearProgram, Variable, is_feasible, objective_value
from pivonauta.duality import solve_dual
from pivonauta.simplex import solve_simplex


def case(rng, integer=False):
    upper_x = rng.randint(2, 8)
    upper_y = rng.randint(2, 8)
    a = rng.randint(1, 5)
    b = rng.randint(1, 5)
    rhs = rng.randint(1, a * upper_x + b * upper_y)
    costs = (float(rng.randint(-4, 5)), float(rng.randint(-4, 5)))
    sense = rng.choice(("min", "max"))
    rows = (
        Constraint((1.0, 0.0), "le", float(upper_x), "upper_x"),
        Constraint((0.0, 1.0), "le", float(upper_y), "upper_y"),
        Constraint((float(a), float(b)), "le", float(rhs) + 0.25, "capacity"),
    )
    variables = (
        Variable("x1", "integer" if integer else "continuous"),
        Variable("x2", "integer" if integer else "continuous"),
    )
    return LinearProgram("generated", sense, costs, rows, variables)


def geometric_oracle(model):
    ux, uy = model.constraints[0].rhs, model.constraints[1].rhs
    cap = model.constraints[2].rhs
    a, b = model.constraints[2].coefficients
    points = [
        (0.0, 0.0), (ux, 0.0), (0.0, uy), (ux, uy),
        (min(ux, cap / a), 0.0),
        (0.0, min(uy, cap / b)),
        (ux, (cap - a * ux) / b),
        ((cap - b * uy) / a, uy),
    ]
    feasible = [point for point in points if is_feasible(model, point)]
    assert feasible
    values = [objective_value(model, point) for point in feasible]
    return max(values) if model.sense == "max" else min(values)


@pytest.mark.parametrize("seed", [13, 71, 2026])
def test_random_linear_programs_against_independent_vertex_enumeration(seed):
    rng = random.Random(seed)
    for _ in range(50):
        model = case(rng)
        solved = solve_simplex(model, include_trace=False)
        assert solved.status == "optimal", (model, solved.status)
        assert solved.objective_value == pytest.approx(geometric_oracle(model), abs=1e-7)
        values = tuple(solved.variables[var.id] for var in model.variables)
        assert is_feasible(model, values)


@pytest.mark.parametrize("seed", [18, 79])
def test_random_integer_programs_against_exhaustive_grid_search(seed):
    rng = random.Random(seed)
    for _ in range(25):
        model = case(rng, integer=True)
        ux, uy = int(model.constraints[0].rhs), int(model.constraints[1].rhs)
        possible = [
            objective_value(model, (float(x), float(y)))
            for x in range(ux + 1)
            for y in range(uy + 1)
            if is_feasible(model, (float(x), float(y)))
        ]
        expected = max(possible) if model.sense == "max" else min(possible)
        result = solve_branch_bound(model, max_nodes=1000, time_limit=10.0)
        assert result.status == "optimal", (model, result.status)
        assert result.objective_value == pytest.approx(expected, abs=1e-6)
        assert result.optimality_gap == pytest.approx(0.0)


def test_random_primal_dual_agreement_on_bounded_models():
    rng = random.Random(4103)
    for _ in range(30):
        model = case(rng)
        result = solve_dual(model, include_trace=False)
        assert result.status == "optimal", (model, result.status, result.message)
        assert result.complementary_slackness is True
        assert result.primal_objective == pytest.approx(geometric_oracle(model), abs=1e-6)
        assert result.dual_objective == pytest.approx(result.primal_objective, abs=1e-6)
