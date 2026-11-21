import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const host = process.env.TARGET_URL || 'https://pivonauta.celodev.com.br';
const outDir = 'validation-artifacts/live-audit';
await fs.mkdir(outDir, { recursive: true });
const records = [];
let browser;

function makeModel(name, sense, objective, rows, domains, bounds) {
  return {
    schema_version: 1, name, sense, objective,
    variables: objective.map((_, i) => ({
      id: 'x' + (i + 1), domain: domains?.[i] || 'continuous',
      lower_bound: bounds?.[i]?.[0] === null ? null : (bounds?.[i]?.[0] ?? 0),
      upper_bound: bounds?.[i]?.[1] ?? null,
    })),
    constraints: rows.map((row, i) => ({
      id: 'r' + (i + 1), coefficients: row[0], operator: row[1], rhs: row[2],
    })),
  };
}
const scenarios = {
  wyndor: makeModel('Wyndor audit', 'max', [3, 5], [
    [[1, 0], 'le', 4], [[0, 2], 'le', 12], [[3, 2], 'le', 18],
  ]),
  radiotherapy: makeModel('Radioterapia audit', 'min', [0.4, 0.5], [
    [[0.3, 0.1], 'le', 2.7], [[0.5, 0.5], 'eq', 6], [[0.6, 0.4], 'ge', 6],
  ], ['integer', 'integer']),
  multiple: makeModel('Otimos multiplos audit', 'max', [1, 1], [
    [[1, 1], 'le', 4], [[1, 0], 'le', 4], [[0, 1], 'le', 4],
  ]),
  infeasible: makeModel('Inviavel audit', 'max', [1, 1], [
    [[1, 0], 'le', 1], [[1, 0], 'ge', 3],
  ]),
  unbounded: makeModel('Ilimitado audit', 'max', [1, 1], [
    [[1, -1], 'le', 1],
  ]),
  single: makeModel('Uma variavel audit', 'max', [2], [[[1], 'le', 7]]),
  three: makeModel('Tres variaveis audit', 'max', [1, 2, 3], [
    [[1, 0, 0], 'le', 2], [[0, 1, 0], 'le', 2],
    [[0, 0, 1], 'le', 2], [[1, 1, 1], 'le', 4],
  ]),
  bounded: makeModel('Bound audit', 'max', [1], [], undefined, [[1, 3]]),
  negative: makeModel('Min negativo audit', 'min', [-1, -2], [[[1, 1], 'le', 3]]),
  mixed: makeModel('Misto audit', 'max', [3, 2], [
    [[2, 1], 'le', 7], [[1, 2], 'le', 8],
  ], ['integer', 'continuous']),
};
scenarios.twelveRows = makeModel('Dual 12 restricoes', 'max', [1, 1], [
  [[1, 0], 'le', 5], [[0, 1], 'le', 3],
  ...Array.from({ length: 10 }, () => [[1, 1], 'le', 100]),
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function test(name, kind, fn) {
  const start = Date.now();
  try {
    const info = await fn();
    const record = {name, kind, status:'PASS', ms:Date.now()-start, info:info||{}};
    records.push(record);
    console.log('AUDIT_PASS ' + JSON.stringify(record));
  } catch (error) {
    const record = {name, kind, status:'FAIL', ms:Date.now()-start, error:String(error?.stack||error)};
    records.push(record);
    console.log('AUDIT_FAIL ' + JSON.stringify(record));
  }
}
async function request(route, body, method) {
  const before=Date.now();
  const payload = body?.model ? {...body, model:{...body.model}} : body;
  if (payload?.model) delete payload.model.schema_version;
  const response=await fetch(host + route, {
    method:method||'POST',
    ...(payload===undefined ? {} : {headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),
    signal:AbortSignal.timeout(22000),
  });
  const bytes=Buffer.from(await response.arrayBuffer());
  const type=response.headers.get('content-type')||'';
  let data=null;
  if(type.includes('json')){try{data=JSON.parse(bytes.toString('utf8'));}catch{}}
  return {status:response.status,type,bytes,data,ms:Date.now()-before};
}
async function screenshot(page,name) {
  const filename=outDir+'/'+name+'.png';
  try{await page.screenshot({path:filename,fullPage:true,animations:'disabled',timeout:9000});}
  catch(err){return 'screenshot-error: '+err.message;}
  return filename;
}
async function inBrowser(name, fn, viewport) {
  const context=await browser.newContext({
    viewport:viewport||{width:1366,height:850},
    acceptDownloads:true,locale:'pt-BR',timezoneId:'America/Sao_Paulo',
  });
  const page=await context.newPage();
  const javascriptErrors=[],httpErrors=[],consoleErrors=[];
  page.on('pageerror',e=>javascriptErrors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(host)&&r.status()>=500)httpErrors.push(r.status()+' '+r.url());});
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,300));});
  await test(name,'BROWSER',async()=>{
    try{
      const data=await fn(page);
      const screen=await screenshot(page,name);
      const metrics=await page.evaluate(()=>({
        viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        title:document.title,
      }));
      assert(!javascriptErrors.length,'JS errors: '+JSON.stringify(javascriptErrors));
      assert(!httpErrors.length,'HTTP 5xx: '+JSON.stringify(httpErrors));
      return {...data,screenshot:screen,metrics,consoleErrors:consoleErrors.slice(0,5)};
    }catch(error){
      const screen=await screenshot(page,name+'-failure');
      throw new Error(error.message+'; screenshot='+screen+'; js='+JSON.stringify(javascriptErrors)+'; http='+JSON.stringify(httpErrors)+'; console='+JSON.stringify(consoleErrors.slice(0,5)));
    }
  });
  await context.close();
}
async function importModel(page, data) {
  await page.goto(host+'/#/editor',{waitUntil:'domcontentloaded',timeout:22000});
  await page.getByRole('tab',{name:'Importar JSON'}).click({timeout:15000});
  await page.getByRole('textbox',{name:'Modelo JSON'}).fill(JSON.stringify(data));
  await page.getByRole('button',{name:'Validar e pré-visualizar'}).click();
  await page.getByText('Pré-visualização validada').waitFor({timeout:16000});
  await page.getByRole('button',{name:'Aplicar formulação'}).click();
  const name=await page.locator('main .model-name-input').inputValue();
  assert(name===data.name,'Editor did not apply '+data.name+': '+name);
}
async function solveUI(page) {
  await page.getByRole('button',{name:'Revisar modelo'}).click();
  await page.getByRole('button',{name:'Resolver modelo'}).click();
  await page.getByRole('heading',{name:'Resultado da otimização'}).waitFor({timeout:25000});
  return (await page.locator('main').innerText()).slice(0,2400);
}

