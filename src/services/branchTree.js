export function layoutBranchTree(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return { positioned: [], edges: [], width: 720, height: 220 };
  const byId = new Map(nodes.map(node => [node.id, node]));
  const children = new Map(nodes.map(node => [node.id, []]));
  for (const node of nodes) {
    if (node.parent_id && children.has(node.parent_id)) children.get(node.parent_id).push(node);
  }
  const roots = nodes.filter(node => !node.parent_id || !byId.has(node.parent_id));
  const positions = new Map();
  let leafIndex = 0;
  const visited = new Set();
  const place = (node, depth) => {
    if (visited.has(node.id)) return positions.get(node.id)?.x ?? 90;
    visited.add(node.id);
    const descendants = children.get(node.id) || [];
    const xs = descendants.map(child => place(child, depth + 1));
    const x = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 95 + leafIndex++ * 180;
    positions.set(node.id, { x, y: 92 + depth * 130, depth });
    return x;
  };
  roots.forEach(root => place(root, 0));
  const positioned = nodes.filter(node => positions.has(node.id)).map(node => ({ ...node, ...positions.get(node.id) }));
  const edges = positioned.filter(node => node.parent_id && positions.has(node.parent_id)).map(node => ({
    from: positions.get(node.parent_id),
    to: positions.get(node.id),
    id: node.id,
  }));
  return {
    positioned,
    edges,
    width: Math.max(720, ...positioned.map(node => node.x + 110)),
    height: Math.max(220, ...positioned.map(node => node.y + 90)),
  };
}

export function buildNodeRelaxation(model, nodes, nodeId) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const path = [];
  const visited = new Set();
  let cursor = byId.get(nodeId);
  if (!cursor) throw new Error('Nó não encontrado na árvore.');
  while (cursor) {
    if (visited.has(cursor.id)) throw new Error('Árvore de busca inválida.');
    visited.add(cursor.id);
    if (cursor.branch_decision) path.unshift({ ...cursor.branch_decision, id: cursor.id });
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : null;
    if (path.length > 1000) throw new Error('Caminho de ramificação muito longo.');
  }
  const constraints = path.map((branch, index) => {
    const variableIndex = model.variables.findIndex(variable => variable.id === branch.variable_id);
    if (variableIndex < 0 || !['le', 'ge'].includes(branch.operator) || !Number.isFinite(branch.rhs)) {
      throw new Error('Metadados de ramificação inválidos.');
    }
    return {
      id: `branch_${index + 1}`,
      name: `Nó ${branch.id}`,
      coefficients: model.variables.map((_, i) => i === variableIndex ? 1 : 0),
      operator: branch.operator,
      rhs: branch.rhs,
    };
  });
  return { ...model, constraints: [...model.constraints, ...constraints] };
}

export const branchNodeLabels = {
  branched: 'Ramificado',
  integer: 'Inteiro viável',
  pruned_bound: 'Poda por limite',
  infeasible: 'Inviável',
  relaxation_unbounded: 'Relaxação ilimitada',
  numerical_error: 'Falha numérica',
  time_limit: 'Tempo limite',
  iteration_limit: 'Limite de iterações',
  processing: 'Em análise',
};

export function describeBranchNode(node) {
  return {
    label: branchNodeLabels[node.status] || node.status,
    branch: node.branch_constraint || 'Relaxação raiz',
    objective: node.relaxation_objective,
    relaxationStatus: node.relaxation_status,
    values: node.relaxation_variables || null,
    certifiedInteger: node.status === 'integer',
  };
}
