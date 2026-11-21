from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

from pivonauta.main import app
from pivonauta.report_data import REPORT_TOTAL_SECONDS


client = TestClient(app)


def many_constraints():
    return {"model": {
        "name": "Dual com doze restricoes",
        "sense": "max",
        "objective": [1],
        "variables": [{"id": "x1"}],
        "constraints": [
            {"id": f"r{i + 1}", "coefficients": [1],
             "operator": "le", "rhs": 5 + i}
            for i in range(12)
        ],
    }}


def test_pdf_generates_dual_after_more_than_ten_primal_rows():
    response = client.post("/api/v1/reports/pdf", json={
        **many_constraints(),
        "options": {
            "sections": ["model", "dual", "simplex"],
            "max_tableaux": 2,
        },
    })
    assert response.status_code == 200, response.text
    assert response.content.startswith(b"%PDF-")
    text = "\n".join(page.extract_text() or ""
                     for page in PdfReader(BytesIO(response.content)).pages)
    assert "Problema dual" in text
    assert "Dual com doze restricoes" in text


def test_report_has_global_budget():
    assert 0 < REPORT_TOTAL_SECONDS <= 30


def test_report_pdf_remains_binary_even_when_simplex_is_infeasible():
    payload = many_constraints()
    payload["model"]["constraints"].append({
        "id": "impossible", "coefficients": [1], "operator": "ge", "rhs": 100,
    })
    response = client.post("/api/v1/reports/pdf", json={
        **payload, "options": {"sections": ["model", "simplex", "dual"]},
    })
    assert response.status_code == 200, response.text
    text = "\n".join(page.extract_text() or ""
                     for page in PdfReader(BytesIO(response.content)).pages)
    assert "Inviável" in text
    assert "Ótimo certificado" not in text
