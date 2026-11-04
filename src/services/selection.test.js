import test from 'node:test';
import assert from 'node:assert/strict';
import { asSelection, constraintMetrics, describeSelection } from './selection.js';

const model = {
  name: 'Teste', sense: 'max', objective: [2, 3],
  variables: [{ id: 'x1', domain: 'continuous' }, { id: 'x2', domain: 'integer' }],
  constraints: [{ id: 'r1', name: 'Capacidade', coefficients: [1, 2], operator: 'le', rhs: 10 }],
};

test('legacy and typed selection are normalized', () => {
  assert.deepEqual(asSelection('Função objetivo'), { type: 'objective' });
  assert.deepEqual(asSelection({ type: 'constraint', id: 'r1' }), { type: 'constraint', id: 'r1' });
});

test('constraint metrics correctly calculate slack and activity', () => {
  const r = model.constraints[0];
  const m = constraintMetrics(model, r, { x1: 2, x2: 3 });
  assert.equal(m.lhs, 8);
  assert.equal(m.slack, 2);
  assert.equal(m.active, false);
  assert.equal(constraintMetrics(model, r, { x1: 4, x2: 3 }).active, true);
  assert.equal(constraintMetrics(model, r, { x1: 9, x2: 3 }).feasible, false);
});

test('selection resolves active constraint and tableau context', () => {
  const value = describeSelection(model, { type: 'constraint', id: 'r1' }, { variables: { x1: 4, x2: 3 } });
  assert.equal(value.type, 'constraint');
  assert.equal(value.metrics.slack, 0);
  const trace = [{ phase: 'phase_2', event: 'pivot', matrix: [[-1, 0], [1, 4]] }];
  assert.equal(describeSelection(model, { type: 'tableau', index: 0 }, { iterations: trace }).snapshot.phase, 'phase_2');
});

test('removed entity falls back to model inspection', () => {
  assert.equal(describeSelection(model, { type: 'constraint', id: 'missing' }).type, 'model');
});
