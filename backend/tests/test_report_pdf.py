from io import BytesIO

from fastapi.testclient import TestClient
from pypdf import PdfReader

from pivonauta.main import app


client = TestClient(app)


def payload(variables=2, options=None):
    variables_data = [
        {"id": f"x{i + 1}", "domain": "continuous"} for i in range(variables)
    ]
    coefficients = [1.0] * variables
    return {
        "model": {
            "name": "Avaliacao da otimizacao",
            "sense": "max",
            "variables": variables_data,
            "objective": [3.0, 5.0] if variables == 2 else coefficients,
            "constraints": [
                {"id": "r1", "coefficients": [1, 0] if variables == 2 else coefficients,
                 "operator": "le", "rhs": 4},
                {"id": "r2", "coefficients": [0, 2] if variables == 2 else coefficients,
                 "operator": "le", "rhs": 12},
                {"id": "r3", "coefficients": [3, 2] if variables == 2 else coefficients,
                 "operator": "le", "rhs": 18},
            ],
        },
        "options": options or {
            "sections": ["model", "simplex", "geometry", "dual", "alternatives"],
            "max_tableaux": 3,
        },
    }


def extract_pdf(response):
    assert response.status_code == 200, response.text
    assert response.content[:5] == b"%PDF-"
    assert response.headers["content-type"].startswith("application/pdf")
    assert response.headers["cache-control"] == "no-store"
    assert "attachment" in response.headers["content-disposition"]
    document = PdfReader(BytesIO(response.content))
    assert len(document.pages) > 0
    return "\n".join(page.extract_text() or "" for page in document.pages)


def test_pdf_complete_wyndor_contains_formula_solutions_and_dual():
    response = client.post("/api/v1/reports/pdf", json=payload())
    text = extract_pdf(response)
    assert "Avaliacao da otimizacao" in text
    assert "Função objetivo" in text
    assert "36" in text
    assert "Histórico tabular primal" in text
    assert "Problema dual" in text
    assert "Representação gráfica" in text
    assert "Diagnóstico de ótimos alternativos" in text


def test_pdf_sections_are_respected():
    response = client.post("/api/v1/reports/pdf", json=payload(options={
        "sections": ["model", "simplex"], "max_tableaux": 1,
    }))
    text = extract_pdf(response)
    assert "Formulação do problema" in text
    assert "Histórico tabular primal" in text
    assert "Representação gráfica" not in text
    assert "Problema dual" not in text


def test_pdf_non_2d_discloses_graph_limit_without_failure():
    response = client.post("/api/v1/reports/pdf", json=payload(
        variables=3, options={"sections": ["model", "geometry"], "max_tableaux": 2}))
    text = extract_pdf(response)
    assert "Representação gráfica" in text
    assert "não aplicável" in text.lower() or "Não aplicável" in text
    assert "exatamente duas variaveis" in text


def test_pdf_integer_section_certifies_optimum_when_bnb_finishes():
    response = client.post("/api/v1/reports/pdf", json=payload(options={
        "sections": ["model", "integer", "geometry"],
        "integer_mode": "all_integer",
        "max_nodes": 50,
        "max_tableaux": 2,
    }))
    text = extract_pdf(response)
    assert "Programação inteira" in text
    assert "Ótimo inteiro certificado" in text
    assert "Árvore de ramificação" in text
    assert "Todas as variaveis convertidas" in text


def test_pdf_invalid_sections_rejected():
    invalid = payload(options={"sections": ["simplex", "simplex"]})
    response = client.post("/api/v1/reports/pdf", json=invalid)
    assert response.status_code == 422
    assert response.json()["code"] == "MODEL_VALIDATION_ERROR"


def test_pdf_invalid_max_tableaux_rejected():
    invalid = payload(options={"sections": ["simplex"], "max_tableaux": 101})
    response = client.post("/api/v1/reports/pdf", json=invalid)
    assert response.status_code == 422


def test_pdf_infeasible_problem_does_not_invent_optimum():
    data = payload(options={"sections": ["model", "simplex"], "max_tableaux": 3})
    data["model"]["constraints"] = [
        {"id": "r1", "coefficients": [1, 0], "operator": "le", "rhs": 1},
        {"id": "r2", "coefficients": [1, 0], "operator": "ge", "rhs": 3},
    ]
    response = client.post("/api/v1/reports/pdf", json=data)
    text = extract_pdf(response)
    assert "Inviável" in text
    assert "Ótimo certificado" not in text
