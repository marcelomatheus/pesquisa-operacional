/**
 * One adapter between the prototype's view model and the FastAPI contracts.
 * It deliberately sends no seeded optimum/integer values from src/data.js.
 */
const BASE_URL = (import.meta.env?.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export class SolverApiError extends Error {
  constructor(message, { status = 0, code = 'CONNECTION_ERROR', fields = [] } = {}) {
    super(message);
    this.name = 'SolverApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function normalizeModel(model) {
  const objective = model.objective.map(Number);
  return {
    name: model.name?.trim() || 'Modelo sem título',
    sense: model.sense,
    variables: objective.map((_, index) => ({
      id: `x${index + 1}`,
      domain: model.domain === 'integer' ? 'integer' : 'continuous',
      lower_bound: 0,
      upper_bound: null,
    })),
    objective,
    constraints: model.constraints.map((constraint, index) => ({
      id: String(constraint.id ?? `r${index + 1}`).slice(0, 50),
      coefficients: constraint.values.map(Number),
      operator: { '≤': 'le', '≥': 'ge', '=': 'eq' }[constraint.operator] || constraint.operator,
      rhs: Number(constraint.rhs),
    })),
  };
}

export function modelFingerprint(model) {
  // Only mathematical inputs count; seeded outputs and UI color are excluded.
  return JSON.stringify(normalizeModel(model));
}

async function request(path, payload, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new SolverApiError('Não foi possível conectar ao servidor de otimização. Verifique se a API está iniciada.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const fieldMessage = data?.errors?.[0]?.message;
    throw new SolverApiError(fieldMessage || data?.detail || `Falha HTTP ${response.status}`, {
      status: response.status, code: data?.code || 'HTTP_ERROR', fields: data?.errors || [],
    });
  }
  if (!data || typeof data !== 'object') {
    throw new SolverApiError('A API retornou uma resposta inválida.', { code: 'INVALID_RESPONSE' });
  }
  return data;
}

export function validateModel(model, options) {
  return request('/models/validate', { model: normalizeModel(model) }, options);
}

export function solveModel(model, options) {
  return request('/solves', {
    model: normalizeModel(model),
    options: { max_iterations: 500, time_limit: 3, include_trace: true },
  }, options);
}

export function solveInteger(model, options) {
  return request('/solves/integer', {
    model: normalizeModel(model),
    options: { max_nodes: 200, max_iterations: 500, time_limit: 10, force_all_integer: true },
  }, options);
}

export function displayNumber(value, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

export const SOLVE_STATUSES = {
  optimal: 'Solução ótima',
  infeasible: 'Modelo inviável',
  unbounded: 'Problema ilimitado',
  time_limit: 'Tempo limite',
  iteration_limit: 'Limite de iterações',
  node_limit: 'Limite de nós',
  numerical_error: 'Falha numérica',
  unbounded_relaxation: 'Relaxação ilimitada',
};
