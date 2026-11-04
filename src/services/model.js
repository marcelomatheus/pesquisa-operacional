/** A single versioned representation of linear programs in the PivôNauta UI. */
export const SCHEMA_VERSION = 1;
export const MAX_VARIABLES = 10;
export const MAX_CONSTRAINTS = 30;
const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const asOperator = value => ({ '≤': 'le', '<=': 'le', '≥': 'ge', '>=': 'ge', '=': 'eq' }[value] || value);
const copy = value => JSON.parse(JSON.stringify(value));
export const newId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

function numeric(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field}: informe um número finito.`);
  return value;
}
function nullableNumeric(value, field, fallback) {
  const actual = value === undefined ? fallback : value;
  return actual === null ? null : numeric(actual, field);
}
function checkId(value, field) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value) || value.length > 50) {
    throw new Error(`${field}: o identificador deve começar com letra e conter apenas letras, números ou _.`);
  }
  return value;
}
function variableId(value, index) {
  if (typeof value !== 'string') return `x${index + 1}`;
  return /^x[\u2080-\u2089]+$/.test(value)
    ? value.replace(/[\u2080-\u2089]/g, c => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)))
    : (/^x_\d+$/.test(value) ? value.replace('_', '') : value);
}

/** Validate and migrate the older two-variable examples and the FastAPI model payload. */
export function normalizeModelInput(source, { preserveId = false } = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('O JSON deve conter um objeto de modelo.');
  const input = source.model && typeof source.model === 'object' ? source.model : source;
  if (input.schema_version !== undefined && input.schema_version !== SCHEMA_VERSION) {
    throw new Error(`Versão JSON não suportada: ${input.schema_version}. Utilize schema_version: 1.`);
  }
  if (!Array.isArray(input.objective) || input.objective.length < 1 || input.objective.length > MAX_VARIABLES) {
    throw new Error('A função objetivo deve conter entre 1 e 10 coeficientes.');
  }
  const objective = input.objective.map((n, index) => numeric(n, `Objetivo x${index + 1}`));
  const count = objective.length;
  const rawVariables = input.variables ?? Array.from({ length: count }, (_, i) => `x${i + 1}`);
  if (!Array.isArray(rawVariables) || rawVariables.length !== count) throw new Error('Quantidade de variáveis diferente da função objetivo.');
  const variables = rawVariables.map((v, i) => {
    const raw = typeof v === 'string' ? { id: variableId(v, i) } : v;
    if (!raw || typeof raw !== 'object') throw new Error(`Variável ${i + 1}: formato inválido.`);
    const id = checkId(variableId(raw.id, i), `Variável ${i + 1}`);
    const domain = raw.domain ?? (input.domain === 'integer' ? 'integer' : 'continuous');
    if (!['integer', 'continuous'].includes(domain)) throw new Error(`Variável ${id}: domínio inválido.`);
    const lower_bound = nullableNumeric(raw.lower_bound, `Limite inferior ${id}`, 0);
    const upper_bound = nullableNumeric(raw.upper_bound, `Limite superior ${id}`, null);
    if (lower_bound !== null && upper_bound !== null && lower_bound > upper_bound) {
      throw new Error(`Variável ${id}: o limite inferior supera o superior.`);
    }
    return { id, name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : id, domain, lower_bound, upper_bound };
  });
  if (new Set(variables.map(v => v.id)).size !== count) throw new Error('Os identificadores das variáveis devem ser únicos.');
  if (input.sense !== 'min' && input.sense !== 'max') throw new Error('O sentido deve ser min ou max.');
  const constraintsRaw = input.constraints ?? [];
  if (!Array.isArray(constraintsRaw) || constraintsRaw.length > MAX_CONSTRAINTS) throw new Error('Máximo de 30 restrições.');
  const constraints = constraintsRaw.map((con, index) => {
    if (!con || typeof con !== 'object') throw new Error(`Restrição ${index + 1}: formato inválido.`);
    const coeff = con.coefficients ?? con.values;
    if (!Array.isArray(coeff) || coeff.length !== count) throw new Error(`Restrição ${index + 1}: esperados ${count} coeficientes.`);
    const operator = asOperator(con.operator);
    if (!['le', 'ge', 'eq'].includes(operator)) throw new Error(`Restrição ${index + 1}: operador inválido.`);
    const id = con.id !== undefined && ID_PATTERN.test(con.id) && con.id.length <= 50 ? con.id : `r${index + 1}`;
    return {
      id,
      name: typeof con.name === 'string' ? con.name.slice(0, 80) : `Restrição ${index + 1}`,
      coefficients: coeff.map((x, j) => numeric(x, `Restrição ${index + 1}, x${j + 1}`)),
      operator, rhs: numeric(con.rhs, `Restrição ${index + 1}, RHS`),
    };
  });
  if (new Set(constraints.map(v => v.id)).size !== constraints.length) {
    // Older examples may have repeated/unreliable identifiers; repair them deterministically.
    constraints.forEach((c, i) => { c.id = `r${i + 1}`; });
  }
  const name = typeof input.name === 'string' ? input.name.trim() : 'Modelo sem título';
  if (!name || name.length > 120) throw new Error('O nome do modelo deve ter de 1 a 120 caracteres.');
  return {
    schema_version: SCHEMA_VERSION,
    id: preserveId && typeof input.id === 'string' && input.id ? input.id : newId('model'),
    name, sense: input.sense, variables, objective, constraints,
  };
}

export function toApiModel(model) {
  return {
    name: model.name, sense: model.sense, objective: [...model.objective],
    variables: model.variables.map(({ id, domain, lower_bound, upper_bound }) => ({ id, domain, lower_bound, upper_bound })),
    constraints: model.constraints.map(({ id, coefficients, operator, rhs }) => ({ id, coefficients: [...coefficients], operator, rhs })),
  };
}

export function mathematicalFingerprint(model) {
  // Deliberately ignores title, descriptions, IDs of constraints and UI metadata.
  return JSON.stringify({
    sense: model.sense,
    variables: model.variables.map(({ id, domain, lower_bound, upper_bound }) => [id, domain, lower_bound, upper_bound]),
    objective: model.objective,
    constraints: model.constraints.map(({ coefficients, operator, rhs }) => [coefficients, operator, rhs]),
  });
}

export function modelToJson(model) {
  return JSON.stringify({ schema_version: SCHEMA_VERSION, ...copy(model) }, null, 2);
}

export function parseModelJson(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (error) { throw new Error(`JSON inválido: ${error.message}`); }
  return normalizeModelInput(parsed, { preserveId: false });
}

export function validateModelLocal(model) {
  try { normalizeModelInput(model, { preserveId: true }); return { valid: true, errors: [] }; }
  catch (error) { return { valid: false, errors: [error.message] }; }
}

export function createBlankModel() {
  return normalizeModelInput({
    name: 'Modelo sem título', sense: 'max', objective: [1, 1],
    variables: [{ id: 'x1' }, { id: 'x2' }],
    constraints: [
      { id: 'r1', name: 'Limite combinado', coefficients: [1, 1], operator: 'le', rhs: 10 },
      { id: 'r2', name: 'Capacidade de x1', coefficients: [1, 0], operator: 'le', rhs: 8 },
    ],
  });
}

export function addVariable(model) {
  if (model.variables.length >= MAX_VARIABLES) throw new Error('Limite de 10 variáveis atingido.');
  const indices = new Set(model.variables.map(v => v.id));
  let next = 1;
  while (indices.has(`x${next}`)) next++;
  const id = `x${next}`;
  return { ...model, variables: [...model.variables, { id, name: id, domain: 'continuous', lower_bound: 0, upper_bound: null }],
    objective: [...model.objective, 0], constraints: model.constraints.map(c => ({ ...c, coefficients: [...c.coefficients, 0] })) };
}

export function removeVariable(model, index) {
  if (model.variables.length <= 1) throw new Error('É necessário manter pelo menos uma variável.');
  return { ...model,
    variables: model.variables.filter((_, i) => i !== index),
    objective: model.objective.filter((_, i) => i !== index),
    constraints: model.constraints.map(c => ({ ...c, coefficients: c.coefficients.filter((_, i) => i !== index) })),
  };
}
