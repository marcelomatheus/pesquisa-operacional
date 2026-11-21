import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const wyndor = {
  schema_version: 1,
  name: 'Wyndor E2E',
  sense: 'max',
  variables: [
    { id: 'x1', domain: 'continuous', lower_bound: 0, upper_bound: null },
    { id: 'x2', domain: 'continuous', lower_bound: 0, upper_bound: null },
  ],
  objective: [3, 5],
  constraints: [
    { id: 'r1', coefficients: [1, 0], operator: 'le', rhs: 4 },
    { id: 'r2', coefficients: [0, 2], operator: 'le', rhs: 12 },
    { id: 'r3', coefficients: [3, 2], operator: 'le', rhs: 18 },
  ],
};

async function importModel(page, model = wyndor) {
  await page.goto('/#/editor');
  await page.getByRole('tab', { name: 'Importar JSON' }).click();
  await page.getByRole('textbox', { name: 'Modelo JSON' }).fill(JSON.stringify(model));
  await page.getByRole('button', { name: 'Validar e pré-visualizar' }).click();
  await expect(page.getByText('Pré-visualização validada')).toBeVisible();
  await page.getByRole('button', { name: 'Aplicar formulação' }).click();
  await expect(page.locator('main .model-name-input')).toHaveValue(model.name);
  await expect(page.getByRole('button', { name: 'Revisar modelo' })).toBeEnabled();
}

async function solveModel(page) {
  await page.getByRole('button', { name: 'Revisar modelo' }).click();
  await expect(page.getByRole('button', { name: 'Resolver modelo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Resolver modelo' }).click();
  await expect(page.getByRole('heading', { name: 'Resultado da otimização' })).toBeVisible();
  await expect(page.getByText(/Valor objetivo: Z = 36/)).toBeVisible();
}

test('importação JSON, validação, Simplex e tableaux reais', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await importModel(page);
  await solveModel(page);
  await page.goto('/#/results/simplex');
  await expect(page.getByRole('heading', { name: 'Simplex tabular' })).toBeVisible();
  await expect(page.locator('.pr5-tableau-viewer .tableau')).toBeVisible();
  await expect(page.getByText('Transformações elementares')).toBeVisible();
  expect(errors).toEqual([]);
});

test('geometria, dualidade, múltiplos ótimos e Branch and Bound respondem', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await importModel(page);
  await solveModel(page);
  await page.goto('/#/results/graph');
  await expect(page.locator('.pr6-plot svg')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Curvas de nível' })).toBeVisible();
  await page.goto('/#/results/dual');
  await expect(page.getByRole('heading', { name: 'Modelo dual' })).toBeVisible();
  await expect(page.getByText(/Dualidade forte verificada/)).toBeVisible();
  await page.goto('/#/results/analysis');
  await expect(page.getByRole('heading', { name: 'Ótimos múltiplos' })).toBeVisible();
  await expect(page.getByText(/Ótimo único|Múltiplos ótimos comprovados|Análise inconclusiva/)).toBeVisible();
  await page.goto('/#/results/integer');
  await expect(page.getByText('Nós reais da busca')).toBeVisible();
  await expect(page.locator('.pr6-tree-node').first()).toBeVisible();
  expect(failures).toEqual([]);
});

test('relatório PDF é baixado e possui assinatura correta', async ({ page }) => {
  await importModel(page);
  await solveModel(page);
  await page.goto('/#/results/report');
  await expect(page.getByRole('heading', { name: 'Relatório técnico em PDF' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Programação inteira/ }).uncheck();
  await page.getByRole('checkbox', { name: /Modelo dual/ }).uncheck();
  await page.getByRole('checkbox', { name: /Ótimos alternativos/ }).uncheck();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Exportar PDF/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/pivonauta-wyndor-e2e-relatorio\.pdf$/);
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(2000);
});

test('JSON inválido não altera modelo e biblioteca recupera o salvo', async ({ page }) => {
  await importModel(page);
  await page.getByRole('tab', { name: 'Importar JSON' }).click();
  await page.getByRole('textbox', { name: 'Modelo JSON' }).fill('{"objective":[1,2],"sense":"max",');
  await page.getByRole('button', { name: 'Validar e pré-visualizar' }).click();
  await expect(page.getByRole('alert')).toContainText('JSON inválido');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('main .model-name-input')).toHaveValue('Wyndor E2E');
  await page.goto('/#/library');
  await page.getByRole('button', { name: 'Salvar modelo ativo' }).click();
  await expect(page.getByRole('heading', { name: 'Wyndor E2E' })).toBeVisible();
  await page.reload();
  await page.goto('/#/editor');
  await expect(page.locator('main .model-name-input')).toHaveValue('Wyndor E2E');
});

