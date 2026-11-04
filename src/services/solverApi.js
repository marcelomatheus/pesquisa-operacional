import { mathematicalFingerprint, normalizeModelInput, toApiModel } from './model.js';

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
  return toApiModel(normalizeModelInput(model, { preserveId: true }));
}

export function modelFingerprint(model) {
  return mathematicalFingerprint(normalizeModelInput(model, { preserveId: true }));
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
    options: { max_nodes: 200, max_iterations: 500, time_limit: 10, force_all_integer: !normalizeModel(model).variables.some(variable => variable.domain === 'integer') },
  }, options);
}

export function solveDual(model, options) {
  return request('/solves/dual', {
    model: normalizeModel(model),
    options: { max_iterations: 500, time_limit: 3, include_trace: true },
  }, options);
}

export function analyzeAlternatives(model, options) {
  return request('/solves/alternatives', {
    model: normalizeModel(model),
    options: { max_bases: 200, max_iterations: 500, time_limit: 3, tolerance: 1e-8 },
  }, options);
}

export function calculateGeometry(model, options) {
  return request('/geometry', { model: normalizeModel(model) }, options);
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
