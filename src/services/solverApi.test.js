import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeModel, modelFingerprint, solveModel, solveInteger, validateModel,
  solveDual, analyzeAlternatives, calculateGeometry,
  SolverApiError, displayNumber,
} from './solverApi.js';

const sample = {
  name: 'Wyndor',
  sense: 'max',
  variables: ['x₁', 'x₂'],
  objective: [3, 5],
  constraints: [
    { id: 'w1', values: [1, 0], operator: '≤', rhs: 4 },
    { id: 'w2', values: [0, 2], operator: '≤', rhs: 12 },
    { id: 'w3', values: [3, 2], operator: '≤', rhs: 18 },
  ],
  optimum: { x: 99, y: 99, z: 99 },
  integer: { x: 99, y: 99, z: 99 },
};

test('converte a formulação sem enviar soluções demonstrativas', () => {
  const model = normalizeModel(sample);
  assert.deepEqual(model.variables.map(v => v.id), ['x1', 'x2']);
  assert.deepEqual(model.variables.map(v => v.domain), ['continuous', 'continuous']);
  assert.deepEqual(model.constraints.map(v => v.operator), ['le', 'le', 'le']);
  assert.equal(model.constraints[0].coefficients[0], 1);
  assert.equal('optimum' in model, false);
  assert.equal('integer' in model, false);
});

test('fingerprint ignora resultados estáticos e muda quando restrições mudam', () => {
  const changedSeed = { ...sample, optimum: { z: 10 } };
  assert.equal(modelFingerprint(sample), modelFingerprint(changedSeed));
  const changedConstraint = { ...sample, constraints: [{ ...sample.constraints[0], rhs: 8 }, ...sample.constraints.slice(1)] };
  assert.notEqual(modelFingerprint(sample), modelFingerprint(changedConstraint));
});

test('domínio inteiro é enviado na formulação', () => {
  const model = normalizeModel({ ...sample, domain: 'integer' });
  assert.deepEqual(model.variables.map(v => v.domain), ['integer', 'integer']);
});

test('solves envia opções e recebe tableaux reais sem simular', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, req) => {
    assert.match(url, /\/api\/v1\/solves$/);
    const payload = JSON.parse(req.body);
    assert.equal(payload.options.include_trace, true);
    assert.equal(payload.model.constraints.length, 3);
    return { ok: true, json: async () => ({ status: 'optimal', objective_value: 36, iterations: [{ phase: 'phase_2', matrix: [[1, 2]], basis: [] }], pivot_count: 2 }) };
  };
  const result = await solveModel(sample);
  assert.equal(result.objective_value, 36);
  assert.equal(result.iterations.length, 1);
});

test('branch and bound usa opção de integralidade completa', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, req) => {
    const payload = JSON.parse(req.body);
    assert.equal(payload.options.force_all_integer, true);
    return { ok: true, json: async () => ({ status: 'optimal', objective_value: 36, nodes: [{ id: 'P0' }], explored_nodes: 1 }) };
  };
  const result = await solveInteger(sample);
  assert.equal(result.nodes[0].id, 'P0');
});

test('validação HTTP 422 propaga erro por campo', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({ ok: false, status: 422, json: async () => ({ code: 'MODEL_VALIDATION_ERROR', detail: 'Invalid model', errors: [{ field: 'model.objective', message: 'Dimensões inválidas' }] }) });
  await assert.rejects(validateModel(sample), error =>
    error instanceof SolverApiError && error.status === 422 && error.fields[0].field === 'model.objective');
});

test('falha de conexão não é apresentada como solução calculada', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new TypeError('Network failure'); };
  await assert.rejects(solveModel(sample), /Não foi possível conectar/);
});

test('formatação numérica não inventa valores indisponíveis', () => {
  assert.equal(displayNumber(null), '—');
  assert.equal(displayNumber(NaN), '—');
  assert.ok(displayNumber(5.25).includes('5,25'));
});

test('dual envia modelo e solicitação de tableaux reais', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async (url, request) => {
    assert.equal(url.endsWith('/api/v1/solves/dual'), true);
    const payload = JSON.parse(request.body);
    assert.equal(payload.model.objective[0], 3);
    assert.equal(payload.options.include_trace, true);
    return { ok: true, json: async () => ({ status: 'optimal', dual_objective: 36, dual: { iterations: [] } }) };
  };
  assert.equal((await solveDual(sample)).dual_objective, 36);
});

test('diagnóstico exige execução real do servidor', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async (url, request) => {
    assert.equal(url.endsWith('/solves/alternatives'), true);
    const payload = JSON.parse(request.body);
    assert.equal(payload.options.max_bases, 200);
    return { ok: true, json: async () => ({ status: 'multiple', certified: true, alternative: { x1: 1, x2: 3 } }) };
  };
  const result = await analyzeAlternatives(sample);
  assert.equal(result.certified, true);
});

test('geometria envia restrições reais e recebe vértices', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async (url, request) => {
    assert.equal(url.endsWith('/api/v1/geometry'), true);
    assert.equal(JSON.parse(request.body).model.constraints.length, 3);
    return { ok: true, json: async () => ({ status: 'feasible', bounded: true, vertices: [[0, 0], [2, 6]] }) };
  };
  const result = await calculateGeometry(sample);
  assert.equal(result.vertices.length, 2);
});

test('modelo misto preserva variáveis contínuas no Branch and Bound', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.options.force_all_integer, false);
    assert.deepEqual(payload.model.variables.map(v => v.domain), ['integer', 'continuous', 'integer']);
    assert.equal(payload.model.variables[0].lower_bound, null);
    assert.equal(payload.model.variables[1].upper_bound, 12);
    return { ok: true, json: async () => ({ status: 'optimal', objective_value: 7, explored_nodes: 3, nodes: [] }) };
  };
  const model = {
    schema_version: 1, id: 'mix', name: 'Modelo misto', sense: 'max',
    variables: [
      { id: 'x1', name: 'Inteiro livre', domain: 'integer', lower_bound: null, upper_bound: null },
      { id: 'x2', name: 'Contínuo limitado', domain: 'continuous', lower_bound: 0, upper_bound: 12 },
      { id: 'x3', name: 'Inteiro', domain: 'integer', lower_bound: 0, upper_bound: null },
    ],
    objective: [1, 2, 3],
    constraints: [{ id: 'r1', name: 'Capacidade', coefficients: [1, 1, 1], operator: 'le', rhs: 10 }],
  };
  const result = await solveInteger(model);
  assert.equal(result.explored_nodes, 3);
});

test('fingerprint tolera nome temporariamente vazio e limites transitórios inválidos', () => {
  const canonical = {
    schema_version: 1, id: 'draft', name: 'Teste', sense: 'max',
    variables: [{ id: 'x1', domain: 'continuous', lower_bound: 0, upper_bound: 4 }],
    objective: [1],
    constraints: [{ id: 'r1', coefficients: [1], operator: 'le', rhs: 2 }],
  };
  const pristine = modelFingerprint(canonical);
  assert.equal(modelFingerprint({ ...canonical, name: '' }), pristine);
  assert.notEqual(modelFingerprint({
    ...canonical, variables: [{ ...canonical.variables[0], lower_bound: 10 }],
  }), pristine);
});
