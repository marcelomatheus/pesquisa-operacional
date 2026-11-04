from __future__ import annotations

from html import escape
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .report_graphics import BranchTreeFigure, GeometryFigure


NAVY = colors.HexColor("#162235")
MUTED = colors.HexColor("#59677A")
PURPLE = colors.HexColor("#6845AE")
LINE = colors.HexColor("#DFE4EB")
PALE = colors.HexColor("#F5F7FA")
WARN = colors.HexColor("#8A6020")
STATUS = {
    "optimal": "Ótimo certificado",
    "infeasible": "Inviável",
    "unbounded": "Ilimitado",
    "node_limit": "Limite de nos",
    "time_limit": "Limite de tempo",
    "iteration_limit": "Limite de iteracoes",
    "numerical_error": "Falha numerica",
    "not_applicable": "Não aplicável",
    "not_certified": "Não certificado",
    "verification_failed": "Verificação não concluída",
    "multiple": "Ótimos múltiplos",
    "unique": "Ótimo único",
    "undetermined": "Inconclusivo",
    "feasible": "Viavel",
}


def fmt(value):
    if value is None:
        return "n/d"
    if isinstance(value, float):
        return f"{value:.6g}"
    return str(value)


def safe(value):
    return escape(str(value)).replace("\n", "<br/>")


def expression(coefficients, variable_names):
    terms = []
    for cost, name in zip(coefficients, variable_names, strict=True):
        prefix = "-" if cost < 0 else "+"
        terms.append(f"{prefix} {fmt(abs(cost))}*{name}")
    if not terms:
        return "0"
    result = " ".join(terms).strip()
    return result[2:] if result.startswith("+ ") else result


def styles():
    regular = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("PNTitle", parent=regular["Title"], fontName="Helvetica-Bold",
                                fontSize=25, leading=31, textColor=NAVY, alignment=TA_LEFT,
                                spaceAfter=14),
        "section": ParagraphStyle("PNSection", parent=regular["Heading2"], fontName="Helvetica-Bold",
                                  fontSize=15, leading=19, textColor=PURPLE, spaceBefore=16,
                                  spaceAfter=9),
        "subsection": ParagraphStyle("PNSubsection", parent=regular["Heading3"], fontName="Helvetica-Bold",
                                     fontSize=10.5, leading=14, textColor=NAVY, spaceBefore=11,
                                     spaceAfter=6),
        "body": ParagraphStyle("PNBody", parent=regular["BodyText"], fontName="Helvetica",
                               fontSize=9.1, leading=14, textColor=NAVY, spaceAfter=7),
        "small": ParagraphStyle("PNSmall", parent=regular["BodyText"], fontName="Helvetica",
                                fontSize=8, leading=11.5, textColor=MUTED, spaceAfter=5),
        "note": ParagraphStyle("PNNote", parent=regular["BodyText"], fontName="Helvetica",
                               fontSize=8.5, leading=12.5, textColor=WARN, spaceAfter=8),
        "cell": ParagraphStyle("PNCell", parent=regular["BodyText"], fontName="Helvetica",
                               fontSize=7.6, leading=10, textColor=NAVY),
        "cellsmall": ParagraphStyle("PNCellSmall", parent=regular["BodyText"], fontName="Helvetica",
                                    fontSize=6.7, leading=8.4, textColor=NAVY),
        "cellheader": ParagraphStyle("PNCellHeader", parent=regular["BodyText"], fontName="Helvetica-Bold",
                                     fontSize=7.5, leading=10, textColor=colors.white),
        "label": ParagraphStyle("PNLabel", parent=regular["Normal"], fontName="Helvetica-Bold",
                                fontSize=8, leading=11, textColor=MUTED, alignment=TA_CENTER),
    }


def p(value, style):
    return Paragraph(safe(value), style)


def make_table(columns, rows, st, widths=None, tiny=False):
    small = st["cellsmall"] if tiny else st["cell"]
    data = [[p(cell, st["cellheader"]) for cell in columns]]
    data.extend([[p(cell, small) for cell in row] for row in rows])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT", splitByRow=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("GRID", (0, 0), (-1, -1), .3, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5 if not tiny else 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5 if not tiny else 3),
    ]))
    return table


def section(story, st, title):
    story.append(Paragraph(safe(title), st["section"]))
    story.append(HRFlowable(width="100%", thickness=.8, color=LINE, spaceAfter=10))


def add_line(story, st, text, kind="body"):
    story.append(p(text, st[kind]))


REPORT_MESSAGE_TRANSLATIONS = {
    "Optimal continuous solution certified by tableau":
        "Solução contínua ótima certificada pelo tableau final.",
    "All nodes explored/pruned; integer optimum certified":
        "Todos os nós foram explorados ou podados; ótimo inteiro certificado.",
    "Primal and dual objectives agree; complementary slackness verified":
        "Os objetivos primal e dual coincidem; complementaridade verificada.",
}


