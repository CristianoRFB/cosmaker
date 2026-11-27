import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const url = 'https://77-sakurai-portfolio-v14-staging.on7.workers.dev/';
const v13 = 'https://77-sakurai-portfolio-v2.on7.workers.dev/';
const output = path.resolve('test-results/sakurai-v14');
await mkdir(output, { recursive: true });
const results = [];
const errors = [];
function record(name, status, details = {}) {
  results.push({ name, status, details });
  console.log(JSON.stringify({ name, status, details }));
}
async function gate(name, fn) {
  try { await fn(); record(name, 'PASS'); }
  catch (error) { record(name, 'FAIL', { message: String(error).slice(0, 600) }); }
}
function assert(condition, message) { if (!condition) throw new Error(message); }
async function widthCheck(page, width) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  assert(m.scroll <= m.client, 'Overflow '+width+': '+JSON.stringify(m));
}
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320,390,768,1440,1920]) {
    const context=await browser.newContext({viewport:{width,height:width<=390?844:900},reducedMotion:'reduce'});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push({width,message:e.message}));
    await gate('home-responsive-'+width,async()=>{
      const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      assert(res?.status()===200,'Home status '+res?.status());
      await widthCheck(page,width);
      assert(await page.locator('.photo-card').count()===13,'Expected 13 gallery cards');
      assert(await page.locator('#primary-nav a').count()>=6,'Navigation missing');
    });
    if(width===390) {
      await gate('drawer-touch-390',async()=>{
        await page.locator('#menu-toggle').click();
        assert(await page.locator('#menu-toggle').getAttribute('aria-expanded')==='true','Drawer not expanded');
        await page.locator('#nav-backdrop').click({position:{x:12,y:200}});
        assert(await page.locator('#menu-toggle').getAttribute('aria-expanded')==='false','Backdrop did not close');
        await page.locator('#menu-toggle').click();
        await page.keyboard.press('Escape');
        assert(await page.locator('#menu-toggle').getAttribute('aria-expanded')==='false','Escape did not close');
      });
    }
    if(width===1440) {
      for(const key of ['referencias','moldes','tutoriais','buildbooks','photocards','posteres']) {
        await gate('resource-'+key,async()=>{
          await page.locator('[data-resource="'+key+'"]').click();
          assert(await page.locator('#resource-'+key).evaluate(e=>e.open),'Dialog did not open');
          await page.keyboard.press('Escape');
          assert(!await page.locator('#resource-'+key).evaluate(e=>e.open),'Esc did not close');
        });
      }
      await gate('palette-invalid-and-reset',async()=>{
        await page.locator('#open-palette').click();
        await page.locator('#reset-palette').click();
        const before=await page.locator('#main-color').inputValue();
        await page.locator('#hex-color').fill('#nothex');
        assert((await page.locator('#hex-validation').innerText()).includes('#RRGGBB'),'No validation message');
        assert((await page.locator('#main-color').inputValue())===before,'Invalid HEX changed palette');
        await page.locator('#palette-dialog [data-dialog-close]').first().click();
        await page.locator('#theme-toggle').click();
        assert(await page.locator('html').getAttribute('data-theme')==='light','Theme did not change');
      });
      await gate('gallery-and-keyboard',async()=>{
        await page.locator('[data-filter="bastidores"]').click();
        assert(await page.locator('.photo-card').count()===3,'Filter not isolated');
        await page.locator('.photo-card').first().click();
        assert(await page.locator('#gallery-dialog').evaluate(e=>e.open),'Gallery did not open');
        await page.keyboard.press('Escape');
        assert(!await page.locator('#gallery-dialog').evaluate(e=>e.open),'Esc did not close gallery');
      });
    }
    if(width===390 || width===1440) {
      await gate('caitlyn-hotspots-'+width,async()=>{
        const res=await page.goto(url+'projetos/caitlyn',{waitUntil:'domcontentloaded',timeout:30000});
        assert(res?.status()===200,'Caitlyn page failed');
        await widthCheck(page,width);
        const names=await page.locator('.ck-hotspot').evaluateAll(nodes=>nodes.map(el=>{
          const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();
          const x=r.x+r.width/2,y=r.y+r.height/2;
          return {id:el.dataset.piece, inside:x>=p.x&&x<=p.right&&y>=p.y&&y<=p.bottom};
        }));
        assert(names.length===5,'Expected 5 hotspots');
        assert(names.every(n=>n.inside),'CSP displaced hotspots: '+JSON.stringify(names));
        for (let i=0;i<5;i++) {
          const button=page.locator('.ck-hotspot').nth(i);
          await button.click({timeout:7000});
          assert(await button.getAttribute('aria-pressed')==='true','Hotspot did not select '+i);
        }
        assert(await page.locator('.ck-piece-card').count()===14,'Buildbook expected 14 pieces');
        assert(await page.locator('.ck-chapter').count()===5,'Buildbook expected 5 chapters');
        await page.locator('#look-interativo').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,'VSC-after-'+width+'.png'),fullPage:false,animations:'disabled'});
      });
      await gate('franco-page-'+width,async()=>{
        const res=await page.goto(url+'projetos/franco',{waitUntil:'domcontentloaded',timeout:30000});
        assert(res?.status()===200,'Franco page not accessible');
        await widthCheck(page,width);
      });
    }
    await context.close();
  }
  await gate('CSP-before-after-390',async()=>{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const page=await ctx.newPage();
    await page.goto(v13+'projetos/caitlyn',{waitUntil:'domcontentloaded'});
    await page.locator('#look-interativo').scrollIntoViewIfNeeded();
    const before=await page.locator('.ck-hotspot').evaluateAll(els=>els.map(e=>({id:e.dataset.piece,left:getComputedStyle(e).left,top:getComputedStyle(e).top})));
    await page.screenshot({path:path.join(output,'VSC-before-390.png'),animations:'disabled'});
    await page.goto(url+'projetos/caitlyn',{waitUntil:'domcontentloaded'});
    await page.locator('#look-interativo').scrollIntoViewIfNeeded();
    const after=await page.locator('.ck-hotspot').evaluateAll(els=>els.map(e=>({id:e.dataset.piece,left:getComputedStyle(e).left,top:getComputedStyle(e).top})));
    await page.screenshot({path:path.join(output,'VSC-after-comparison-390.png'),animations:'disabled'});
    assert(after.some((n,i)=>n.left!==before[i].left),'Hotspot geometry unchanged; patch not loaded');
    await ctx.close();
  });
  await gate('fallback-adversarial',async()=>{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const page=await ctx.newPage();
    await page.route('**/images/caitlyn-personagem.webp',route=>route.request().url().startsWith(url) ? route.abort() : route.continue());
    await page.goto(url+'projetos/caitlyn',{waitUntil:'domcontentloaded'});
    const img=page.locator('.ck-hero-visual img');
    await img.waitFor({state:'visible'});
    await page.waitForFunction(()=>{const i=document.querySelector('.ck-hero-visual img');return i&&i.naturalWidth>0},null,{timeout:12000});
    const src=await img.getAttribute('src');
    assert(src.includes('b81653482c26fb0ea81817940cbc7c06db9ff1f6'),'Fallback not pinned to V13');
    await ctx.close();
  });
  await gate('independent-replay-new-context',async()=>{
    const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const page=await ctx.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await widthCheck(page,390);
    await page.locator('[data-resource="moldes"]').click();
    assert(await page.locator('#resource-moldes').evaluate(el=>el.open),'Moldes dialog failed on replay');
    await page.keyboard.press('Escape');
    await page.goto(url+'projetos/caitlyn',{waitUntil:'domcontentloaded'});
    await page.locator('.ck-hotspot[data-piece="peruca"]').click({timeout:7000});
    assert(await page.locator('.ck-hotspot[data-piece="peruca"]').getAttribute('aria-pressed')==='true','Hotspot replay failed');
    await ctx.close();
  });
} finally {
  await browser.close();
}
await writeFile(path.join(output,'report.json'),JSON.stringify({source:url,results,errors,executor:'GitHub Actions Ubuntu Chromium Playwright',independentReview:'SAME_EXECUTOR_REPLAY'},null,2));
record('js-pageerrors',errors.length?'FAIL':'PASS',{errors});
const bad=results.filter(x=>x.status!=='PASS');
if(bad.length || errors.length) process.exitCode=1;
