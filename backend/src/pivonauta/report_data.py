from __future__ import annotations

from datetime import datetime, timezone

from .alternatives import analyze_optima
from .branch_bound import solve_branch_bound
from .duality import solve_dual
from .geometry import build_geometry
from .simplex import solve_simplex


SECTION_KEYS = ("model", "simplex", "integer", "geometry", "dual", "alternatives")


def collect_report(model, options) -> dict:
    sections = tuple(options.sections)
    primal = solve_simplex(
        model, max_iterations=500, time_limit=3.0, include_trace="simplex" in sections
    ).to_dict()
    analyses: dict[str, dict] = {}
    notices: list[str] = []
    if "integer" in sections:
        has_integer = any(variable.domain == "integer" for variable in model.variables)
        force_all = options.integer_mode == "all_integer"
        if not has_integer and not force_all:
            notices.append("Programacao inteira: nenhuma variavel foi declarada inteira.")
            analyses["integer"] = {
                "status": "not_applicable",
                "message": "Nenhuma variavel inteira declarada e conversao integral desabilitada.",
            }
        else:
            analyses["integer"] = solve_branch_bound(
                model, max_nodes=options.max_nodes, max_iterations=500,
                time_limit=10.0, force_all_integer=force_all
            ).to_dict()
            analyses["integer"]["mode"] = (
                "Todas as variaveis convertidas em inteiras" if force_all
                else "Dominios inteiros definidos no modelo"
            )
            if analyses["integer"]["status"] != "optimal":
                notices.append("A solucao inteira nao foi certificada como otima.")
    if "geometry" in sections:
        if len(model.variables) == 2:
            analyses["geometry"] = build_geometry(
                model, force_all_integer=options.integer_mode == "all_integer",
                max_integer_points=100,
            ).to_dict()
        else:
            notices.append("O grafico bidimensional exige exatamente duas variaveis.")
            analyses["geometry"] = {
                "status": "not_applicable",
                "message": "Representacao bidimensional indisponivel para este modelo.",
            }
    if "dual" in sections:
        analyses["dual"] = solve_dual(
            model, max_iterations=500, time_limit=3.0,
            include_trace=True
        ).to_dict()
        if analyses["dual"]["status"] != "optimal":
            notices.append("A verificacao de dualidade forte nao foi certificada.")
    if "alternatives" in sections:
        analyses["alternatives"] = analyze_optima(
            model, max_bases=200, time_limit=3.0
        ).to_dict()
        if not analyses["alternatives"]["certified"]:
            notices.append("O diagnostico de otimos alternativos e inconclusivo.")
    if primal["status"] != "optimal":
        notices.append("O Simplex nao emitiu certificado de solucao otima.")
    return {
        "title": "Relatorio tecnico de Pesquisa Operacional",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "primal": primal,
        "sections": sections,
        "max_tableaux": options.max_tableaux,
        "analyses": analyses,
        "notices": notices,
    }