test('editor algébrico altera coeficientes sem executar texto arbitrário', async ({ page }) => {
  await importModel(page);
  await page.getByRole('tab', { name: 'Editor algébrico' }).click();
  await page.getByRole('textbox', { name: 'Expressões algébricas' }).fill(
    'Max Z = 3x1 + 5x2\nx1 <= 4\n2x2 <= 12\n3x1 + 2x2 <= 18'
  );
  await page.getByRole('button', { name: 'Validar e pré-visualizar' }).click();
  await expect(page.getByText('Pré-visualização validada')).toBeVisible();
  await page.getByRole('button', { name: 'Aplicar formulação' }).click();
  await expect(page.getByRole('button', { name: 'Revisar modelo' })).toBeEnabled();
});

test('API desconectada produz erro visível, sem inventar resultado', async ({ page }) => {
  await importModel(page);
  await page.route('**/api/v1/solves', async route => route.abort('failed'));
  await page.getByRole('button', { name: 'Revisar modelo' }).click();
  await page.getByRole('button', { name: 'Resolver modelo' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar');
  await expect(page).toHaveURL(/#\/review$/);
});

test('páginas permanecem acessíveis no viewport de dispositivo móvel', async ({ page }) => {
  await page.goto('/#/editor');
  await expect(page.locator('main .model-name-input')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisar modelo' })).toBeVisible();
  await page.goto('/#/results/report');
  await expect(page.getByRole('heading', { name: 'Relatório técnico em PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Exportar PDF/ })).toBeVisible();
});


test('editor visual ocupa a largura útil em desktop e mobile', async ({ page }) => {
  for (const width of [1366, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/#/editor');
    const node = page.locator('.equation-node--constraints');
    const content = node.locator('.node-content');
    await expect(node).toBeVisible();
    const box = await node.boundingBox();
    const contentBox = await content.boundingBox();
    expect(contentBox.width, `conteúdo comprimido a ${width}px`).toBeGreaterThan(box.width - 75);
    await expect(content.locator('input').first()).toBeVisible();
  }
});

test('botões do editor permanecem integralmente visíveis a partir de 320px', async ({ page }) => {
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#/editor');
    for (const label of ['Exportar JSON', 'Revisar modelo']) {
      const button = page.getByRole('button', { name: label });
      await expect(button).toBeVisible();
      const bounds = await button.boundingBox();
      expect(bounds.x, `${label} começa fora da tela a ${width}px`).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width, `${label} ultrapassa a tela a ${width}px`).toBeLessThanOrEqual(width);
      expect(bounds.height, `${label} tem alvo de toque pequeno`).toBeGreaterThanOrEqual(44);
    }
  }
});

test('dualidade apresenta le, ge e eq como relações reais, nunca undefined', async ({ page }) => {
  const mixedRelations = {
    ...wyndor,
    name: 'Relações E2E',
    constraints: [
      { id: 'r1', coefficients: [1, 0], operator: 'le', rhs: 4 },
      { id: 'r2', coefficients: [0, 1], operator: 'ge', rhs: 1 },
      { id: 'r3', coefficients: [1, 1], operator: 'eq', rhs: 5 },
    ],
  };
  await importModel(page, mixedRelations);
  await page.goto('/#/results/dual');
  const primal = page.locator('.dual-model--primal');
  await expect(primal).toBeVisible();
  await expect(page.getByText('Dualidade forte verificada')).toBeVisible();
  const lines = await primal.innerText();
  expect(lines).not.toContain('undefined');
  expect(lines).toContain('≤');
  expect(lines).toContain('≥');
  expect(lines).toContain('=');
});

test('importação aplica rascunho imediatamente, mesmo sem aguardar debounce', async ({ page }) => {
  await importModel(page);
  await page.reload();
  await expect(page.locator('main .model-name-input')).toHaveValue('Wyndor E2E');
});

test('salvar na biblioteca confirma também persistência imediata do modelo ativo', async ({ page }) => {
  await importModel(page);
  await page.goto('/#/library');
  await page.getByRole('button', { name: 'Salvar modelo ativo' }).click();
  await expect(page.getByRole('heading', { name: 'Wyndor E2E' })).toBeVisible();
  await page.reload();
  await page.goto('/#/editor');
  await expect(page.locator('main .model-name-input')).toHaveValue('Wyndor E2E');
  await page.goto('/#/library');
  await expect(page.getByRole('heading', { name: 'Wyndor E2E' })).toBeVisible();
});
