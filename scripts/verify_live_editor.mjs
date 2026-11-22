import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = 'https://pivonauta.celodev.com.br';
const sizes = [320, 375, 390, 768, 1024, 1366];
const report = { base, checkedAt: new Date().toISOString(), checks: [] };
let errors = 0;

await mkdir('validation-artifacts/live-editor', { recursive: true });

const versionResponse = await fetch(base + '/api/v1/health/ready', { signal: AbortSignal.timeout(20000) });
let version;
try { version = await versionResponse.json(); } catch { version = null; }
const apiCheck = { test: 'api-version', http: versionResponse.status, version: version?.version ?? null, status: version?.status ?? null };
apiCheck.passed = apiCheck.http === 200 && apiCheck.status === 'ready';
report.checks.push(apiCheck);
console.log('LIVE_EDITOR_CHECK ' + JSON.stringify(apiCheck));
if (!apiCheck.passed) errors++;

const browser = await chromium.launch({ headless: true });
for (const width of sizes) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, locale: 'pt-BR' });
  const page = await context.newPage();
  const jsErrors = [];
  page.on('pageerror', error => jsErrors.push(error.message));
  const data = { test: 'visual-grid', width };
  try {
    const response = await page.goto(base + '/#/editor', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.locator('.equation-node--constraints .node-content').waitFor({ timeout: 20000 });
    await page.locator('.model-name-input').waitFor({ timeout: 20000 });
    await page.waitForTimeout(300);
    const rendered = await page.evaluate(() => {
      const selectors = ['.equation-node--objective', '.equation-node--constraints', '.equation-node--domain'];
      const nodes = selectors.map(selector => {
        const node = document.querySelector(selector);
        if (!node) return { selector, missing: true };
        const content = node.querySelector('.node-content');
        const outer = node.getBoundingClientRect();
        const inside = content?.getBoundingClientRect();
        return {
          selector,
          outerWidth: Math.round(outer.width * 100) / 100,
          innerWidth: inside ? Math.round(inside.width * 100) / 100 : null,
          columnDefinition: getComputedStyle(node).gridTemplateColumns,
          contentVisible: Boolean(inside?.width),
          contentRight: inside?.right ?? null,
          nodeRight: outer.right,
          childCount: node.children.length,
        };
      });
      const buttons = [...document.querySelectorAll('.editor-status button')].map(button => {
        const bounds = button.getBoundingClientRect();
        return { label: button.innerText.trim(), x: bounds.x, right: bounds.right, height: bounds.height, width: bounds.width };
      });
      return { nodes, buttons, documentWidth: document.documentElement.scrollWidth, viewport: innerWidth };
    });
    const gridPassed = rendered.nodes.every(node =>
      !node.missing && node.childCount === 2 && node.contentVisible &&
      node.innerWidth >= node.outerWidth - 75 && node.contentRight <= node.nodeRight + 1
    );
    const buttonsPassed = rendered.buttons.every(button =>
      button.x >= -1 && button.right <= width + 1 && button.height >= 43
    );
    const screenshot = 'validation-artifacts/live-editor/editor-' + width + '.png';
    await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
    Object.assign(data, { http: response?.status(), gridPassed, buttonsPassed, rendered, screenshot, jsErrors });
    data.passed = data.http === 200 && gridPassed && buttonsPassed && jsErrors.length === 0;
  } catch (error) {
    data.passed = false;
    data.error = String(error.message || error);
  }
  report.checks.push(data);
  console.log('LIVE_EDITOR_CHECK ' + JSON.stringify(data));
  if (!data.passed) errors++;
  await context.close();
}
await browser.close();
console.log('LIVE_EDITOR_SUMMARY ' + JSON.stringify({
  total: report.checks.length,
  passed: report.checks.length - errors,
  failed: errors,
  apiVersion: apiCheck.version,
  checkedAt: report.checkedAt,
}));
if (errors) process.exitCode = 1;
