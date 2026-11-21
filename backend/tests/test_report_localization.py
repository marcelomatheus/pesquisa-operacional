from io import BytesIO

from fastapi.testclient import TestClient
from pypdf import PdfReader

from pivonauta import __version__
from pivonauta.main import app
from pivonauta.report_labels import (
    report_domain, report_event, report_integer_mode, report_message,
    report_phase, report_region, report_status,
)


client = TestClient(app)


def wyndor():
    return {
        "name": "Wyndor",
        "sense": "max",
        "variables": [{"id": "x1"}, {"id": "x2"}],
        "objective": [3, 5],
        "constraints": [
            {"id": "r1", "coefficients": [1, 0], "operator": "le", "rhs": 4},
            {"id": "r2", "coefficients": [0, 2], "operator": "le", "rhs": 12},
            {"id": "r3", "coefficients": [3, 2], "operator": "le", "rhs": 18},
        ],
    }


def test_academic_report_labels_are_localized():
    assert report_region("polygon") == "Polígono"
    assert report_phase("phase_2") == "Fase II"
    assert report_event("pivot") == "Pivoteamento"
    assert report_status("node_limit") == "Limite de nós"
    assert report_domain("integer") == "Inteira"
    assert report_integer_mode("all_integer") == "Todas as variáveis inteiras"


def test_certificate_messages_are_translated_without_changing_status():
    assert "não encontrou uma base viável" in report_message("Phase I optimum is negative; no feasible basis exists")
    assert "inviável" in report_message("Phase II stopped: infeasible").lower()
    assert "pontos viáveis distintos" in report_message(
        "Distinct feasible points with identical objective value were verified"
    )
    assert report_message("Custom technical reason") == "Custom technical reason"


def test_pdf_extracted_text_has_formatted_phases_regions_and_pivot_labels():
    response = client.post("/api/v1/reports/pdf", json={
        "model": wyndor(),
        "options": {
            "sections": ["model", "simplex", "geometry", "dual", "alternatives"],
            "max_tableaux": 12,
        },
    })
    assert response.status_code == 200, response.text
    assert response.content.startswith(b"%PDF-")
    text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(response.content)).pages)
    assert "Fase II" in text
    assert "Polígono" in text
    assert "Pivoteamentos" in text
    assert "Problema dual" in text
    assert "phase_2" not in text
    assert "polygon" not in text
    assert "No distinct optimal" not in text


def test_api_health_version_matches_declared_v1_release():
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert __version__ == "1.0.0"
    assert response.json()["version"] == "1.0.0"
