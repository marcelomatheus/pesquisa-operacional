import { SOLVE_STATUSES } from './solverApi.js';

const messages = {
  'Optimal continuous solution certified by tableau': 'Solução contínua ótima certificada pelo tableau final.',
  'Phase I optimum is negative; no feasible basis exists': 'A Fase I não encontrou uma base viável para o modelo.',
  'No feasible basis remains after Phase I': 'Não restou base viável após a Fase I.',
  'All nodes explored/pruned: integer optimum certified': 'Todos os nós foram explorados ou podados; ótimo inteiro certificado.',
  'No feasible integer solution was found after exhaustive search': 'Nenhuma solução inteira viável foi encontrada após explorar a árvore.',
  'LP relaxation unbounded; integer optimality undetermined': 'Relaxação linear ilimitada; a otimalidade inteira é inconclusiva.',
  'Node limit reached; incumbent is not certified optimal': 'Limite de nós atingido; o incumbente não é um ótimo certificado.',
  'Time limit reached; incumbent is not certified optimal': 'Tempo limite atingido; o incumbente não é um ótimo certificado.',
  'Internal constraint limit reached; optimality not certified': 'Limite interno de restrições atingido; otimalidade não certificada.',
  'Branch and Bound stopped without an optimality certificate': 'A busca inteira terminou sem certificado de otimalidade.',
  'Primal and dual objectives agree; complementary slackness verified': 'Os objetivos primal e dual coincidem; complementaridade verificada.',
  'Strong duality not certified; inspect individual solver statuses': 'A dualidade forte não foi certificada; confira os estados dos solucionadores.',
  'Distinct feasible points with identical objective value were verified': 'Foram certificados pontos viáveis distintos com o mesmo valor objetivo.',
  'No distinct optimal decision point exists in explored optimal bases': 'Nenhum ponto ótimo distinto foi encontrado nas bases ótimas exploradas.',
  'Maximum number of optimal bases reached': 'Limite de bases ótimas exploradas atingido; análise inconclusiva.',
  'Time limit reached during optimal-basis exploration': 'Tempo limite atingido durante a exploração das bases ótimas.',
  'No second feasible optimal point found after exploring candidate bases': 'Não foi encontrado outro ponto ótimo viável nas bases candidatas.',
};

export function formatCount(value, singular, plural) {
  return `${value} ${Number(value) === 1 ? singular : plural}`;
}

export function formatSolverStatus(status) {
  return SOLVE_STATUSES[status] || String(status || 'Não certificado').replaceAll('_', ' ');
}

export function translateSolverMessage(message) {
  if (!message) return '';
  if (messages[message]) return messages[message];

  const phase = /^Phase (I|II) stopped: ([a-z_]+)$/.exec(message);
  if (phase) return `Fase ${phase[1]} interrompida: ${formatSolverStatus(phase[2])}.`;

  const termination = /^Simplex termination was ([a-z_]+)$/.exec(message);
  if (termination) return `O Simplex encerrou com estado: ${formatSolverStatus(termination[1])}.`;

  const feasibility = /^Feasibility solve ended with ([a-z_]+)$/.exec(message);
  if (feasibility) return `A verificação de viabilidade terminou com estado: ${formatSolverStatus(feasibility[1])}.`;

  return message;
}

export function formatMathPhase(phase) {
  return ({
    phase_1: 'Fase I',
    phase_1_cleanup: 'Limpeza da Fase I',
    phase_2: 'Fase II',
  })[phase] || phase;
}

export function formatMathEvent(event) {
  return ({
    initial: 'Tableau inicial',
    pivot: 'Pivoteamento',
    optimal: 'Ótimo',
    unbounded: 'Ilimitado',
    iteration_limit: 'Limite de iterações',
    time_limit: 'Limite de tempo',
    remove_redundant_row: 'Remoção de linha redundante',
  })[event] || event;
}

export function formatRegionType(regionType) {
  return ({
    polygon: 'Polígono',
    segment: 'Segmento',
    point: 'Ponto',
    unbounded: 'Ilimitada',
    empty: 'Vazia',
    unknown: 'Desconhecida',
  })[regionType] || regionType;
}
