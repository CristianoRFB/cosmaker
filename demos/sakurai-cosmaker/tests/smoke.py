"""Headless browser acceptance checks using set_content (navigation restricted by sandbox).
Run: python tests/smoke.py
"""
from pathlib import Path
from base64 import b64encode
from playwright.sync_api import sync_playwright
import re, sys

ROOT = Path(__file__).resolve().parents[1]
JS=(ROOT/'app.js').read_text()
CSS=(ROOT/'styles.css').read_text()
ASSETS={x.stem:'data:image/svg+xml;base64,'+b64encode(x.read_bytes()).decode() for x in (ROOT/'assets').glob('*.svg')}
ERRORS=[]

def render(p,path):
    raw=(ROOT/path.split('?')[0]).read_text()
    raw=re.sub(r'<script src="app.js" defer></script>', '',raw)
    raw=re.sub(r'<link rel="stylesheet" href="styles.css">','',raw)
    raw=re.sub(r'<link rel="icon"[^>]*>','',raw)
    for stem,uri in ASSETS.items():raw=raw.replace('assets/'+stem+'.svg',uri)
    p.set_content(raw,wait_until='domcontentloaded')
    css=re.sub(r"@import url\(.*?\);",'',CSS)
    css=css.replace("'assets/linhas.svg'", "'"+ASSETS['linhas']+"'")
    p.add_style_tag(content=css)
    p.add_script_tag(content=JS)
    correct_images(p)
    p.wait_for_timeout(60)
    assert p.locator('h1').first.is_visible(),f'h1 not visible: {path}'
    overflow=p.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    assert overflow <= 1,f'overflow on {path} at {p.viewport_size}: {overflow}px; offenders={p.evaluate("Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right])")}'

def correct_images(p):
    p.evaluate('''assets => document.querySelectorAll('img').forEach(i=>{
        const match=i.getAttribute('src')?.match(/^assets\\/(\\w+)\\.svg$/);
        if(match&&assets[match[1]])i.src=assets[match[1]];
    })''',ASSETS)

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1280,'height':900},device_scale_factor=1)
    p=ctx.new_page()
    p.on('pageerror',lambda error:ERRORS.append(str(error)))
    p.evaluate('''() => {const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(k)=>data[k]??null,setItem:(k,v)=>{data[k]=String(v)},removeItem:(k)=>delete data[k],clear:()=>Object.keys(data).forEach(k=>delete data[k])}});window.history.replaceState=()=>{};}''')
    render(p,'index.html')
    assert p.locator('[data-project]').count()==5
    p.get_by_role('button',name='Armaduras').click()
    assert p.locator('[data-project]').count()==1
    p.get_by_role('button',name='Todos').click()
    p.locator('[data-project]').first.click()
    assert p.locator('#project-dialog').evaluate('(e)=>e.open')
    p.keyboard.press('Escape')
    assert not p.locator('#project-dialog').evaluate('(e)=>e.open')
    correct_images(p)
    p.evaluate("() => {document.documentElement.style.scrollBehavior='auto'; window.scrollTo({top:0,behavior:'instant'})}")
    p.wait_for_timeout(120)
    p.screenshot(path=str(ROOT/'tests/portfolio-desktop.png'),full_page=True)
    render(p,'acompanhamento.html')
    p.get_by_role('button',name='Usar projeto de exemplo: DEMO-042').click()
    correct_images(p)
    assert 'Guardiã do Eclipse' in p.locator('#tracker-detail').inner_text()
    assert 'Etapa 3 de 5' in p.locator('#tracker-detail').inner_text()
    p.locator('#lookup-code').fill('INVALIDO')
    p.get_by_role('button',name='Consultar andamento').click()
    assert 'invalid' in p.locator('#lookup-field').get_attribute('class')
    p.locator('#lookup-code').fill('DEMO-999')
    p.get_by_role('button',name='Consultar andamento').click()
    assert 'Código não encontrado' in p.locator('#tracker-detail').inner_text()
    render(p,'atelie.html')
    assert p.locator('[data-edit]').count()==4
    p.locator('[data-edit="DEMO-042"]').click()
    p.locator('#edit-status').select_option('3')
    p.locator('#edit-note').fill('A etapa de acabamento foi iniciada na demonstração.')
    p.locator('#edit-form').get_by_role('button',name='Salvar alteração').click()
    assert 'Etapa atualizada' in p.locator('#toast').inner_text()
    render(p,'acompanhamento.html')
    p.locator('#try-sample').click()
    assert 'Etapa 4 de 5' in p.locator('#tracker-detail').inner_text()
    assert 'A etapa de acabamento foi iniciada' in p.locator('#tracker-detail').inner_text()
    render(p,'atelie.html')
    p.get_by_role('button',name='Novo exemplo').click()
    p.locator('#new-title').fill('Viajante das estrelas')
    p.locator('#new-alias').fill('Pessoa fictícia 05')
    p.locator('#new-art').select_option('flor')
    p.get_by_role('button',name='Criar no sandbox').click()
    assert 'Viajante das estrelas' in p.locator('#board').inner_text()
    assert p.locator('[data-edit]').count()==5
    p.get_by_role('button',name='Reiniciar demo').click()
    p.get_by_role('button',name='Sim, restaurar exemplos').click()
    assert p.locator('[data-edit]').count()==4
    assert 'Viajante das estrelas' not in p.locator('#board').inner_text()
    correct_images(p)
    p.evaluate("() => {document.documentElement.style.scrollBehavior='auto'; window.scrollTo({top:0,behavior:'instant'})}")
    p.wait_for_timeout(120)
    p.screenshot(path=str(ROOT/'tests/atelie-desktop.png'),full_page=True)
    ctx.close()
    for w,h in [(320,720),(360,780),(390,844),(430,932),(768,1024),(1024,800),(1440,900)]:
        ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=1)
        p=ctx.new_page()
        p.on('pageerror',lambda error:ERRORS.append(str(error)))
        p.evaluate('''() => {const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v)}});window.history.replaceState=()=>{};}''')
        for name in ('index.html','acompanhamento.html','atelie.html'):
            render(p,name)
            if w==390:
                if name=='acompanhamento.html':p.locator('#try-sample').click();correct_images(p)
                p.evaluate("() => {document.documentElement.style.scrollBehavior='auto'; window.scrollTo({top:0,behavior:'instant'})}")
                p.wait_for_timeout(120)
                p.screenshot(path=str(ROOT/'tests'/({'index.html':'portfolio-mobile','acompanhamento.html':'cliente-mobile','atelie.html':'atelie-mobile'}[name]+'.png')),full_page=True)
        if w<=430:
            render(p,'index.html')
            p.locator('#menu-btn').click()
            assert p.locator('#nav-links').is_visible()
            p.locator('#menu-btn').click()
            assert not p.locator('#nav-links').is_visible()
        ctx.close()
    b.close()
if ERRORS:
    print('JS ERRORS:',ERRORS,file=sys.stderr)
    sys.exit(1)
print('OK: gallery/filter/dialog, code lookup/errors, stage edit reflected in client, new/reset, mobile menu, JS checks and 21 viewport/page no-overflow checks.')
