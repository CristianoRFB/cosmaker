'use strict';
const DEFAULT_PINK = '#E86A9F';
const COLOR_KEY='sakurai-rfb-palette-v3';
const MODE_KEY='sakurai-rfb-mode-v3';
const $ = (selector,root=document)=>root.querySelector(selector);
const $$ = (selector,root=document)=>Array.from(root.querySelectorAll(selector));
const works=[
 {title:'Franco — Ao vivo',type:'cosplay',image:'franco-palco',tag:'Franco / palco',project:'franco',description:'Um dos registros do projeto Franco, de Hexatombe, em apresentação.'},
 {title:'Franco — Retrato',type:'cosplay',image:'franco-preto-branco',tag:'Franco / retrato',project:'franco',description:'Retrato em preto e branco que destaca caracterização e figurino.'},
 {title:'Caitlyn & companhia',type:'cosplay',image:'encontro-cosplay',tag:'Caitlyn / encontro',project:'caitlyn',description:'Encontro com a presença de uma caracterização de Caitlyn, de Arcane.'},
 {title:'Referência de Caitlyn',type:'detalhes',image:'caitlyn-arte',tag:'Referência visual',project:'caitlyn',description:'Referência visual vista no perfil. Esta imagem não é creditada como desenho autoral da Sakurai.'},
 {title:'Criação em andamento',type:'bastidores',image:'bastidores',tag:'Processo / bastidores',project:'franco',description:'Um momento espontâneo do cotidiano, parte do material compartilhado no perfil.'},
 {title:'Franco — Performance',type:'cosplay',image:'franco-show',tag:'Franco / apresentação',project:'franco',description:'Registro em cena com o cosplay de Franco.'},
 {title:'Franco — Ensaio',type:'cosplay',image:'franco-ensaio',tag:'Franco / ensaio',project:'franco',description:'Fotografia de ensaio e caracterização de Franco.'},
 {title:'Maquiagem Franco',type:'bastidores',image:'maquiagem',tag:'Maquiagem / registro',project:'franco',description:'Publicação sobre maquiagem. A área de tutoriais poderá reunir etapas descritas pela artista.'},
 {title:'Franco — Entrevista',type:'detalhes',image:'entrevista',tag:'Franco / publicação',project:'franco',description:'Registro editorial do perfil relacionado a Franco.'},
 {title:'Detalhes e acessórios',type:'detalhes',image:'acessorios',tag:'Acessórios / detalhes',project:'franco',description:'Publicação do perfil destacando acessórios.'},
 {title:'Bastidores em vídeo',type:'bastidores',image:'video-bastidores',tag:'Vídeo / registro',project:null,description:'Captura de um vídeo curto dos bastidores do perfil.'},
 {title:'Em comunidade',type:'cosplay',image:'palco-coletivo',tag:'Cosplay / encontro',project:'franco',description:'Registro em evento compartilhado com outros participantes.'}
];
const sampleArticles={
 makeup:{title:'Da referência à maquiagem',image:'maquiagem',text:'Exemplo de como a Sakurai poderá apresentar fotografias, ferramentas, preparação e escolhas de maquiagem do personagem. Os textos técnicos serão escritos e aprovados por ela.'},
 props:{title:'Detalhes que contam história',image:'acessorios',text:'Aqui caberiam fotos de peças, moldes autorais, materiais e etapas de acabamento, com referências creditadas conforme a artista escolher publicar.'},
 progress:{title:'Notas do processo',image:'bastidores',text:'Um formato de diário curto: uma foto, a etapa do dia, uma descoberta e o que vem depois. Nenhuma data ou progresso real foi inventado.'}
};
let activeFilter='todos', activeList=works.map((_,i)=>i), activeIndex=0, currentColor=DEFAULT_PINK;
let toastTimer;
function safeRead(key){try{return localStorage.getItem(key)}catch{return null}}
function safeWrite(key,value){try{localStorage.setItem(key,value)}catch{}}
function hexToRgb(hex){const m=/^#([\da-f]{6})$/i.exec(hex);return m?{r:parseInt(m[1].slice(0,2),16),g:parseInt(m[1].slice(2,4),16),b:parseInt(m[1].slice(4,6),16)}:null}
function rgbToHex({r,g,b}){return '#'+[r,g,b].map(n=>Math.min(255,Math.max(0,Math.round(n))).toString(16).padStart(2,'0')).join('').toUpperCase()}
function mix(hex1,hex2,t){const a=hexToRgb(hex1),b=hexToRgb(hex2);return rgbToHex({r:a.r*(1-t)+b.r*t,g:a.g*(1-t)+b.g*t,b:a.b*(1-t)+b.b*t})}
function lum(rgb){const f=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(rgb.r)+.7152*f(rgb.g)+.0722*f(rgb.b)}
function contrast(a,b){const aa=lum(hexToRgb(a)),bb=lum(hexToRgb(b));return (Math.max(aa,bb)+.05)/(Math.min(aa,bb)+.05)}
function derived(hex){const dark=String(document.documentElement.dataset.theme)==='dark';const bg=dark?'#151219':'#FAF7F9';return {base:hex,deep:mix(hex,'#130A18',dark?.23:.18),soft:mix(hex,bg,dark?.81:.87),faint:mix(hex,bg,dark?.92:.94),lift:mix(hex,'#FFFFFF',.34),onBrand:contrast(hex,'#140F16')>=contrast(hex,'#FFFFFF')?'#140F16':'#FFFFFF'}}
function updatePreview(){const vals=derived(currentColor);const root=document.documentElement;root.style.setProperty('--brand',vals.base);root.style.setProperty('--brand-deep',vals.deep);root.style.setProperty('--brand-soft',vals.soft);root.style.setProperty('--brand-faint',vals.faint);root.style.setProperty('--brand-lift',vals.lift);root.style.setProperty('--on-brand',vals.onBrand);$('#main-color').value=currentColor;$('#hex-color').value=currentColor;const r=hexToRgb(currentColor);[['red',r.r],['green',r.g],['blue',r.b]].forEach(([c,n])=>{$('#channel-'+c).value=n;$('#'+c+'-value').textContent=n;});const colors=[['Principal',vals.base],['Profunda',vals.deep],['Suave',vals.soft],['Realce',vals.lift]];$('#derived-swatches').innerHTML=colors.map(([name,color])=>`<span class="swatch" title="${name}: ${color}"><i></i><small>${name}<br>${color}</small></span>`).join('');$$('.swatch i').forEach((node,i)=>{node.style.backgroundColor=colors[i][1]});$('#hex-validation').textContent='';}
function setBrand(value){const hex=rgbToHex(hexToRgb(value));currentColor=hex;safeWrite(COLOR_KEY,hex);updatePreview();}
function setTheme(mode){const next=mode==='light'?'light':'dark';document.documentElement.dataset.theme=next;safeWrite(MODE_KEY,next);$('#theme-icon').textContent=next==='dark'?'☼':'☾';$('#theme-toggle').setAttribute('aria-label',next==='dark'?'Ativar modo claro':'Ativar modo escuro');$('#palette-theme-toggle').textContent=next==='dark'?'Ativar modo claro':'Ativar modo escuro';$('#palette-preview-mode').textContent=next==='dark'?'Tema escuro':'Tema claro';document.querySelector('meta[name="theme-color"]').content=next==='dark'?'#151219':'#faf7f9';updatePreview()}
function showToast(text){const toast=$('#toast');toast.textContent=text;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),3000)}
function renderGrid(){activeList=works.map((w,i)=>i).filter(i=>activeFilter==='todos'||works[i].type===activeFilter);$('#photo-count').textContent=works.length;$('#photo-grid').innerHTML=activeList.map((i,order)=>{const w=works[i];return `<button type="button" class="photo-card" data-photo="${i}" aria-label="Ver ${w.title}"><span class="photo-image"><img src="./images/${w.image}.webp" loading="lazy" alt="${w.tag}"></span><span class="photo-card-caption"><span><small>${String(order+1).padStart(2,'0')} / ${w.tag}</small><strong>${w.title}</strong></span><span aria-hidden="true">↗</span></span></button>`}).join('')}
function showGallery(index){activeIndex=activeList.includes(index)?activeList.indexOf(index):0;paintGallery();$('#gallery-dialog').showModal()}
function paintGallery(){const item=works[activeList[activeIndex]];$('#gallery-dialog-photo').src=`./images/${item.image}.webp`;$('#gallery-dialog-photo').alt=item.tag;$('#gallery-dialog-title').textContent=item.title;$('#gallery-dialog-description').textContent=item.description;$('#gallery-dialog-label').textContent=item.tag.toUpperCase();$('#dialog-prev').disabled=activeIndex===0;$('#dialog-next').disabled=activeIndex===activeList.length-1}
function openProject(project){activeFilter='todos';paintFilters();renderGrid();const i=works.findIndex(w=>w.project===project&&w.type==='cosplay');showGallery(Math.max(0,i))}
function paintFilters(){$$('.filter-chip').forEach(b=>{const active=b.dataset.filter===activeFilter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))})}
$$('.filter-chip').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;paintFilters();renderGrid()}));
$('#photo-grid').addEventListener('click',e=>{const b=e.target.closest('[data-photo]');if(b)showGallery(Number(b.dataset.photo))});
$$('[data-project]').forEach(b=>b.addEventListener('click',()=>openProject(b.dataset.project)));
$('#dialog-prev').addEventListener('click',()=>{if(activeIndex>0){activeIndex--;paintGallery()}});
$('#dialog-next').addEventListener('click',()=>{if(activeIndex<activeList.length-1){activeIndex++;paintGallery()}});
$$('[data-article]').forEach(b=>b.addEventListener('click',()=>{const a=sampleArticles[b.dataset.article];$('#article-dialog-title').textContent=a.title;$('#article-dialog-description').textContent=a.text;$('#article-dialog-img').src=`./images/${a.image}.webp`;$('#article-dialog-img').alt=a.title;$('#article-dialog').showModal()}));
$$('[data-dialog-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()}));
$('#menu-toggle').addEventListener('click',()=>{const open=$('#primary-nav').classList.toggle('expanded');$('#menu-toggle').setAttribute('aria-expanded',String(open));$('#menu-toggle').textContent=open?'×':'☰'});
$$('.main-nav a').forEach(a=>a.addEventListener('click',()=>{$('#primary-nav').classList.remove('expanded');$('#menu-toggle').setAttribute('aria-expanded','false');$('#menu-toggle').textContent='☰'}));
$('#open-palette').addEventListener('click',()=>$('#palette-dialog').showModal());
$('#theme-toggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
$('#palette-theme-toggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
$('#main-color').addEventListener('input',e=>setBrand(e.target.value));
$('#hex-color').addEventListener('input',e=>{const raw=e.target.value.trim();if(hexToRgb(raw))setBrand(raw.toUpperCase());else $('#hex-validation').textContent='Use #RRGGBB'});
['red','green','blue'].forEach(c=>$('#channel-'+c).addEventListener('input',()=>setBrand(rgbToHex({r:Number($('#channel-red').value),g:Number($('#channel-green').value),b:Number($('#channel-blue').value)}))));
$('#reset-palette').addEventListener('click',()=>{setBrand(DEFAULT_PINK);showToast('Rosa original restaurado')});
$('#copy-palette').addEventListener('click',async()=>{const d=derived(currentColor);const message=`Paleta Sakurai (prévia)\nPrincipal: ${d.base}\nProfunda: ${d.deep}\nSuave: ${d.soft}\nRealce: ${d.lift}\nTema: ${document.documentElement.dataset.theme}`;try{await navigator.clipboard.writeText(message);showToast('Paleta copiada!')}catch{showToast('Selecione os códigos exibidos para copiar.')}});
const saved=safeRead(COLOR_KEY);currentColor=hexToRgb(saved||'')?saved:DEFAULT_PINK;setTheme(safeRead(MODE_KEY)==='light'?'light':'dark');renderGrid();$('#year').textContent=new Date().getFullYear();