def add_status(story, st, result, label="Estado"):
    status = result.get("status") or "not_certified"
    add_line(story, st, f"{label}: {STATUS.get(status, status)}.")
    if result.get("message"):
        message = str(result["message"])
        add_line(story, st, REPORT_MESSAGE_TRANSLATIONS.get(message, message), "small")


def add_values(story, st, values):
    if values:
        story.append(make_table(["Variável", "Valor"],
                                [[name, fmt(value)] for name, value in values.items()],
                                st, widths=[120, 120]))


def tableaux(story, st, result, maximum, heading):
    items = result.get("iterations") or []
    story.append(Paragraph(safe(heading), st["subsection"]))
    if not items:
        add_line(story, st, "O algoritmo não retornou tableaux para esta analise.", "small")
        return
    if len(items) > maximum:
        if maximum == 1:
            indices = [len(items) - 1]
        else:
            indices = sorted({round(i * (len(items) - 1) / (maximum - 1)) for i in range(maximum)})
        add_line(story, st, f"Amostra representativa: {len(indices)} de {len(items)} tableaux. "
                 "O primeiro e o ultimo estao incluidos quando o limite permite.", "note")
    else:
        indices = list(range(len(items)))
    for position in indices:
        snapshot = items[position]
        columns = snapshot.get("columns") or []
        matrix = snapshot.get("matrix") or []
        basis = snapshot.get("basis") or []
        if not columns or not matrix:
            continue
        description = (f"Tableau {position + 1}/{len(items)} | "
                       f"fase {snapshot.get('phase', 'n/d')} | "
                       f"iteracao {snapshot.get('iteration', 'n/d')} | "
                       f"evento {snapshot.get('event', 'n/d')}")
        story.append(Paragraph(safe(description), st["subsection"]))
        pivot = snapshot.get("pivot") or {}
        if pivot.get("entering"):
            add_line(story, st, f"Entra: {pivot['entering']} | Sai: {pivot.get('leaving', 'n/d')} | "
                     f"Elemento pivo: {fmt(pivot.get('value'))} | "
                     f"Razao minima: {fmt(pivot.get('min_ratio'))}", "small")
        variable_indices = list(range(max(0, len(columns) - 1)))
        rhs_index = len(columns) - 1
        for start in range(0, len(variable_indices), 8):
            batch = variable_indices[start:start + 8]
            visible = batch + [rhs_index]
            headers = ["Base"] + [columns[index] for index in visible]
            rows = []
            for index, row in enumerate(matrix):
                label = "Z" if index == 0 else (basis[index - 1] if index - 1 < len(basis) else "?")
                rows.append([label] + [fmt(row[j]) if j < len(row) else "n/d" for j in visible])
            story.append(make_table(headers, rows, st, tiny=True))
            story.append(Spacer(1, 5))
        if pivot.get("ratio_test"):
            ratio = "; ".join(f"L{item['row']} = {fmt(item['value'])}"
                              for item in pivot["ratio_test"])
            add_line(story, st, f"Teste da razao: {ratio}", "small")
        operations = snapshot.get("row_operations") or []
        if operations:
            for operation in operations[:14]:
                target = operation.get("target_row")
                source = operation.get("source_row")
                factor = fmt(operation.get("factor"))
                kind = operation.get("kind")
                if kind == "scale":
                    message = f"L{target} normalizada pelo elemento pivo {fmt(operation.get('pivot_value'))}."
                else:
                    message = f"L{target} <- L{target} + ({factor})*L{source}."
                add_line(story, st, message, "small")
            if len(operations) > 14:
                add_line(story, st, f"{len(operations) - 14} operacoes adicionais nao detalhadas.", "note")


def add_model(story, st, model):
    section(story, st, "1. Formulação do problema")
    names = [variable.id for variable in model.variables]
    add_line(story, st, f"Função objetivo: {model.sense.upper()} Z = "
             f"{expression(model.objective, names)}")
    rows = []
    for i, constraint in enumerate(model.constraints, 1):
        relation = {"le": "<=", "ge": ">=", "eq": "="}.get(constraint.operator, constraint.operator)
        rows.append([constraint.id or f"R{i}", expression(constraint.coefficients, names),
                     relation, fmt(constraint.rhs)])
    if rows:
        story.append(make_table(["Restrição", "Membro esquerdo", "Relação", "Limite"],
                                rows, st, widths=[85, 435, 70, 85]))
    else:
        add_line(story, st, "Nenhuma restricao explicita.", "small")
    story.append(Spacer(1, 9))
    story.append(make_table(["Variável", "Domínio", "Limite inferior", "Limite superior"],
                            [[v.id, v.domain, fmt(v.lower_bound), fmt(v.upper_bound)]
                             for v in model.variables],
                            st, widths=[100, 155, 145, 145]))


