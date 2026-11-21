import re


STATUS_LABELS = {
    "optimal": "Ótimo certificado",
    "infeasible": "Inviável",
    "unbounded": "Ilimitado",
    "node_limit": "Limite de nós",
    "time_limit": "Limite de tempo",
    "iteration_limit": "Limite de iterações",
    "numerical_error": "Falha numérica",
    "not_applicable": "Não aplicável",
    "not_certified": "Não certificado",
    "verification_failed": "Verificação não concluída",
    "multiple": "Ótimos múltiplos",
    "unique": "Ótimo único",
    "undetermined": "Inconclusivo",
    "feasible": "Viável",
    "constraint_limit": "Limite interno de restrições",
    "integer": "Solução inteira",
    "branched": "Ramificado",
    "pruned_bound": "Podado por limite",
    "relaxation_unbounded": "Relaxação ilimitada",
    "processing": "Em processamento",
}

MESSAGES = {
    "Optimal continuous solution certified by tableau":
        "Solução contínua ótima certificada pelo tableau final.",
    "Phase I optimum is negative; no feasible basis exists":
        "A Fase I não encontrou uma base viável para o modelo.",
    "All nodes explored/pruned: integer optimum certified":
        "Todos os nós foram explorados ou podados; ótimo inteiro certificado.",
    "No feasible integer solution was found after exhaustive search":
        "Nenhuma solução inteira viável foi encontrada após explorar a árvore.",
    "LP relaxation unbounded; integer optimality undetermined":
        "Relaxação linear ilimitada; a otimalidade inteira é inconclusiva.",
    "Node limit reached; incumbent is not certified optimal":
        "Limite de nós atingido; o incumbente não é um ótimo certificado.",
    "Time limit reached; incumbent is not certified optimal":
        "Tempo limite atingido; o incumbente não é um ótimo certificado.",
    "Internal constraint limit reached; optimality not certified":
        "Limite interno de restrições atingido; otimalidade não certificada.",
    "Branch and Bound stopped without an optimality certificate":
        "A busca inteira terminou sem certificado de otimalidade.",
    "Primal and dual objectives agree; complementary slackness verified":
        "Os objetivos primal e dual coincidem; complementaridade verificada.",
    "Strong duality not certified; inspect individual solver statuses":
        "A dualidade forte não foi certificada; confira os estados dos solucionadores.",
    "Distinct feasible points with identical objective value were verified":
        "Foram certificados pontos viáveis distintos com o mesmo valor objetivo.",
    "No distinct optimal decision point exists in explored optimal bases":
        "Nenhum ponto ótimo distinto foi encontrado nas bases ótimas exploradas.",
    "Time limit reached during optimal-basis exploration":
        "Tempo limite atingido durante a exploração das bases ótimas.",
    "Maximum number of optimal bases reached":
        "Limite de bases ótimas exploradas atingido; análise inconclusiva.",
}

PHASES = {
    "phase_1": "Fase I",
    "phase_1_cleanup": "Limpeza da Fase I",
    "phase_2": "Fase II",
}

EVENTS = {
    "initial": "Tableau inicial",
    "pivot": "Pivoteamento",
    "optimal": "Critério de otimalidade",
    "unbounded": "Ilimitado",
    "time_limit": "Limite de tempo",
    "iteration_limit": "Limite de iterações",
    "remove_redundant_row": "Remoção de restrição redundante",
}

REGIONS = {
    "polygon": "Polígono",
    "segment": "Segmento",
    "point": "Ponto",
    "unbounded": "Ilimitada",
    "empty": "Vazia",
    "unknown": "Não determinada",
}

DOMAINS = {"continuous": "Contínua", "integer": "Inteira"}
INTEGER_MODES = {
    "declared": "Domínios declarados",
    "all_integer": "Todas as variáveis inteiras",
    "forced_all": "Todas as variáveis inteiras",
}


def report_status(status):
    return STATUS_LABELS.get(status, status or "Não certificado")


def report_message(message):
    if not message:
        return ""
    if message in MESSAGES:
        return MESSAGES[message]
    phase = re.fullmatch(r"Phase (I|II) stopped: ([a-z_]+)", message)
    if phase:
        return f"Fase {phase.group(1)} interrompida: {report_status(phase.group(2))}."
    status = re.fullmatch(r"Simplex termination was ([a-z_]+)", message)
    if status:
        return f"O Simplex encerrou com estado: {report_status(status.group(1))}."
    feasibility = re.fullmatch(r"Feasibility solve ended with ([a-z_]+)", message)
    if feasibility:
        return f"A verificação de viabilidade terminou com estado: {report_status(feasibility.group(1))}."
    return message


def report_phase(phase):
    return PHASES.get(phase, phase or "Não informado")


def report_event(event):
    return EVENTS.get(event, event or "Não informado")


def report_region(region):
    return REGIONS.get(region, region or "Não determinada")


def report_domain(domain):
    return DOMAINS.get(domain, domain or "Não informado")


def report_integer_mode(mode):
    return INTEGER_MODES.get(mode, mode or "Não informado")
