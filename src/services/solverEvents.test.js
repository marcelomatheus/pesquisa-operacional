import test from 'node:test';
import assert from 'node:assert/strict';
import { createConsoleEvent, fromSimplexResult, fromBranchBoundResult, mergeConsoleEvents, filterConsoleEvents, eventsToText } from './solverEvents.js';

const at = '2026-11-04T19:00:00.000Z';

test('simplex events preserve tableau navigation and pivot metadata', () => {
  const result = { status: 'optimal', pivot_count: 1, message: 'Optimal', iterations: [
    { phase: 'phase_1', event: 'pivot', pivot: { entering: 'x1', leaving: 'a1', min_ratio: 3 }, row_operations: [{ kind: 'scale' }] },
    { phase: 'phase_2', event: 'optimal' },
  ] };
  const events = fromSimplexResult(result, { runId: 'r1', modelName: 'Teste', recordedAt: at });
  assert.equal(events.length, 4);
  assert.equal(events[1].route, '/results/simplex?step=0');
  assert.equal(events[1].metadata.pivot.entering, 'x1');
  assert.equal(events[1].category, 'simplex');
  assert.equal(events.at(-1).level, 'success');
  assert.ok(events[1].details.includes('1 operações'));
});

test('branch bound status remains noncertified when stopped early', () => {
  const events = fromBranchBoundResult({ status: 'node_limit', explored_nodes: 1,
    nodes: [{ id: 'P0', status: 'branched', branch_constraint: null, relaxation_status: 'optimal', relaxation_objective: 5 }] },
  { runId: 'r2', recordedAt: at });
  assert.equal(events.at(-1).level, 'warning');
  assert.equal(events[1].metadata.nodeId, 'P0');
});

test('merge is stable, deduplicated and bounded', () => {
  const list = Array.from({ length: 5 }, (_, i) => createConsoleEvent({ id: `e${i}`, text: `${i}`, recordedAt: at }));
  assert.deepEqual(mergeConsoleEvents(list, [list[0]], 3).map(x => x.id), ['e0', 'e1', 'e2']);
});

test('filters severity, method and text', () => {
  const list = [createConsoleEvent({ id: 'a', text: 'Pivô x1', category: 'simplex', level: 'info', recordedAt: at }),
    createConsoleEvent({ id: 'b', text: 'Limite', category: 'branch_bound', level: 'warning', recordedAt: at })];
  assert.equal(filterConsoleEvents(list, { category: 'simplex' }).length, 1);
  assert.equal(filterConsoleEvents(list, { level: 'warning', query: 'LIMITE' })[0].id, 'b');
  assert.match(eventsToText(list), /Pivô x1/);
});