def add_simplex(story, st, primal, limit):
    section(story, st, "2. Solução contínua pelo Simplex")
    add_status(story, st, primal, "Resultado")
    add_line(story, st, f"Função objetivo: {fmt(primal.get('objective_value'))} | "
             f"Pivoteamentos: {primal.get('pivot_count', 0)}")
    add_values(story, st, primal.get("variables"))
    tableaux(story, st, primal, limit, "Histórico tabular primal")


def add_integer(story, st, result):
    section(story, st, "3. Programação inteira e Branch and Bound")
    add_status(story, st, result)
    if result.get("status") == "not_applicable":
        return
    if result.get("mode"):
        add_line(story, st, f"Cenário: {result['mode']}", "small")
    certified = result.get("status") == "optimal"
    add_line(story, st, "Certificação: "
             + ("Ótimo inteiro certificado por exploração e podas."
                if certified else "Incumbente não certificado como ótimo."), "note")
    add_line(story, st, f"Valor inteiro/incumbente: {fmt(result.get('objective_value'))} | "
             f"Nós explorados: {result.get('explored_nodes', 0)} | "
             f"Gap informado: {fmt(result.get('optimality_gap'))}")
    add_values(story, st, result.get("variables"))
    candidates = result.get("rounding_candidates") or []
    if candidates:
        story.append(Paragraph("Candidatos obtidos por arredondamento", st["subsection"]))
        story.append(make_table(["Vetor", "Viabilidade", "Objetivo"],
                                [["; ".join(f"{k}={fmt(v)}" for k, v in item.get("values", {}).items()),
                                  "Sim" if item.get("feasible") else "Nao", fmt(item.get("objective_value"))]
                                 for item in candidates[:32]], st, widths=[385, 110, 110]))
        if len(candidates) > 32:
            add_line(story, st, f"{len(candidates)-32} candidatos adicionais nao exibidos.", "note")
    nodes = result.get("nodes") or []
    if nodes:
        story.append(Paragraph("Árvore de ramificação", st["subsection"]))
        story.append(BranchTreeFigure(nodes))
        if len(nodes) > 24:
            add_line(story, st, "Diagrama resume os 24 primeiros nos; a tabela registra todos os nos explorados.", "note")
        entries = [[item["id"], item.get("parent_id") or "-", item.get("branch_constraint") or "Raiz",
                    item["status"], fmt(item.get("relaxation_objective"))] for item in nodes]
        story.append(make_table(["No", "Pai", "Decisao", "Situacao", "Limite LP"], entries,
                                st, widths=[90, 90, 230, 150, 115]))


def add_geometry(story, st, geometry, primal, integer, alternatives, model):
    section(story, st, "4. Representação gráfica")
    if geometry.get("status") != "feasible":
        add_status(story, st, geometry)
        return
    add_line(story, st, f"Região: {geometry['region_type']} | "
             f"Limitada: {'sim' if geometry.get('bounded') else 'nao'} | "
             f"Dimensão: {geometry.get('dimension')} | Vértices: {len(geometry.get('vertices') or [])}")
    names = tuple(variable.id for variable in model.variables)
    multiple_certified = bool(alternatives and alternatives.get("status") == "multiple"
                              and alternatives.get("certified"))
    story.append(GeometryFigure(
        geometry, primal, integer, variable_names=names, multiple_certified=multiple_certified
    ))
    add_line(story, st, "Legenda: roxo = regiao e ótimo continuo; amarelo = curvas de nivel "
             "e fronteira ótima quando certificada; verde = solução inteira; ciano = restrições; "
             "cinza = malha inteira.", "small")
    if not geometry.get("bounded"):
        add_line(story, st, "A regiao e ilimitada. O desenho mostra somente a parte recortada "
                 "pela janela, e nao uma regiao globalmente limitada.", "note")
    lattice = geometry.get("integer_lattice") or {}
    if lattice.get("sampled"):
        add_line(story, st, "A malha inteira foi amostrada. Pontos omitidos podem ser viaveis; "
                 "a amostra nao comprova otimalidade.", "note")
    if lattice.get("mode") == "forced_all":
        add_line(story, st, "A malha corresponde ao cenario hipotetico com todas as variáveis inteiras.", "small")


