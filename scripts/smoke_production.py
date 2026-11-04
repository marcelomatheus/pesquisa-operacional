from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request


HOST = os.getenv("PIVONAUTA_URL", "http://127.0.0.1:8080").rstrip("/")


def fetch(path, payload=None, timeout=30):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"} if body else {}
    request = urllib.request.Request(HOST + path, data=body, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, response.headers, response.read()


def wait_ready(seconds=150):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            status, _, body = fetch("/api/v1/health/ready", timeout=5)
            if status == 200 and json.loads(body)["status"] == "ready":
                return
        except (OSError, ValueError, KeyError, urllib.error.URLError):
            pass
        time.sleep(1)
    raise RuntimeError("A API publicada nao ficou pronta")


def main():
    wait_ready()
    status, headers, html = fetch("/")
    assert status == 200
    assert "text/html" in headers["Content-Type"]
    assert b'id="root"' in html
    model = {
        "name": "Wyndor Deploy",
        "sense": "max",
        "variables": [
            {"id": "x1", "domain": "continuous"},
            {"id": "x2", "domain": "continuous"},
        ],
        "objective": [3, 5],
        "constraints": [
            {"id": "r1", "coefficients": [1, 0], "operator": "le", "rhs": 4},
            {"id": "r2", "coefficients": [0, 2], "operator": "le", "rhs": 12},
            {"id": "r3", "coefficients": [3, 2], "operator": "le", "rhs": 18},
        ],
    }
    status, _, body = fetch("/api/v1/solves", {"model": model})
    solved = json.loads(body)
    assert status == 200
    assert solved["status"] == "optimal"
    assert abs(solved["objective_value"] - 36.0) < 1e-7
    status, headers, body = fetch(
        "/api/v1/reports/pdf",
        {"model": model, "options": {"sections": ["model", "simplex"]}},
        timeout=60,
    )
    assert status == 200
    assert "application/pdf" in headers["Content-Type"]
    assert body.startswith(b"%PDF-")
    assert len(body) > 2000
    print(f"PRODUCTION SMOKE OK: HTML, API, Simplex Z=36 e PDF ({len(body)} bytes)")


if __name__ == "__main__":
    main()
