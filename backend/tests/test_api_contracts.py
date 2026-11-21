from fastapi.testclient import TestClient
from pivonauta.main import app
import pivonauta.main as main_module


client = TestClient(app)


def wyndor():
    return {"model": {
        "name": "Wyndor", "sense": "max",
        "objective": [3, 5],
        "variables": [{"id": "x1"}, {"id": "x2"}],
        "constraints": [
            {"id": "r1", "coefficients": [1, 0], "operator": "le", "rhs": 4},
            {"id": "r2", "coefficients": [0, 2], "operator": "le", "rhs": 12},
            {"id": "r3", "coefficients": [3, 2], "operator": "le", "rhs": 18},
        ],
    }}


def test_documented_response_models_match_api_payloads():
    openapi = client.get("/openapi.json").json()
    expected = {
        "/api/v1/models/validate": "ModelValidationResponse",
        "/api/v1/solves": "SolveResponse",
        "/api/v1/solves/integer": "IntegerResponse",
        "/api/v1/solves/dual": "DualityResponse",
        "/api/v1/solves/alternatives": "AlternativesResponse",
        "/api/v1/geometry": "GeometryResponse",
        "/api/v1/models/standard-form": "StandardFormResponse",
    }
    for endpoint, typename in expected.items():
        schema = openapi["paths"][endpoint]["post"]["responses"]["200"]["content"]["application/json"]["schema"]
        assert schema["$ref"].endswith(f"/{typename}")


def test_pdf_endpoint_openapi_advertises_binary_content():
    spec = client.get("/openapi.json").json()
    content = spec["paths"]["/api/v1/reports/pdf"]["post"]["responses"]["200"]["content"]
    assert "application/pdf" in content


def test_valid_models_keep_legacy_api_shape():
    solved = client.post("/api/v1/solves", json=wyndor())
    assert solved.status_code == 200, solved.text
    assert solved.json()["status"] == "optimal"
    assert solved.json()["objective_value"] == 36
    assert isinstance(solved.json()["iterations"], list)
    integer = wyndor()
    for v in integer["model"]["variables"]:
        v["domain"] = "integer"
    result = client.post("/api/v1/solves/integer", json=integer)
    assert result.status_code == 200, result.text
    assert "best_rounding_candidate" in result.json()
    assert result.json()["status"] == "optimal"


def test_busy_solver_returns_problem_details_and_429(monkeypatch):
    class Busy:
        def acquire(self, blocking=False):
            return False

        def release(self):
            raise AssertionError("Busy semaphore must not be released")

    monkeypatch.setattr(main_module, "compute_slots", Busy())
    response = client.post("/api/v1/solves", json=wyndor())
    assert response.status_code == 429
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "SOLVER_BUSY"
    assert response.headers.get("X-Request-ID")


def test_request_with_wrong_small_content_length_still_cannot_exceed_limit():
    response = client.post(
        "/api/v1/models/validate",
        content=b"{" + (b" " * 105000) + b"}",
        headers={"content-type": "application/json", "content-length": "2"},
    )
    assert response.status_code == 413
    assert response.json()["code"] == "PAYLOAD_TOO_LARGE"
