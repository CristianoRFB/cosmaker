from pathlib import Path
import base64,json,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text();css=(ROOT/'style.css').read_text();js=(ROOT/'app.js').read_text()
images={x.stem:'data:image/webp;base64,'+base64.b64encode(x.read_bytes()).decode() for x in (ROOT/'images').glob('*.webp')}
for name,uri in images.items():html=html.replace(f'./images/{name}.webp',uri)
js=js.replace('src="./images/${w.image}.webp"','src="${window.__images[w.image]}"').replace('`./images/${item.image}.webp`','window.__images[item.image]').replace('`./images/${a.image}.webp`','window.__images[a.image]')
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>').replace('<script src="./app.js" defer></script>','')
html=html.replace('</body>','<script>window.__images='+json.dumps(images)+';</script><script>'+js+'</script></body>')
html=re.sub(r'<link[^>]+fonts.googleapis.com[^>]+>','',html)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width,height in ((390,844),(1440,900)):
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  page.set_content(html,wait_until='load')
  fullheight=page.evaluate('document.body.scrollHeight')
  for y in range(0,fullheight,height//2):
   page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})',y)
   page.wait_for_timeout(100)
  page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(500)
  loaded=page.locator('img[src]').evaluate_all('a=>a.filter(i=>i.complete&&i.naturalWidth>0).length')
  total=page.locator('img[src]').count()
  print(width,'media loaded',loaded,'/',total,'page height',fullheight)
  assert loaded==total,(width,loaded,total)
  page.screenshot(path=str(ROOT/'tests'/f'v3-{width}-dark.png'),full_page=True)
  page.locator('#open-palette').click()
  page.screenshot(path=str(ROOT/'tests'/f'v3-{width}-palette.png'))
  page.locator('#palette-theme-toggle').click()
  page.locator('#palette-dialog .dialog-close').click()
  page.screenshot(path=str(ROOT/'tests'/f'v3-{width}-light.png'),full_page=True)
  page.close()
 browser.close()
