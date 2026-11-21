import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatCount, formatMathEvent, formatMathPhase, formatRegionType,
  formatSolverStatus, translateSolverMessage,
} from './mathPresentation.js';

test('contagens utilizam singular e plural adequados', () => {
  assert.equal(formatCount(0, 'restrição', 'restrições'), '0 restrições');
  assert.equal(formatCount(1, 'restrição', 'restrições'), '1 restrição');
  assert.equal(formatCount(2, 'restrição', 'restrições'), '2 restrições');
  assert.equal(formatCount(1, 'pivoteamento', 'pivoteamentos'), '1 pivoteamento');
  assert.equal(formatCount(0, 'pivoteamento', 'pivoteamentos'), '0 pivoteamentos');
});

test('mensagens do Simplex são traduzidas com seus estados e fases', () => {
  assert.equal(
    translateSolverMessage('Phase II stopped: unbounded'),
    'Fase II interrompida: Problema ilimitado.',
  );
  assert.equal(
    translateSolverMessage('Phase I optimum is negative; no feasible basis exists'),
    'A Fase I não encontrou uma base viável para o modelo.',
  );
  assert.equal(
    translateSolverMessage('Optimal continuous solution certified by tableau'),
    'Solução contínua ótima certificada pelo tableau final.',
  );
});

test('mensagens do Branch and Bound e diagnóstico permanecem certificadas', () => {
  assert.match(
    translateSolverMessage('Node limit reached; incumbent is not certified optimal'),
    /não é um ótimo certificado/,
  );
  assert.match(
    translateSolverMessage('Distinct feasible points with identical objective value were verified'),
    /pontos viáveis distintos/,
  );
  assert.match(translateSolverMessage('Simplex termination was iteration_limit'), /Limite de iterações/);
});

test('fases, eventos, regiões e estados possuem rótulos conhecidos em português', () => {
  assert.equal(formatMathPhase('phase_2'), 'Fase II');
  assert.equal(formatMathEvent('remove_redundant_row'), 'Remoção de linha redundante');
  assert.equal(formatRegionType('polygon'), 'Polígono');
  assert.equal(formatSolverStatus('constraint_limit'), 'Limite interno de restrições');
});

test('mensagens desconhecidas preservam conteúdo técnico original', () => {
  assert.equal(translateSolverMessage('Custom solver detail'), 'Custom solver detail');
  assert.equal(translateSolverMessage(null), '');
});
