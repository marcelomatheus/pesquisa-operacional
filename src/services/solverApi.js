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
  // Keep the signature valid during incomplete edits; strict validation is deferred
  // to normalizeModel() when submitting a request to the API.
  const variables = (model.variables || []).map((variable, index) =>
    typeof variable === 'string'
      ? { id: `x${index + 1}`, domain: model.domain === 'integer' ? 'integer' : 'continuous', lower_bound: 0, upper_bound: null }
      : variable);
  const constraints = (model.constraints || []).map(constraint => ({
    ...constraint, coefficients: constraint.coefficients ?? constraint.values,
  }));
  return mathematicalFingerprint({ ...model, variables, constraints });
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

export function fetchStandardForm(model, options) {
  return request('/models/standard-form', { model: normalizeModel(model) }, options);
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
  const normalized = normalizeModel(model);
  const forceAll = !normalized.variables.some(variable => variable.domain === 'integer');
  return request('/geometry', {
    model: normalized,
    options: { show_integer_lattice: true, force_all_integer: forceAll, max_integer_points: 300 },
  }, options);
}


export async function generateReportPdf(model, options, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/reports/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: normalizeModel(model), options }),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new SolverApiError('Não foi possível conectar ao servidor de relatórios.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const detail = data?.errors?.[0]?.message || data?.detail || `Falha HTTP ${response.status}`;
    throw new SolverApiError(detail, {
      status: response.status, code: data?.code || 'HTTP_ERROR', fields: data?.errors || [],
    });
  }
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/pdf')) {
    throw new SolverApiError('O servidor retornou um formato inválido para o relatório.');
  }
  const document = await response.blob();
  if (!document.size) {
    throw new SolverApiError('O servidor retornou um PDF vazio.');
  }
  if (await document.slice(0, 5).text() !== '%PDF-') {
    throw new SolverApiError('O conteúdo retornado não é um PDF válido.');
  }
  return document;
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