await test('Homepage HTTP', 'HTTP',async()=>{
  const r=await fetch(host+'/',{signal:AbortSignal.timeout(18000)});
  const html=await r.text();
  assert(r.status===200,'HTTP '+r.status+': '+html.slice(0,250));
  assert(html.includes('id="root"'),'HTML sem root: '+html.slice(0,250));
  return {status:r.status,bytes:html.length};
});
await test('Health API', 'HTTP',async()=>{
  const r=await request('/api/v1/health/ready',undefined,'GET');
  assert(r.status===200,'HTTP '+r.status+' '+JSON.stringify(r.data));
  assert(r.data?.status==='ready','API não pronta');
  return {status:r.status,ms:r.ms,version:r.data?.version};
});
for(const [name,key,status,z] of [
  ['Wyndor max','wyndor','optimal',36],
  ['Radioterapia min','radiotherapy','optimal',5.25],
  ['Uma variável','single','optimal',14],
  ['Três variáveis','three','optimal',10],
  ['Limites individuais','bounded','optimal',3],
  ['Objetivo negativo','negative','optimal',-6],
  ['Problema inviável','infeasible','infeasible',null],
  ['Problema ilimitado','unbounded','unbounded',null],
  ['Ótimos múltiplos simplex','multiple','optimal',4],
]){
 await test('Simplex '+name,'API-MATH',async()=>{
   const r=await request('/api/v1/solves',{model:scenarios[key],options:{include_trace:true,time_limit:3}});
   assert(r.status===200,'HTTP '+r.status+': '+JSON.stringify(r.data).slice(0,400));
   assert(r.data?.status===status,'Status esperado '+status+', recebido '+r.data?.status);
   if(z!==null)assert(Math.abs(r.data.objective_value-z)<1e-6,'Objetivo esperado '+z+', recebido '+r.data?.objective_value);
   return {status:r.data.status,z:r.data.objective_value,pivots:r.data.pivot_count,tableaux:r.data.iterations?.length,ms:r.ms};
 });
}
await test('Branch and Bound radioterapia inteira','API-MATH',async()=>{
 const r=await request('/api/v1/solves/integer',{model:scenarios.radiotherapy,options:{max_nodes:200,time_limit:10}});
 assert(r.status===200,'HTTP '+r.status+': '+JSON.stringify(r.data).slice(0,450));
 assert(r.data.status==='optimal','Status '+r.data.status);
 assert(Math.abs(r.data.objective_value-5.3)<1e-6,'Esperado 5.3, recebeu '+r.data.objective_value);
 return {z:r.data.objective_value,nodes:r.data.explored_nodes,bestBound:r.data.best_bound,rounding:r.data.best_rounding_candidate};
});
await test('Branch and Bound modelo misto','API-MATH',async()=>{
 const r=await request('/api/v1/solves/integer',{model:scenarios.mixed,options:{max_nodes:200,time_limit:10}});
 assert(r.status===200,'HTTP '+r.status+': '+JSON.stringify(r.data).slice(0,450));
 assert(r.data.status==='optimal','Status '+r.data.status);
 assert(Math.abs(r.data.variables.x1-Math.round(r.data.variables.x1))<1e-7,'x1 não inteiro');
 return {z:r.data.objective_value,nodes:r.data.explored_nodes,values:r.data.variables};
});
await test('Certificação de ótimos múltiplos','API-MATH',async()=>{
 const r=await request('/api/v1/solves/alternatives',{model:scenarios.multiple,options:{max_bases:200,time_limit:3}});
 assert(r.status===200,'HTTP '+r.status+': '+JSON.stringify(r.data).slice(0,500));
 assert(r.data.status==='multiple'&&r.data.certified===true,'Não certificou: '+JSON.stringify(r.data).slice(0,500));
 return {status:r.data.status,certified:r.data.certified,alternative:r.data.alternative};
});
await test('Dualidade Wyndor','API-MATH',async()=>{
 const r=await request('/api/v1/solves/dual',{model:scenarios.wyndor,options:{include_trace:true}});
 assert(r.status===200,'HTTP '+r.status+': '+JSON.stringify(r.data).slice(0,500));
 assert(r.data.status==='optimal','Status '+r.data.status);
 assert(Math.abs(r.data.duality_gap)<1e-7,'Gap '+r.data.duality_gap);
 return {primal:r.data.primal_objective,dual:r.data.dual_objective,gap:r.data.duality_gap};
});
await test('Dualidade com 12 restrições','API-MATH',async()=>{
 const r=await request('/api/v1/solves/dual',{model:scenarios.twelveRows,options:{include_trace:false,time_limit:3}});
 assert(r.status===200,'HTTP '+r.status+': '+JSON.stringify(r.data).slice(0,500));
 assert(r.data.status==='optimal','Status '+r.data.status);
 assert(Math.abs(r.data.primal_objective-8)<1e-6,'Esperado 8, recebido '+r.data.primal_objective);
 return {primal:r.data.primal_objective,dual:r.data.dual_objective,nDual:r.data.dual_model?.variables?.length};
});
await test('Geometria bidimensional Wyndor','API-MATH',async()=>{
 const r=await request('/api/v1/geometry',{model:scenarios.wyndor,options:{show_integer_lattice:true,max_integer_points:100}});
 assert(r.status===200,'HTTP '+r.status+': '+JSON.stringify(r.data).slice(0,500));
 assert(r.data.status==='feasible','Status '+r.data.status);
 assert(r.data.vertices?.length>0,'Sem vértices');
 return {vertices:r.data.vertices.length,levels:r.data.level_lines?.length};
});
await test('Validação modelo malformado','API-VALIDATION',async()=>{
 const r=await request('/api/v1/models/validate',{model:{...scenarios.wyndor,objective:[1]}});
 assert(r.status===422,'Esperava 422, recebeu '+r.status);
 return {status:r.status,code:r.data?.code};
});
await test('HTTP payload oversized','API-VALIDATION',async()=>{
 const r=await request('/api/v1/models/validate',{model:{...scenarios.wyndor,name:'x'.repeat(102000)}});
 assert(r.status===413,'Esperava 413, recebeu '+r.status);
 return {status:r.status,code:r.data?.code};
});
for(const [name,key,chapters] of [
  ['PDF Wyndor completo','wyndor',['model','simplex','integer','geometry','dual','alternatives']],
  ['PDF Radioterapia','radiotherapy',['model','simplex','integer','geometry','dual']],
]){
 await test(name,'API-PDF',async()=>{
   const r=await request('/api/v1/reports/pdf',{model:scenarios[key],options:{
     sections:chapters,max_tableaux:8,max_nodes:40,integer_mode:key==='wyndor'?'all_integer':'declared',
   }});
   assert(r.status===200,'HTTP '+r.status+': '+JSON.stringify(r.data).slice(0,400));
   assert(r.type.includes('application/pdf'),'MIME '+r.type);
   assert(r.bytes.subarray(0,5).toString()==='%PDF-','PDF inválido');
   const file=outDir+'/'+key+'.pdf';
   await fs.writeFile(file,r.bytes);
   return {bytes:r.bytes.length,file,ms:r.ms};
 });
}
browser=await chromium.launch({headless:true});
await inBrowser('01-homepage',async page=>{
 const r=await page.goto(host+'/',{waitUntil:'domcontentloaded',timeout:25000});
 await page.locator('#root').waitFor();
 const txt=(await page.locator('body').innerText()).slice(0,1200);
 assert(r.status()===200,'HTTP '+r.status());
 assert(/PivôNauta|Piv[oô]Nauta/i.test(txt),'Landing não carregou: '+txt.slice(0,450));
 return {excerpt:txt.slice(0,300)};
});
await inBrowser('02-wyndor-editor-simplex',async page=>{
 await importModel(page,scenarios.wyndor);
 const txt=await solveUI(page);
 assert(/36/.test(txt),'Valor 36 não exibido: '+txt.slice(0,500));
 return {excerpt:txt.slice(0,700)};
});
await inBrowser('03-tableaux',async page=>{
 await importModel(page,scenarios.wyndor);
 await solveUI(page);
 await page.goto(host+'/#/results/simplex');
 await page.locator('.pr5-tableau-viewer .tableau').first().waitFor({timeout:18000});
 return {tables:await page.locator('.pr5-tableau-viewer .tableau').count()};
});
await inBrowser('04-geometria',async page=>{
 await importModel(page,scenarios.wyndor);
 await solveUI(page);
 await page.goto(host+'/#/results/graph');
 await page.locator('.pr6-plot svg').waitFor({timeout:18000});
 return {excerpt:(await page.locator('main').innerText()).slice(0,700)};
});
await inBrowser('05-dual',async page=>{
 await importModel(page,scenarios.wyndor);
 await solveUI(page);
 await page.goto(host+'/#/results/dual');
 await page.getByRole('heading',{name:'Modelo dual'}).waitFor({timeout:18000});
 await page.getByText('Dualidade forte verificada').waitFor({timeout:18000});
 return {excerpt:(await page.locator('main').innerText()).slice(0,700)};
});
await inBrowser('06-radioterapia-inteira',async page=>{
 await importModel(page,scenarios.radiotherapy);
 const txt=await solveUI(page);
 assert(/5,25|5\.25/.test(txt),'Min 5.25 não exibido: '+txt.slice(0,550));
 await page.goto(host+'/#/results/integer');
 await page.locator('.pr6-tree-node').first().waitFor({timeout:24000});
 return {excerpt:(await page.locator('main').innerText()).slice(0,900)};
});
await inBrowser('07-inviavel',async page=>{
 await importModel(page,scenarios.infeasible);
 const txt=await solveUI(page);
 assert(/inviável|inviavel|infeasible/i.test(txt),'Status inviável ausente: '+txt.slice(0,450));
 return {excerpt:txt.slice(0,550)};
});
await inBrowser('08-ilimitado',async page=>{
 await importModel(page,scenarios.unbounded);
 const txt=await solveUI(page);
 assert(/ilimitado|unbounded/i.test(txt),'Status ilimitado ausente: '+txt.slice(0,450));
 return {excerpt:txt.slice(0,550)};
});
await inBrowser('09-otimos-multiplos',async page=>{
 await importModel(page,scenarios.multiple);
 await solveUI(page);
 await page.goto(host+'/#/results/analysis');
 await page.getByRole('heading',{name:'Ótimos múltiplos'}).waitFor({timeout:18000});
 await page.getByText('Múltiplos ótimos comprovados').waitFor({timeout:18000});
 return {excerpt:(await page.locator('main').innerText()).slice(0,800)};
});
await inBrowser('10-modelo-3-variaveis',async page=>{
 await importModel(page,scenarios.three);
 const txt=await solveUI(page);
 assert(/\b10\b/.test(txt),'Z=10 não exibido: '+txt.slice(0,450));
 await page.goto(host+'/#/results/graph');
 const graph=(await page.locator('main').innerText()).slice(0,1400);
 assert(/duas variáveis|bidimensional|2D|indisponível/i.test(graph),'Sem aviso do limite 2D: '+graph.slice(0,500));
 return {excerpt:graph.slice(0,650)};
});
await inBrowser('11-json-invalido',async page=>{
 await importModel(page,scenarios.wyndor);
 await page.getByRole('tab',{name:'Importar JSON'}).click();
 await page.getByRole('textbox',{name:'Modelo JSON'}).fill('{invalid json}');
 await page.getByRole('button',{name:'Validar e pré-visualizar'}).click();
 const text=await page.getByRole('alert').first().innerText();
 assert(/inválido|erro/i.test(text),'Erro JSON não exibido: '+text);
 await page.getByRole('button',{name:'Cancelar'}).click();
 assert((await page.locator('main .model-name-input').inputValue())===scenarios.wyndor.name,'Modelo alterado após erro');
 return {validation:text};
});
await inBrowser('12-biblioteca-persistencia',async page=>{
 await importModel(page,scenarios.wyndor);
 await page.goto(host+'/#/library');
 await page.getByRole('button',{name:'Salvar modelo ativo'}).click();
 await page.getByRole('heading',{name:scenarios.wyndor.name}).first().waitFor({timeout:14000});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.goto(host+'/#/editor');
 await page.waitForFunction(
   expected=>document.querySelector('main .model-name-input')?.value===expected,
   scenarios.wyndor.name, {timeout:6000},
 );
 const restored=await page.locator('main .model-name-input').inputValue();
 assert(restored===scenarios.wyndor.name,'Restaurado: '+restored);
 return {restored};
});
await inBrowser('13-relatorio-download',async page=>{
 await importModel(page,scenarios.wyndor);
 await page.goto(host+'/#/results/report');
 await page.getByRole('heading',{name:'Relatório técnico em PDF'}).waitFor({timeout:16000});
 await page.getByRole('checkbox',{name:/Programação inteira/}).uncheck();
 await page.getByRole('checkbox',{name:/Modelo dual/}).uncheck();
 await page.getByRole('checkbox',{name:/Ótimos alternativos/}).uncheck();
 const waiting=page.waitForEvent('download',{timeout:30000});
 await page.getByRole('button',{name:/Exportar PDF/}).click();
 const file=await waiting;
 await file.saveAs(outDir+'/wyndor-ui-download.pdf');
 const bytes=await fs.readFile(outDir+'/wyndor-ui-download.pdf');
 assert(bytes.subarray(0,5).toString()==='%PDF-','Arquivo não PDF');
 return {filename:file.suggestedFilename(),size:bytes.length};
});
await inBrowser('14-editor-mobile',async page=>{
 await page.goto(host+'/#/editor');
 await page.locator('main .model-name-input').waitFor({timeout:18000});
 return {name:await page.locator('main .model-name-input').inputValue()};
},{width:390,height:844});
await inBrowser('15-relatorio-mobile',async page=>{
 await page.goto(host+'/#/results/report');
 await page.getByRole('heading',{name:'Relatório técnico em PDF'}).waitFor({timeout:18000});
 assert(await page.getByRole('button',{name:/Exportar PDF/}).isVisible(),'Exportar indisponível no mobile');
 return {buttonVisible:true};
},{width:390,height:844});
await inBrowser('16-editor-grid-conteudo',async page=>{
 await page.goto(host+'/#/editor');
 await page.locator('.equation-node--constraints .node-content').waitFor({timeout:12000});
 const measure=await page.evaluate(()=>{
   const node=document.querySelector('.equation-node--constraints');
   const content=node.querySelector('.node-content');
   return {gridTemplate:getComputedStyle(node).gridTemplateColumns,nodeWidth:node.getBoundingClientRect().width,contentWidth:content.getBoundingClientRect().width,
     children:node.children.length};
 });
 assert(measure.contentWidth>=300,'Conteúdo estreito demais para editar restrições: '+JSON.stringify(measure));
 return measure;
});
await inBrowser('17-editor-header-mobile-visibilidade',async page=>{
 await page.goto(host+'/#/editor');
 const button=page.getByRole('button',{name:'Revisar modelo'});
 await button.waitFor({timeout:12000});
 const box=await button.boundingBox();
 const screen=await page.evaluate(()=>innerWidth);
 assert(box&&box.x+box.width<=screen-4,'Botão Revisar modelo cortado: '+JSON.stringify({box,screen}));
 return {box,screen};
},{width:390,height:844});
await inBrowser('18-dual-primal-operadores',async page=>{
 await importModel(page,scenarios.wyndor);
 await solveUI(page);
 await page.goto(host+'/#/results/dual');
 await page.getByText('Dualidade forte verificada').waitFor({timeout:18000});
 const eqs=(await page.locator('.dual-model--primal').innerText());
 assert(!eqs.includes('undefined'),'Operadores matemáticos ausentes: '+eqs.slice(0,500));
 return {primal: eqs.slice(0,550)};
});
await inBrowser('19-biblioteca-salvo-recarrega',async page=>{
 await importModel(page,scenarios.wyndor);
 await page.goto(host+'/#/library');
 await page.getByRole('button',{name:'Salvar modelo ativo'}).click();
 await page.getByRole('heading',{name:scenarios.wyndor.name}).first().waitFor({timeout:12000});
 await page.reload();
 await page.goto(host+'/#/library');
 await page.getByRole('heading',{name:scenarios.wyndor.name}).first().waitFor({timeout:15000});
 return {libraryEntryPersisted:true};
});
await inBrowser('20-rascunho-apos-debounce',async page=>{
 await importModel(page,scenarios.wyndor);
 await page.waitForTimeout(1150);
 await page.reload();
 await page.goto(host+'/#/editor');
 await page.waitForFunction(expected=>document.querySelector('main .model-name-input')?.value===expected,
   scenarios.wyndor.name,{timeout:6500});
 return {activeName:await page.locator('main .model-name-input').inputValue()};
});
if(browser)await browser.close();
const summary={target:host,completed:new Date().toISOString(),total:records.length,
  passed:records.filter(r=>r.status==='PASS').length,failed:records.filter(r=>r.status==='FAIL').length,
  records};
await fs.writeFile(outDir+'/report.json',JSON.stringify(summary,null,2));
console.log('AUDIT_FINAL '+JSON.stringify({target:host,total:summary.total,passed:summary.passed,failed:summary.failed}));
for(const r of records)console.log('AUDIT_ROW '+JSON.stringify(r));
if(summary.failed)process.exitCode=1;
