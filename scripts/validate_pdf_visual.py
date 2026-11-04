from __future__ import annotations

from io import BytesIO
from pathlib import Path

import fitz
from fastapi.testclient import TestClient

from pivonauta.main import app

OUT = Path("validation-artifacts/pdf")
OUT.mkdir(parents=True, exist_ok=True)
CLIENT = TestClient(app)


def case(name, sense, objective, constraints, domains, sections, mode="declared"):
    return {
        "model": {
            "name": name,
            "sense": sense,
            "variables": [
                {"id": f"x{i + 1}", "domain": domains[i]}
                for i in range(len(objective))
            ],
            "objective": objective,
            "constraints": [
                {"id": f"r{i + 1}", "coefficients": coefficients,
                 "operator": operator, "rhs": rhs}
                for i, (coefficients, operator, rhs) in enumerate(constraints)
            ],
        },
        "options": {
            "sections": sections,
            "max_tableaux": 12,
            "max_nodes": 80,
            "integer_mode": mode,
        },
    }


def validate_document(label, payload):
    response = CLIENT.post("/api/v1/reports/pdf", json=payload)
    if response.status_code != 200:
        raise RuntimeError(f"{label}: PDF HTTP {response.status_code}: {response.text[:2000]}")
    data = response.content
    if not data.startswith(b"%PDF-"):
        raise RuntimeError(f"{label}: assinatura PDF ausente")
    (OUT / f"{label}.pdf").write_bytes(data)
    pdf = fitz.open(stream=data, filetype="pdf")
    if not pdf.page_count:
        raise RuntimeError(f"{label}: documento sem paginas")
    for index, page in enumerate(pdf):
        width, height = page.rect.width, page.rect.height
        words = page.get_text("words")
        if not words:
            raise RuntimeError(f"{label}: pagina {index + 1} sem texto extraivel")
        for x0, y0, x1, y1, text, *_ in words:
            if x0 < -1 or y0 < -1 or x1 > width + 1 or y1 > height + 1:
                raise RuntimeError(
                    f"{label}: texto fora da pagina {index + 1}: "
                    f"{text!r} ({x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f})"
                )
        if index < 3:
            page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3), alpha=False).save(
                OUT / f"{label}-page-{index + 1}.png"
            )
    print(f"{label}: {pdf.page_count} paginas, {len(data)} bytes, leitura e renderizacao OK")


def main():
    wyndor = case(
        "Wyndor", "max", [3, 5],
        [([1, 0], "le", 4), ([0, 2], "le", 12), ([3, 2], "le", 18)],
        ["integer", "integer"],
        ["model", "simplex", "integer", "geometry", "dual", "alternatives"],
    )
    radiotherapy = case(
        "Radioterapia", "min", [.4, .5],
        [([.3, .1], "le", 2.7), ([.5, .5], "eq", 6), ([.6, .4], "ge", 6)],
        ["integer", "integer"],
        ["model", "simplex", "integer", "geometry", "dual"],
    )
    wide_constraints = []
    for index in range(10):
        row = [1.0 if i == index else 0.0 for i in range(10)]
        wide_constraints.append((row, "le", 10))
    for _ in range(20):
        wide_constraints.append(([1.0] * 10, "le", 120))
    wide = case(
        "Modelo grande com dez variaveis e trinta restricoes",
        "max", [1.0] * 10, wide_constraints,
        ["continuous"] * 10, ["model", "simplex"],
    )
    infeasible = case(
        "Modelo inviavel", "max", [2, 3],
        [([1, 0], "le", 1), ([1, 0], "ge", 3)],
        ["continuous", "continuous"], ["model", "simplex", "geometry"],
    )
    for label, payload in [
        ("wyndor", wyndor),
        ("radiotherapy", radiotherapy),
        ("wide", wide),
        ("infeasible", infeasible),
    ]:
        validate_document(label, payload)


if __name__ == "__main__":
    main()