def add_dual(story, st, data, limit):
    section(story, st, "5. Problema dual e verificação")
    add_status(story, st, data)
    add_line(story, st, f"Z primal = {fmt(data.get('primal_objective'))} | "
             f"Z dual = {fmt(data.get('dual_objective'))} | "
             f"Gap = {fmt(data.get('duality_gap'))} | "
             f"Complementaridade: {fmt(data.get('complementary_slackness'))}")
    formulation = data.get("dual_model") or {}
    variables = [variable["id"] for variable in formulation.get("variables", [])]
    if formulation:
        add_line(story, st, f"Objetivo dual: {formulation.get('sense', '').upper()} W = "
                 f"{expression(formulation.get('objective', []), variables)} "
                 f"(constante primal: {fmt(data.get('objective_offset'))})")
        rows = []
        for item in formulation.get("constraints") or []:
            rows.append([item["id"], expression(item["coefficients"], variables),
                         item["operator"], fmt(item["rhs"])])
        if rows:
            story.append(make_table(["Restrição dual", "Membro esquerdo", "Relação", "Limite"],
                                    rows, st, widths=[105, 425, 70, 75]))
    dual = data.get("dual")
    if dual:
        add_values(story, st, dual.get("variables"))
        tableaux(story, st, dual, limit, "Histórico tabular do dual")


def add_alternatives(story, st, data):
    section(story, st, "6. Diagnóstico de ótimos alternativos")
    add_status(story, st, data)
    add_line(story, st, "Certificação: " + (
        "Sim" if data.get("certified") else "Nao. O resultado e inconclusivo."
    ), "note")
    add_line(story, st, f"Valor objetivo: {fmt(data.get('objective_value'))} | "
             f"Bases exploradas: {data.get('explored_bases', 0)}")
    if data.get("reference"):
        add_line(story, st, "Ponto de referencia: " +
                 ", ".join(f"{name}={fmt(value)}" for name, value in data["reference"].items()))
    if data.get("alternative"):
        add_line(story, st, "Segundo ponto ótimo certificado: " +
                 ", ".join(f"{name}={fmt(value)}" for name, value in data["alternative"].items()))
    if data.get("status") == "multiple":
        add_line(story, st, "Duas solucoes distintas, viaveis e com o mesmo valor objetivo "
                 "comprovam a multiplicidade do ótimo.", "small")


def decorate(canvas, document):
    canvas.saveState()
    width, _ = landscape(A4)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(.7)
    canvas.line(35, 32, width - 35, 32)
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(39, 20, "PIVONAUTA | PESQUISA OPERACIONAL")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - 40, 20, f"Página {document.page}")
    canvas.restoreState()


def build_report_pdf(payload):
    output = BytesIO()
    document = SimpleDocTemplate(
        output, pagesize=landscape(A4), leftMargin=42, rightMargin=42,
        topMargin=42, bottomMargin=43, title="PivoNauta - Relatorio academico",
        author="PivoNauta", pageCompression=1,
    )
    st = styles()
    story = []
    story.append(Paragraph("PIVONAUTA", st["label"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Relatório técnico de otimização", st["title"]))
    story.append(p(f"Modelo: {payload['model'].name}", st["body"]))
    story.append(p(f"Gerado em UTC: {payload['generated_at']}", st["small"]))
    story.append(HRFlowable(width="100%", color=PURPLE, thickness=1.5, spaceAfter=16))
    primal = payload["primal"]
    add_line(story, st, "Sumário executivo")
    add_line(story, st, f"Simplex: {STATUS.get(primal['status'], primal['status'])}. "
             f"Valor objetivo: {fmt(primal['objective_value'])}. "
             f"Pivoteamentos: {primal['pivot_count']}.")
    selected = set(payload["sections"])
    analysis = payload["analyses"]
    integer = analysis.get("integer")
    if integer:
        add_line(story, st, "Inteiros: " +
                 STATUS.get(integer.get("status", "not_certified"), integer.get("status", "not_certified")) +
                 f". Objetivo: {fmt(integer.get('objective_value'))}.")
    if payload["notices"]:
        story.append(Paragraph("Avisos de certificação e escopo", st["subsection"]))
        for notice in payload["notices"]:
            add_line(story, st, notice, "note")
    if "model" in selected:
        add_model(story, st, payload["model"])
    if "simplex" in selected:
        add_simplex(story, st, primal, payload["max_tableaux"])
    if "integer" in selected:
        add_integer(story, st, analysis["integer"])
    if "geometry" in selected:
        add_geometry(story, st, analysis["geometry"], primal, integer,
                     analysis.get("alternatives"), payload["model"])
    if "dual" in selected:
        add_dual(story, st, analysis["dual"], payload["max_tableaux"])
    if "alternatives" in selected:
        add_alternatives(story, st, analysis["alternatives"])
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=.8, color=LINE))
    add_line(story, st, "Relatorio gerado por algoritmos proprios de Simplex e Branch and Bound, "
             "em Python puro. As informacoes não certificadas sao identificadas explicitamente.", "small")
    document.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return output.getvalue()
