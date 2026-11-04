import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNodeRelaxation, describeBranchNode, layoutBranchTree } from './branchTree.js';
import { describeIntegerOverlay, inViewport, projectToSvg, projectedPoint, visibleOptimalFace } from './plotGeometry.js';

const nodes = [
  { id: 'P0', parent_id: null, depth: 0, children: ['P0.L', 'P0.R'], status: 'branched', relaxation_objective: 6.5 },
  { id: 'P0.L', parent_id: 'P0', depth: 1, children: ['P0.L.L'], status: 'branched',
    branch_decision: { variable_id: 'x1', operator: 'le', rhs: 2 }, relaxation_objective: 6 },
  { id: 'P0.L.L', parent_id: 'P0.L', depth: 2, children: [], status: 'integer',
    branch_decision: { variable_id: 'x2', operator: 'ge', rhs: 4 }, relaxation_objective: 5 },
  { id: 'P0.R', parent_id: 'P0', depth: 1, children: [], status: 'pruned_bound',
    branch_decision: { variable_id: 'x1', operator: 'ge', rhs: 3 }, relaxation_objective: 4.8 },
];

const model = {
  name: 'Teste', sense: 'max', variables: [{ id: 'x1', domain: 'integer' }, { id: 'x2', domain: 'integer' }],
  objective: [1, 1], constraints: [{ id: 'r1', coefficients: [1, 1], operator: 'le', rhs: 6 }],
};

test('árvore respeita hierarquia e liga apenas nós registrados', () => {
  const graph = layoutBranchTree(nodes);
  assert.equal(graph.positioned.length, 4);
  assert.equal(graph.edges.length, 3);
  const root = graph.positioned.find(node => node.id === 'P0');
  const left = graph.positioned.find(node => node.id === 'P0.L');
  const right = graph.positioned.find(node => node.id === 'P0.R');
  assert.ok(root.y < left.y && left.y === right.y);
  assert.ok(root.x > left.x && root.x < right.x);
});

test('árvore vazia produz estado seguro', () => {
  assert.deepEqual(layoutBranchTree([]).edges, []);
});

test('tableau do nó recebe as restrições do caminho sem mutar o modelo', () => {
  const local = buildNodeRelaxation(model, nodes, 'P0.L.L');
  assert.equal(local.constraints.length, 3);
  assert.deepEqual(local.constraints[1].coefficients, [1, 0]);
  assert.deepEqual(local.constraints[2].coefficients, [0, 1]);
  assert.equal(local.constraints[1].operator, 'le');
  assert.equal(local.constraints[2].operator, 'ge');
  assert.equal(model.constraints.length, 1);
});

test('nó inexistente não recebe formulação inventada', () => {
  assert.throws(() => buildNodeRelaxation(model, nodes, 'missing'), /Nó não encontrado/);
});

test('nós exibem a condição matemática real de sua exploração', () => {
  const info = describeBranchNode(nodes[2]);
  assert.equal(info.certifiedInteger, true);
  assert.equal(info.branch, 'Relaxação raiz');
  assert.equal(info.label, 'Inteiro viável');
});

test('reconstrução de pontos usa IDs originais das variáveis', () => {
  assert.deepEqual(projectedPoint({ x1: 3, x2: 2 }, model), [3, 2]);
  assert.equal(projectedPoint({ x1: 3 }, model), null);
});

test('ótimo inteiro só é certificado com status optimal', () => {
  const task = { state: 'success', data: { status: 'node_limit', variables: { x1: 1, x2: 4 },
    rounding_candidates: [{ values: { x1: 2, x2: 3 }, feasible: true, objective_value: 5 }] } };
  const result = describeIntegerOverlay(task, model);
  assert.equal(result.certified, false);
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.incumbent, [1, 4]);
});

test('aresta ótima exige certificação de múltiplos ótimos', () => {
  const geometry = { status: 'feasible', optimal_face: [[1, 3], [3, 1]] };
  assert.equal(visibleOptimalFace(geometry, { status: 'undetermined', certified: false }), null);
  assert.deepEqual(visibleOptimalFace(geometry, { status: 'multiple', certified: true }), [[1, 3], [3, 1]]);
});

test('projeção cartográfica mantém os limites do viewport', () => {
  const viewport = { x_min: -2, x_max: 8, y_min: 0, y_max: 10 };
  assert.deepEqual(projectToSvg([-2, 0], viewport, { width: 100, height: 100, padding: 10 }), [10, 90]);
  assert.equal(inViewport([-2, 0], viewport), true);
  assert.equal(inViewport([-4, 0], viewport), false);
});
