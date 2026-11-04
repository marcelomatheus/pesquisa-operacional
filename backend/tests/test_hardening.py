from fastapi.testclient import TestClient
from pivonauta.main import app


client = TestClient(app)


def test_health_check_and_request_id():
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.headers.get("X-Request-ID")


def test_reject_oversized_request_with_explicit_length():
    response = client.post(
        "/api/v1/models/validate",
        content=b"{" + b" " * 120000 + b"}",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json()["code"] == "PAYLOAD_TOO_LARGE"


def test_reject_oversized_chunked_request():
    content = iter([b"{", b" " * 120000, b"}"])
    response = client.post(
        "/api/v1/models/validate",
        content=content,
        headers={"content-type": "application/json", "transfer-encoding": "chunked"},
    )
    assert response.status_code == 413
    assert response.json()["code"] == "PAYLOAD_TOO_LARGE"


def test_known_browser_origin_preflight_is_accepted():
    response = client.options(
        "/api/v1/solves",
        headers={
            "origin": "http://localhost:4173",
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:4173"


def test_untrusted_origin_not_implicitly_allowed():
    response = client.options(
        "/api/v1/solves",
        headers={
            "origin": "https://untrusted.example",
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
        },
    )
    assert response.headers.get("access-control-allow-origin") != "https://untrusted.example"
