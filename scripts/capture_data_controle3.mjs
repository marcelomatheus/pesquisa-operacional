import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const output='docs/evidencias-data-controle-3';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const targets=[
  ['01-prs-integrados.png','https://github.com/marcelomatheus/pesquisa-operacional/pulls?q=is%3Apr+is%3Amerged',null],
  ['02-pr5-inspector.png','https://github.com/marcelomatheus/pesquisa-operacional/pull/5',null],
  ['03-pr7-relatorios-pdf.png','https://github.com/marcelomatheus/pesquisa-operacional/pull/7',null],
  ['04-pr8-validacao.png','https://github.com/marcelomatheus/pesquisa-operacional/pull/8',null],
  ['05-pr11-confiabilidade.png','https://github.com/marcelomatheus/pesquisa-operacional/pull/11',null],
  ['06-pr13-finalizacao.png','https://github.com/marcelomatheus/pesquisa-operacional/pull/13',null],
  ['07-software-publicado.png','https://pivonauta.celodev.com.br/',null]
];
let count=0;
for(const [name,url] of targets){
const context=await browser.newContext({viewport:{width:1440,height:940},deviceScaleFactor:1,locale:'pt-BR'});
const page=await context.newPage();
try {
 const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(1000);
 const body=(await page.locator('body').innerText()).slice(0,2400);
 if(r.status()!==200)throw new Error('HTTP '+r.status());
 if(url.includes('github.com') && !body.includes('PivôNauta') && !body.includes('pivonauta'))throw new Error('PR content not visible');
 const file=output+'/'+name;
 await page.screenshot({path:file,fullPage:false,animations:'disabled'});
 console.log('EVIDENCE_OK '+JSON.stringify({name,url,status:r.status(),title:await page.title(),bytes:(await fs.stat(file)).size}));
 count++;
} catch(e){console.log('EVIDENCE_FAILED '+JSON.stringify({name,url,error:String(e)}));}
finally{await context.close();}
}
await browser.close();
if(count<5)process.exitCode=1;
