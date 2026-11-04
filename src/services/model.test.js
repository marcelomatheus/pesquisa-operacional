import test from 'node:test';
import assert from 'node:assert/strict';
import { addVariable, createBlankModel, mathematicalFingerprint, modelToJson, normalizeModelInput, parseModelJson, removeVariable, toApiModel, validateModelLocal } from './model.js';
import { formatAlgebraic, parseAlgebraic } from './algebraic.js';

const sample = { name: 'Wyndor', sense: 'max', objective: [3, 5], variables: ['x₁','x₂'], constraints: [
  { name: 'A', values: [1,0], operator: '≤', rhs: 4 },
  { name: 'B', values: [0,2], operator: '≤', rhs: 12 },
  { name: 'C', values: [3,2], operator: '≤', rhs: 18 },
], optimum: { z: 36 } };

test('migrates legacy to a canonical versioned model', () => {
  const m=normalizeModelInput(sample);
  assert.equal(m.schema_version,1);
  assert.deepEqual(m.variables.map(x=>x.id),['x1','x2']);
  assert.deepEqual(m.constraints.map(x=>x.operator), ['le','le','le']);
  assert.equal('optimum' in m,false);
  assert.equal(toApiModel(m).constraints[0].coefficients[0],1);
});

test('rejects NaN, null, coercive numeric strings and incompatible bounds', () => {
  for (const value of ['1', null, NaN, Infinity]) {
    assert.throws(()=>normalizeModelInput({ ...sample,objective:[value,5] }), /número finito/);
  }
  const m=normalizeModelInput(sample);
  m.variables[0].lower_bound=10;m.variables[0].upper_bound=1;
  assert.equal(validateModelLocal(m).valid,false);
});

test('supports mixed variable domains, free and bounded variables', () => {
  const m=normalizeModelInput({ ...sample,variables:[
    {id:'x1',domain:'integer',lower_bound:null,upper_bound:4},
    {id:'x2',domain:'continuous',lower_bound:-5,upper_bound:10},
  ]});
  assert.equal(toApiModel(m).variables[0].lower_bound,null);
  assert.equal(toApiModel(m).variables[1].domain,'continuous');
});

test('maintains rectangular coefficients when adding/removing variables', () => {
  const m=normalizeModelInput(sample);
  const withThird=addVariable(m);
  assert.equal(withThird.objective.length,3);
  assert.equal(withThird.constraints[0].coefficients.length,3);
  const restored=removeVariable(withThird,1);
  assert.equal(restored.variables.length,2);
  assert.deepEqual(restored.constraints[0].coefficients,[1,0]);
});

test('JSON round-trip accepts canonical/API wrapper and rejects invalid inputs', () => {
  const m=normalizeModelInput(sample);
  const json=modelToJson(m);
  const parsed=parseModelJson(json);
  assert.equal(parsed.name,m.name);
  assert.equal(parsed.variables.length,2);
  const api=parseModelJson(JSON.stringify({model:toApiModel(m)}));
  assert.equal(api.objective[0],3);
  assert.throws(()=>parseModelJson('bad'),/JSON inválido/);
  assert.throws(()=>parseModelJson(JSON.stringify({...sample, objective:[3,'5']})),/número finito/);
});

test('fingerprint ignores names/UI metadata while tracking mathematical changes', () => {
  const m=normalizeModelInput(sample);
  assert.equal(mathematicalFingerprint(m),mathematicalFingerprint({...m,name:'Outro nome',constraints:m.constraints.map(c=>({...c,name:'Outro',id:'new'}))}));
  assert.notEqual(mathematicalFingerprint(m),mathematicalFingerprint({...m,objective:[3,6]}));
});

test('parser and formatter round trip Wyndor linear system', () => {
  const m=parseAlgebraic('Max Z = 3x1 + 5x2\nSujeito a:\nx1 <= 4\n2x2 <= 12\n3x1 + 2x2 <= 18');
  assert.equal(m.sense,'max');assert.deepEqual(m.objective,[3,5]);
  assert.deepEqual(m.constraints[1].coefficients,[0,2]);
  const same=parseAlgebraic(formatAlgebraic(m));
  assert.deepEqual(same.constraints.map(x=>x.coefficients),m.constraints.map(x=>x.coefficients));
});

test('parser handles constants, negative coefficients and decimal comma', () => {
  const m=parseAlgebraic('Min Z = 0,4x₁ + 0,5x₂\nx1 + 2x2 + 3 >= 10\n-x1 + x2 = 2');
  assert.deepEqual(m.objective,[.4,.5]);
  assert.equal(m.constraints[0].rhs,7);
  assert.deepEqual(m.constraints[1].coefficients,[-1,1]);
});

test('parser rejects non-linear and arbitrary code, no eval', () => {
  for(const bad of ['Max Z = x1*x2','Max Z = x11', 'Max Z = x1\nalert(1)', 'Max Z = x1\nx1^2 <= 4', 'Max Z = 1']) {
    assert.throws(()=>parseAlgebraic(bad));
  }
});

test('supports no constraints and 10 variables; rejects 11', () => {
  const m=parseAlgebraic('Max Z = x10');
  assert.equal(m.variables.length,10);
  assert.equal(m.constraints.length,0);
  assert.throws(()=>parseAlgebraic('Max Z = x11'));
});
