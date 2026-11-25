from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,re
ROOT=Path(__file__).resolve().parents[1]
def inline_page(path,script):
    html=(ROOT/path).read_text()
    style=(ROOT/'style.css').read_text()
    html=re.sub(r'<link rel="stylesheet" href="[^\"]+">','<style>'+style+'</style>',html)
    html=re.sub(r'<script src="[^\"]+" defer></script>','',html)
    html=re.sub(r'<link[^>]*fonts\.googleapis[^>]*>','',html)
    html=re.sub(r'<link[^>]*fonts\.gstatic[^>]*>','',html)
    def replace_src(m):
        url=m.group(1)
        p=(ROOT/path).parent/url
        p=p.resolve()
        if p.suffix.lower() in ['.webp','.jpg','.jpeg','.png'] and p.is_file():
            return 'src="data:image/'+('webp' if p.suffix=='.webp' else 'jpeg')+';base64,'+base64.b64encode(p.read_bytes()).decode()+'"'
        return 'src="'+url+'"'
    html=re.sub(r'src="(\.\.?/images/[^\"]+)"',replace_src,html)
    html=html.replace('</body>',f'<script>{(ROOT/script).read_text()}</script></body>')
    return html
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for w in (320,390,768,1440):
        page=browser.new_page(viewport={'width':w,'height':820}, device_scale_factor=1)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(inline_page(Path('index.html'),Path('app.js')),wait_until='domcontentloaded')
        assert page.locator('.character-frame').count()==2
        links=[page.locator('.character-frame').nth(i).get_attribute('href') for i in range(2)]
        assert links==['./projetos/franco','./projetos/caitlyn'],links
        assert page.locator('.character-frame h3').all_inner_texts()==['Franco','Caitlyn']
        assert page.locator('.character-frame img').evaluate_all('(els)=>els.every(x=>x.complete && x.naturalWidth>0)')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('homepage overflow',w,page.evaluate('document.documentElement.scrollWidth'))
        if w in (390,1440):
            page.screenshot(path=str(ROOT/'tests'/f'v6-home-{w}.png'),full_page=True)
        for slug in ('franco','caitlyn'):
            sub=browser.new_page(viewport={'width':w,'height':820},device_scale_factor=1)
            sub.on('pageerror',lambda e:errors.append(str(e)))
            sub.set_content(inline_page(Path('projetos')/f'{slug}.html',Path('project.js')),wait_until='domcontentloaded')
            assert sub.locator('h1').inner_text().lower()==slug
            assert sub.locator('.project-photo').count()==(6 if slug=='franco' else 2)
            assert sub.locator('a.project-related-link').count()==1
            assert sub.locator('#project-theme-toggle').count()==1
            assert sub.evaluate('document.documentElement.scrollWidth<=innerWidth'),(slug,'overflow',w,sub.evaluate('document.documentElement.scrollWidth'))
            sub.locator('#project-theme-toggle').click()
            assert sub.locator('html').get_attribute('data-theme')=='light'
            if w==390:sub.screenshot(path=str(ROOT/'tests'/f'v6-{slug}-{w}.png'),full_page=True)
            sub.close()
        page.close()
    browser.close()
assert not errors,errors
print('V6 offline QA PASS: 320/390/768/1440; 2 full-card destinations; 8 gallery images in detail pages; theme toggle, no overflow, no JS errors.')