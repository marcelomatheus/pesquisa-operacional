const MAX_EVENTS = 600;

const phaseName = phase => ({
  phase_1: 'Fase I · viabilidade',
  phase_1_cleanup: 'Fase I · remoção de artificiais',
  phase_2: 'Fase II · otimização',
}[phase] || phase || 'Execução');

const timeLabel = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour12: false });

export function createConsoleEvent({ id, runId, category = 'system', level = 'info',
  text, details = '', phase = '', step = null, route = null,
  recordedAt = new Date().toISOString(), metadata = null, modelName = '' }) {
  return {
    id: id || `${runId || 'ui'}-${recordedAt}-${Math.random().toString(36).slice(2, 8)}`,
    runId: runId || null,
    category,
    level,
    text,
    details,
    phase,
    step,
    route,
    recordedAt,
    time: timeLabel(recordedAt),
    metadata,
    modelName,
  };
}

export function fromLegacyLog(entry) {
  const level = { success: 'success', amber: 'warning', red: 'error', violet: 'info', cyan: 'info' }[entry.tone] || 'info';
  return createConsoleEvent({ category: 'system', level, text: entry.text, details: entry.detail || '' });
}

export function fromSimplexResult(result, { runId, modelName = '', recordedAt = new Date().toISOString() } = {}) {
  const events = [createConsoleEvent({ id: `${runId}-start`, runId, modelName, recordedAt,
    category: 'simplex', level: 'info', text: 'Resolução contínua iniciada',
    details: 'Os eventos são gerados a partir dos tableaux calculados pelo motor Python.' })];
  for (const [step, snapshot] of (result.iterations || []).entries()) {
    const pivot = snapshot.pivot;
    let level = 'info';
    let text = `${phaseName(snapshot.phase)} · ${snapshot.event}`;
    if (snapshot.event === 'pivot') {
      text = `${phaseName(snapshot.phase)} · ${pivot?.entering || '?'} entra, ${pivot?.leaving || '?'} sai`;
    } else if (snapshot.event === 'optimal') {
      text = `${phaseName(snapshot.phase)} · critério de parada satisfeito`;
      level = 'success';
    } else if (['unbounded', 'numerical_error', 'time_limit', 'iteration_limit'].includes(snapshot.event)) {
      level = 'warning';
    }
    events.push(createConsoleEvent({
      id: `${runId}-simplex-${step}`, runId, modelName, recordedAt, category: 'simplex', level,
      text, phase: snapshot.phase, step, route: `/results/simplex?step=${step}`,
      details: snapshot.event === 'pivot'
        ? `${snapshot.row_operations?.length || 0} operações elementares. Teste da razão: ${pivot?.min_ratio ?? 'não informado'}.`
        : `Tableau ${step + 1} de ${result.iterations.length}.`,
      metadata: { event: snapshot.event, pivot: pivot || null },
    }));
  }
  events.push(createConsoleEvent({
    id: `${runId}-end`, runId, modelName, recordedAt, category: 'simplex',
    level: result.status === 'optimal' ? 'success' : 'warning',
    text: `Simplex: ${result.status}`,
    details: `${result.message || ''} · ${result.pivot_count ?? 0} pivoteamentos`,
  }));
  return events;
}

export function fromBranchBoundResult(result, { runId, modelName = '', recordedAt = new Date().toISOString() } = {}) {
  const events = [createConsoleEvent({
    id: `${runId}-start`, runId, modelName, recordedAt, category: 'branch_bound',
    text: 'Branch and Bound iniciado', details: 'Relaxações calculadas pelo Simplex próprio.',
  })];
  for (const [index, node] of (result.nodes || []).entries()) {
    const level = ['infeasible', 'numerical_error', 'relaxation_unbounded'].includes(node.status)
      ? 'warning' : ['integer', 'pruned_bound'].includes(node.status) ? 'success' : 'info';
    events.push(createConsoleEvent({
      id: `${runId}-node-${index}`, runId, modelName, recordedAt, category: 'branch_bound', level,
      text: `Nó ${node.id}: ${node.status}`,
      details: `${node.branch_constraint || 'raiz'} · relaxação ${node.relaxation_status} · Z=${node.relaxation_objective ?? '—'}`,
      route: '/results/integer', metadata: { nodeId: node.id },
    }));
  }
  events.push(createConsoleEvent({
    id: `${runId}-end`, runId, modelName, recordedAt, category: 'branch_bound',
    level: result.status === 'optimal' ? 'success' : 'warning',
    text: `Branch and Bound: ${result.status}`,
    details: `${result.message || ''} · ${result.explored_nodes ?? 0} nós`,
    route: '/results/integer',
  }));
  return events;
}

export function mergeConsoleEvents(existing, incoming, limit = MAX_EVENTS) {
  const merged = new Map();
  for (const item of [...incoming, ...existing]) {
    if (item?.id && !merged.has(item.id)) merged.set(item.id, item);
  }
  return Array.from(merged.values()).slice(0, limit);
}

export function filterConsoleEvents(events, { query = '', level = 'all', category = 'all', currentRun = 'all' } = {}) {
  const search = query.toLocaleLowerCase('pt-BR').trim();
  return events.filter(event =>
    (level === 'all' || event.level === level)
    && (category === 'all' || event.category === category)
    && (currentRun === 'all' || event.runId === currentRun)
    && (!search || `${event.text} ${event.details} ${event.modelName} ${event.phase}`.toLocaleLowerCase('pt-BR').includes(search)));
}

export function eventsToText(events) {
  return events.map(e => `${e.recordedAt} [${e.category.toUpperCase()}] [${e.level.toUpperCase()}] ${e.text}${e.details ? ` — ${e.details}` : ''}`).join('\n');
}
