from fastapi.testclient import TestClient

from pivonauta.main import app

client = TestClient(app)


def body():
    return {
        "model": {
            "name": "Wyndor",
            "sense": "max",
            "variables": [{"id": "x1", "domain": "integer"}, {"id": "x2", "domain": "integer"}],
            "objective": [3, 5],
            "constraints": [
                {"id": "r1", "coefficients": [1, 0], "operator": "le", "rhs": 4},
                {"id": "r2", "coefficients": [0, 2], "operator": "le", "rhs": 12},
                {"id": "r3", "coefficients": [3, 2], "operator": "le", "rhs": 18},
            ],
        }
    }


def test_health():
    assert client.get("/api/v1/health/live").json() == {"status": "ok"}
    assert client.get("/api/v1/health/ready").status_code == 200


def test_validate():
    result = client.post("/api/v1/models/validate", json=body())
    assert result.status_code == 200
    assert result.json()["structurally_valid"] is True
    assert result.json()["feasibility_checked"] is False


def test_validate_rejects_invalid_dimensions():
    payload = body()
    payload["model"]["constraints"][0]["coefficients"] = [1]
    result = client.post("/api/v1/models/validate", json=payload)
    assert result.status_code == 422
    assert result.headers["content-type"].startswith("application/problem+json")
    assert result.json()["code"] == "MODEL_VALIDATION_ERROR"


def test_solve_and_integer():
    lp = client.post("/api/v1/solves", json=body())
    assert lp.status_code == 200
    assert lp.json()["status"] == "optimal"
    assert lp.json()["objective_value"] == 36
    assert lp.json()["iterations"]
    integer = client.post("/api/v1/solves/integer", json=body())
    assert integer.status_code == 200
    assert integer.json()["status"] == "optimal"
    assert integer.json()["objective_value"] == 36


def test_nonfinite_payload_rejected():
    payload = body()
    payload["model"]["objective"][0] = "NaN"
    result = client.post("/api/v1/solves", json=payload)
    assert result.status_code == 422
