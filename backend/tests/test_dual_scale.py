import pytest
from fastapi.testclient import TestClient

from pivonauta.domain import Constraint, InvalidModel, LinearProgram, Variable
from pivonauta.duality import solve_dual
from pivonauta.main import app


client = TestClient(app)


def many_rows_model(row_count: int, variable_count: int = 1, upper_bounds: bool = False):
    variables = tuple(
        Variable(f"x{i + 1}", upper_bound=1.0 if upper_bounds else None)
        for i in range(variable_count)
    )
    objective = (1.0,) + (0.0,) * (variable_count - 1)
    if upper_bounds:
        rows = tuple(
            Constraint(tuple(1.0 for _ in variables), "le", 100.0, f"r{i + 1}")
            for i in range(row_count)
        )
    else:
        rows = tuple(
            Constraint((1.0,), "le", float(5 + i), f"r{i + 1}")
            for i in range(row_count)
        )
    return LinearProgram("dual large", "max", objective, rows, variables)


@pytest.mark.parametrize("row_count", [11, 20, 30])
def test_dual_with_more_than_ten_constraints(row_count):
    original = many_rows_model(row_count)
    result = solve_dual(original, include_trace=False)
    assert result.status == "optimal", result.message
    assert len(result.dual_model["variables"]) == row_count
    assert result.primal_objective == pytest.approx(5.0)
    assert result.dual_objective == pytest.approx(5.0)
    assert result.complementary_slackness is True


def test_forty_dual_columns_from_thirty_constraints_and_ten_bounds():
    original = many_rows_model(30, variable_count=10, upper_bounds=True)
    result = solve_dual(original, include_trace=False)
    assert result.status == "optimal", result.message
    assert len(result.dual_model["variables"]) == 40
    assert len(result.dual_model["source_rows"]) == 40
    assert result.primal_objective == pytest.approx(1.0)
    assert result.dual_objective == pytest.approx(1.0)


def test_api_accepts_thirty_primal_rows_and_exposes_forty_dual_variables():
    model = many_rows_model(30, variable_count=10, upper_bounds=True)
    response = client.post("/api/v1/solves/dual", json={"model": {
        "name": model.name, "sense": model.sense, "objective": list(model.objective),
        "variables": [
            {"id": v.id, "domain": v.domain,
             "lower_bound": v.lower_bound, "upper_bound": v.upper_bound}
            for v in model.variables
        ],
        "constraints": [
            {"id": c.id, "coefficients": list(c.coefficients),
             "operator": c.operator, "rhs": c.rhs}
            for c in model.constraints
        ],
    }, "options": {"include_trace": False}})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "optimal"
    assert len(data["dual_model"]["variables"]) == 40


def test_public_api_still_rejects_more_than_ten_decision_variables():
    response = client.post("/api/v1/models/validate", json={"model": {
        "name": "public limit", "sense": "max",
        "variables": [{"id": f"x{i}"} for i in range(11)],
        "objective": [1] * 11,
        "constraints": [],
    }})
    assert response.status_code == 422


def test_internal_domain_cap_is_explicit():
    with pytest.raises(InvalidModel, match="40"):
        LinearProgram("bad", "max", (0.0,) * 41, (),
                      tuple(Variable(f"x{i}") for i in range(41)))
