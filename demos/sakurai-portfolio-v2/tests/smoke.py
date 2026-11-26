from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess,time,json,os,base64,re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
css=(ROOT/'style.css').read_text()
js=(ROOT/'app.js').read_text()
images={x.stem:'data:image/webp;base64,'+base64.b64encode(x.read_bytes()).decode() for x in (ROOT/'images').glob('*.webp')}
for name,uri in images.items():
    html=html.replace(f'./images/{name}.webp',uri)
js=js.replace('src="./images/${w.image}.webp"','src="${window.__images[w.image]}"').replace('`./images/${item.image}.webp`','window.__images[item.image]').replace('`./images/${a.image}.webp`','window.__images[a.image]')
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>')
html=html.replace('<script src="./app.js" defer></script>', '').replace('</body>','<script>window.__store=window.__store||{};Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:(k)=>window.__store[k]??null,setItem:(k,v)=>window.__store[k]=String(v)}});</script><script>window.__images='+json.dumps(images)+';</script><script>'+js+'</script></body>')
html=re.sub(r'<link[^>]+fonts.googleapis.com[^>]+>','',html)
try:
    time.sleep(.1)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        for width in (320,360,390,430,768,1024,1440):
            page=browser.new_page(viewport={'width':width,'height':850},device_scale_factor=1)
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.set_content(html,wait_until='load')
            page.wait_for_timeout(250)
            assert page.locator('.photo-card').count()==13,(width,page.locator('.photo-card').count())
            bad=page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2')
            assert not bad,f'Horizontal overflow at {width}'
            assert not errors,(width,errors)
            assert page.locator('img').count()>=17
            assert page.locator('.hero-photo img').evaluate('el=>el.complete&&el.naturalWidth>0'),f'hero not loaded {width}'
            if width in (390,1440):
                page.screenshot(path=str(ROOT/'tests'/f'home-{width}.png'),full_page=True)
            assert page.locator('#film-video').count()==1
            assert page.locator('#film-video').get_attribute('src')=='./images/processo-franco.mp4'
            assert page.locator('#film-video').get_attribute('muted')==''
            assert page.locator('#film-video').get_attribute('controls')==''
            assert page.locator('.media-credit').count()==1
            # interactive filter and dialog
            page.get_by_role('button',name='Bastidores',exact=True).click()
            assert page.locator('.photo-card').count()==3
            page.locator('.photo-card').first.click()
            assert page.locator('#gallery-dialog').evaluate('(el)=>el.open')
            page.get_by_role('button',name='Fechar detalhes').click()
            assert not page.locator('#gallery-dialog').evaluate('(el)=>el.open')
            page.get_by_role('button',name='Tudo 13').click()
            page.get_by_role('button',name='Ver formato de tutorial').first.click()
            assert page.locator('#article-dialog').evaluate('(el)=>el.open')
            page.keyboard.press('Escape')
            assert not page.locator('#article-dialog').evaluate('(el)=>el.open')
            # palette manipulation + derived colors + persistence
            page.locator('#open-palette').click()
            assert page.locator('#palette-dialog').evaluate('(el)=>el.open')
            page.locator('#main-color').fill('#1555dd')
            assert page.locator('html').evaluate("el=>getComputedStyle(el).getPropertyValue('--brand').trim()")== '#1555DD'
            assert page.locator('#derived-swatches .swatch').count()==4
            page.get_by_role('button',name='Ativar modo claro').last.click()
            assert page.locator('html').get_attribute('data-theme')=='light'
            page.get_by_role('button',name='Restaurar rosa').click()
            assert page.locator('#hex-color').input_value()=='#E86A9F'
            assert page.locator('html').get_attribute('data-theme')=='light'
            page.get_by_role('button',name='Fechar editor de cores').click()
            stored=page.evaluate('window.__store')
            assert stored['sakurai-rfb-mode-v3']=='light'
            fresh=browser.new_page(viewport={'width':width,'height':850})
            fresh_html=html.replace('window.__store=window.__store||{};', 'window.__store='+json.dumps(stored)+';')
            fresh.set_content(fresh_html,wait_until='load')
            assert fresh.locator('html').get_attribute('data-theme')=='light'
            assert fresh.locator('#hex-color').input_value()=='#E86A9F'
            fresh.close()
            if width==390:
                page.get_by_role('button',name='Abrir menu').click()
                assert page.locator('#primary-nav').is_visible()
                page.get_by_role('link',name='Biblioteca',exact=True).click()
                assert not page.locator('#primary-nav').is_visible()
            page.close()
            print('PASS viewport+flows',width)
        browser.close()
finally:
    pass