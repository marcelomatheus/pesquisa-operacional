export function asSelection(value) {
  if (value && typeof value === 'object' && typeof value.type === 'string') return value;
  if (value === 'Função objetivo') return { type: 'objective' };
  if (value === 'Conjunto de restrições') return { type: 'constraints' };
  if (value === 'Domínio das variáveis') return { type: 'variables' };
  if (value === 'Resultado do modelo') return { type: 'result' };
  if (value === 'Revisão da formulação') return { type: 'review' };
  return { type: 'model' };
}

export function constraintMetrics(model, constraint, values, tolerance = 1e-7) {
  if (!constraint || !values) return null;
  const entries = model.variables.map((variable, index) => [variable.id, constraint.coefficients[index]]);
  if (entries.some(([name, coefficient]) => !Number.isFinite(values[name]) || !Number.isFinite(coefficient))) return null;
  const lhs = entries.reduce((sum, [name, coefficient]) => sum + values[name] * coefficient, 0);
  const delta = constraint.rhs - lhs;
  const scale = tolerance * (1 + Math.abs(constraint.rhs) + entries.reduce((sum, [name, coefficient]) => sum + Math.abs(coefficient * values[name]), 0));
  const feasible = constraint.operator === 'le' ? delta >= -scale
    : constraint.operator === 'ge' ? delta <= scale : Math.abs(delta) <= scale;
  return { lhs, rhs: constraint.rhs, slack: constraint.operator === 'le' ? delta
    : constraint.operator === 'ge' ? -delta : Math.abs(delta), active: Math.abs(delta) <= scale, feasible };
}

export function describeSelection(model, selection, result, integerTask) {
  const target = asSelection(selection);
  if (target.type === 'constraint') {
    const constraint = model.constraints.find(item => item.id === target.id);
    if (!constraint) return { type: 'model', title: model.name };
    return { type: 'constraint', title: constraint.name || constraint.id,
      constraint, metrics: constraintMetrics(model, constraint, result?.variables) };
  }
  if (target.type === 'variable') {
    const variable = model.variables.find(item => item.id === target.id);
    if (!variable) return { type: 'model', title: model.name };
    const index = model.variables.indexOf(variable);
    return { type: 'variable', title: variable.id, variable, index,
      coefficient: model.objective[index], value: result?.variables?.[variable.id] ?? null };
  }
  if (target.type === 'tableau') {
    const snapshot = target.snapshot || result?.iterations?.[target.index];
    if (!snapshot) return { type: 'model', title: model.name };
    return { type: 'tableau', title: `${target.source === 'dual' ? 'Dual' : 'Simplex'} · etapa ${(target.index ?? 0) + 1}`,
      snapshot, index: target.index ?? 0, row: target.row ?? null, column: target.column ?? null };
  }
  if (target.type === 'branch_node') {
    const node = integerTask?.data?.nodes?.find(item => item.id === target.id);
    if (!node) return { type: 'model', title: model.name };
    return { type: 'branch_node', title: `Nó ${node.id}`, node };
  }
  const titles = {
    objective: 'Função objetivo', constraints: 'Conjunto de restrições',
    variables: 'Domínio das variáveis', result: 'Resultado contínuo',
    review: 'Revisão da formulação', model: model.name,
  };
  return { type: target.type, title: titles[target.type] || model.name };
}
