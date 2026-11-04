import test from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_SECTIONS, reportFileName, reportOptions } from './reportOptions.js';
import { generateReportPdf } from './solverApi.js';

const sample = {
  name: 'Teste',
  sense: 'max',
  variables: [{ id: 'x1', domain: 'continuous', lower_bound: 0, upper_bound: null }],
  objective: [4],
  constraints: [{ id: 'r1', coefficients: [1], operator: 'le', rhs: 8 }],
};

test('relatório oferece seis capítulos técnicos sem duplicidade', () => {
  assert.equal(REPORT_SECTIONS.length, 6);
  assert.equal(new Set(REPORT_SECTIONS.map(section => section.id)).size, 6);
});

test('opções selecionadas geram contrato compatível com a API', () => {
  const options = reportOptions(['model', 'simplex'], {
    maxTableaux: 60, integerMode: 'declared',
  });
  assert.deepEqual(options.sections, ['model', 'simplex']);
  assert.equal(options.max_tableaux, 60);
  assert.equal(options.max_nodes, 200);
});

test('não permite exportar documento sem capítulos', () => {
  assert.throws(() => reportOptions([]), /Selecione pelo menos uma/);
  assert.throws(() => reportOptions(['missing']), /Se lecio|Selecione/);
  assert.throws(() => reportOptions(['model', 'model']), /Selecione/);
});

test('limites de tableaux e modo inteiro são validados', () => {
  assert.throws(() => reportOptions(['model'], { maxTableaux: 101 }), /limite de 1 a 100/);
  assert.throws(() => reportOptions(['model'], { integerMode: 'invalid' }), /Modo de programação inteira/);
});

test('nome do arquivo PDF é seguro para o navegador', () => {
  assert.equal(reportFileName('Radioterapia / Avaliação 2026'), 'pivonauta-radioterapia-avaliacao-2026-relatorio.pdf');
  assert.equal(reportFileName(''), 'pivonauta-modelo-relatorio.pdf');
});

test('geração PDF utiliza JSON canônico e recebe bytes binários', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  let captured;
  globalThis.fetch = async (url, request) => {
    assert.ok(url.endsWith('/api/v1/reports/pdf'));
    captured = JSON.parse(request.body);
    return {
      ok: true, headers: { get: () => 'application/pdf' },
      blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    };
  };
  const blob = await generateReportPdf(sample, reportOptions(['model', 'simplex']));
  assert.equal(blob.type, 'application/pdf');
  assert.equal(captured.model.objective[0], 4);
  assert.equal(captured.options.sections[1], 'simplex');
});

test('falha HTTP da geração de PDF propaga validação detalhada', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async () => ({
    ok: false, status: 422,
    json: async () => ({ detail: 'Model invalid', code: 'MODEL_VALIDATION_ERROR',
      errors: [{ field: 'model.objective', message: 'Coeficiente inválido' }] }),
  });
  await assert.rejects(generateReportPdf(sample, reportOptions(['model'])), /Coeficiente inválido/);
});

test('formato incorreto não é aceito como PDF', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => 'text/html' },
    blob: async () => new Blob(['not a pdf'], { type: 'text/html' }),
  });
  await assert.rejects(generateReportPdf(sample, reportOptions(['model'])), /formato inválido/);
});

test('PDF vazio é rejeitado', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => 'application/pdf' },
    blob: async () => new Blob([], { type: 'application/pdf' }),
  });
  await assert.rejects(generateReportPdf(sample, reportOptions(['model'])), /PDF vazio/);
});
