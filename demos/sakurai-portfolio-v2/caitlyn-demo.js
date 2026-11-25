'use strict';
// RFB V9: demonstração de materiais e técnicas inteiramente fictícios; dados nunca associados a encomendas reais.
const CK_PIECES = [
  {id:'peruca',n:'01',title:'Peruca azul-petróleo',category:'caracterizacao',categoryLabel:'Caracterização',material:'Fibra sintética termorresistente',finish:'Modelagem suave, risca lateral e pontas alinhadas',desc:'Volume longo, repartição lateral e acabamento acetinado reproduzem a silhueta do personagem.',note:'Exemplo: separar mechas frontais, testar caimento e registrar fotos de ângulo antes da finalização.',swatch:'#263d74',mark:'✦'},
  {id:'maquiagem',n:'02',title:'Maquiagem de personagem',category:'caracterizacao',categoryLabel:'Caracterização',material:'Base facial, sombra fria e delineador cosmético',finish:'Definição de sobrancelhas e iluminação discreta',desc:'Caracterização inspirada na expressão firme e nas cores sóbrias da referência.',note:'Exemplo: fotografar os testes sob luz branca e luz de evento para avaliar a leitura da expressão.',swatch:'#9e8aa9',mark:'✧'},
  {id:'casaco',n:'03',title:'Casaco azul estruturado',category:'figurino',categoryLabel:'Figurino',material:'Sarja azul-marinho, forro acetinado e entretela',finish:'Vivo dourado decorativo, recortes e gola estruturada',desc:'A principal peça da silhueta: casaco de uniforme com linhas retas e aparência imponente.',note:'Exemplo: testar ombros e fechamento no manequim antes de aplicar os acabamentos.',swatch:'#183158',mark:'▧'},
  {id:'ombreiras',n:'04',title:'Ombreiras com detalhes dourados',category:'figurino',categoryLabel:'Figurino',material:'Espuma EVA fina e revestimento em tecido sintético azul',finish:'Pintura acrílica metálica e bordas macias',desc:'Volumes leves nos ombros criam a leitura militar estilizada do uniforme.',note:'Exemplo: optar por peças leves, sem pontas rígidas, priorizando mobilidade e conforto.',swatch:'#bc9c66',mark:'◈'},
  {id:'blusa',n:'05',title:'Camisa branca interna',category:'figurino',categoryLabel:'Figurino',material:'Tricoline branca e botões decorativos',finish:'Costuras embutidas e gola alinhada',desc:'Camada clara que contrasta com o casaco e organiza a região do pescoço.',note:'Exemplo: preparar uma versão leve para eventos prolongados, com tecido respirável.',swatch:'#ece7df',mark:'▤'},
  {id:'jabo',n:'06',title:'Jabô branco plissado',category:'figurino',categoryLabel:'Figurino',material:'Crepe branco e fita de acabamento',finish:'Pregas pequenas, tecido sobreposto e queda suave',desc:'Adereço frontal de tecido que cria movimento no centro do figurino.',note:'Exemplo: usar fixação removível para facilitar transporte e higienização da peça.',swatch:'#e1e4f0',mark:'≋'},
  {id:'broche',n:'07',title:'Broche de brasão',category:'acessorios',categoryLabel:'Acessórios',material:'Base de resina decorativa e acabamento em tinta acrílica',finish:'Dourado antigo com centro azul de aparência esmaltada',desc:'Ponto focal circular no colarinho, pensado como joia cenográfica leve.',note:'Exemplo: usar base lisa e cantos arredondados, evitando metal pesado perto da garganta.',swatch:'#c4a361',mark:'✺'},
  {id:'colete',n:'08',title:'Colete interno',category:'figurino',categoryLabel:'Figurino',material:'Malha estruturada azul, forro de algodão e velcro',finish:'Painéis geométricos, curvas sutis e costura reforçada',desc:'Camada intermediária que completa o peito e dá continuidade ao uniforme.',note:'Exemplo: registrar o caimento sobre a camisa e sob o casaco antes de fechar ajustes.',swatch:'#35548a',mark:'◧'},
  {id:'cinto',n:'09',title:'Cinto e fivela',category:'acessorios',categoryLabel:'Acessórios',material:'Courino azul-escuro e fivela de resina',finish:'Dourado envelhecido e pesponto aparente',desc:'Linha horizontal de organização do uniforme e suporte visual de pequenos acessórios.',note:'Exemplo: fazer encaixes confortáveis e manter o peso das peças distribuído.',swatch:'#71533d',mark:'◎'},
  {id:'calca',n:'10',title:'Calça de alfaiataria',category:'figurino',categoryLabel:'Figurino',material:'Sarja stretch azul-profundo',finish:'Vincos marcados, cós confortável e barras ajustadas',desc:'Parte inferior proposta para combinar com a estrutura do casaco e das botas.',note:'Exemplo: prever amplitude de movimento para caminhar e sentar em eventos.',swatch:'#273a60',mark:'║'},
  {id:'luvas',n:'11',title:'Luvas e punhos',category:'acessorios',categoryLabel:'Acessórios',material:'Malha elástica escura e couro sintético macio',finish:'Faixas azuladas e pequenos apliques decorativos',desc:'Acabamento das mãos para complementar a caracterização, sem reduzir mobilidade.',note:'Exemplo: utilizar material que permita segurar objetos leves e operar o celular.',swatch:'#2b2937',mark:'✥'},
  {id:'botas',n:'12',title:'Botas de personagem',category:'figurino',categoryLabel:'Figurino',material:'Calçado-base confortável, tecido sintético e EVA flexível',finish:'Sobreposição azul e contornos dourados decorativos',desc:'Peças imaginadas para fechar a silhueta sem comprometer a estabilidade ao caminhar.',note:'Exemplo: experimentar o calçado com o figurino inteiro e testar o conforto.',swatch:'#17263c',mark:'⌁'},
  {id:'bolsa',n:'13',title:'Bolsa e pequenos acessórios',category:'acessorios',categoryLabel:'Acessórios',material:'Courino macio, espuma leve e fechos plásticos',finish:'Aplique do brasão e detalhes em bronze fosco',desc:'Complementos para tornar a composição mais rica e útil no universo visual da personagem.',note:'Exemplo: compartimentos leves para guardar itens pessoais durante uma sessão fotográfica.',swatch:'#725d55',mark:'◇'},
  {id:'rifle',n:'14',title:'Rifle cenográfico (prop)',category:'prop',categoryLabel:'Prop cenográfico',material:'Blocos de espuma EVA, papelão artístico e detalhes de resina decorativa',finish:'Pintura acrílica azul, cobre e dourado envelhecido',desc:'Acessório de palco fantasioso e inteiramente não funcional para compor poses e fotografias.',note:'Exemplo cenográfico: sem mecanismo, disparo, munição ou instruções de fabricação de arma. Conferir regras de props do evento.',swatch:'#bea26e',mark:'✳'},
];
const CK_CHAPTERS=[
  {title:'Construindo a leitura do personagem',text:'Uma entrada-modelo que organiza os elementos-chave: volumes azuis, dourado pontual, branco próximo ao rosto e a silhueta longa do uniforme.',note:'Paleta inventada: azul-marinho, azul-petróleo, dourado antigo e branco frio. A ilustração é referência visual, não fotografia da artista.'},
  {title:'Separando as camadas do figurino',text:'Diário fictício de planejamento de caimento: casaco, camada branca interna, jabô e peças de ombro foram tratados como conjuntos independentes.',note:'Modelo de anotação: observar conforto e mobilidade antes da decoração. As peças e métodos são somente exemplos de conteúdo editorial.'},
  {title:'O que faz cada acabamento aparecer',text:'Um capítulo de demonstração sobre contraste entre costuras discretas, vivo dourado, pregas brancas e superfícies azuladas.',note:'Modelo de tutorial: documentar os materiais usados pela artista, fotos de processo e dicas aprovadas por ela, sem usar estas etapas inventadas como fatos.'},
  {title:'O adereço que completa a silhueta',text:'Exemplo de registro para um rifle de fantasia, tratado exclusivamente como objeto de cena leve e não funcional.',note:'Ficha fictícia: EVA, papelão artístico, resina decorativa e tinta acrílica. Não descreve mecanismo de arma nem medidas de construção.'},
  {title:'Ensaio, transporte e último ajuste',text:'Exemplo de capítulo final com checklist de conforto, elementos de cena, embalagem e uma futura galeria de fotografias de resultado.',note:'Quando o material real da Sakurai chegar, esta área poderá guardar comentários dela, imagens autorais e créditos individuais de fotografia.'},
];
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const $ = (s,root=document)=>root.querySelector(s);
let ckFilter='todos',ckSearch='',ckChapter=0;
const categoryLabels={figurino:'Figurino',caracterizacao:'Caracterização',acessorios:'Acessórios',prop:'Prop cenográfico'};
function pieceById(id){return CK_PIECES.find(p=>p.id===id)}
function drawInventory(){
 const grid=$('#ck-piece-grid');
 if(!grid)return;
 grid.replaceChildren();
 const q=ckSearch.toLocaleLowerCase('pt-BR');
 const pieces=CK_PIECES.filter(p=>(ckFilter==='todos'||p.category===ckFilter)&&[p.title,p.material,p.finish,p.desc,p.categoryLabel].join(' ').toLocaleLowerCase('pt-BR').includes(q));
 pieces.forEach(piece=>{
  const card=document.createElement('button');card.type='button';card.className='ck-piece-card';card.dataset.id=piece.id;
  const top=document.createElement('span');top.className='ck-piece-top';top.textContent=piece.n+' / '+piece.categoryLabel;
  const mark=document.createElement('span');mark.className='ck-piece-mark';mark.style.background='radial-gradient(circle at 25% 20%, #ffffff36, transparent 65%),'+piece.swatch;mark.textContent=piece.mark;mark.setAttribute('aria-hidden','true');
  const title=document.createElement('strong');title.textContent=piece.title;
  const material=document.createElement('small');material.textContent=piece.material;
  const more=document.createElement('span');more.className='ck-piece-more';more.textContent='Explorar ficha ↗';
  card.append(top,mark,title,material,more);card.addEventListener('click',()=>openPiece(piece.id));grid.append(card);
 });
 $('#ck-empty').hidden=pieces.length!==0;
}
function selectInspector(id){
 const p=pieceById(id);if(!p)return;
 $('#inspector-title').textContent=p.title;$('#inspector-desc').textContent=p.desc;$('#inspector-material').textContent=p.material;$('#inspector-finish').textContent=p.finish;$('#inspector-category').textContent=p.categoryLabel;
 $('#inspector-swatch').style.background='linear-gradient(135deg,#ffffff35,transparent 60%),'+p.swatch;
 $('#inspector-panel .ck-mini').textContent='PEÇA EM DESTAQUE / '+p.n;
 $$('.ck-hotspot').forEach(b=>{let selected=b.dataset.piece===id;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});
}
function openPiece(id){
 const p=pieceById(id),dialog=$('#ck-piece-dialog');if(!p||!dialog)return;
 $('#ck-dialog-title').textContent=p.title;$('#ck-dialog-desc').textContent=p.desc;$('#ck-dialog-material').textContent=p.material;$('#ck-dialog-finish').textContent=p.finish;$('#ck-dialog-note').textContent=p.note;$('#ck-dialog-swatch').style.background='radial-gradient(circle at 20% 15%,#ffffff45,transparent 60%),'+p.swatch;
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
function selectChapter(n){
 const idx=(n+CK_CHAPTERS.length)%CK_CHAPTERS.length,p=CK_CHAPTERS[idx];ckChapter=idx;
 $('#chapter-counter').textContent='CAPÍTULO '+String(idx+1).padStart(2,'0')+' / 05 · EXEMPLO';
 $('#chapter-title').textContent=p.title;$('#chapter-text').textContent=p.text;$('#chapter-note').textContent=p.note;
 $$('.ck-chapter').forEach(b=>{const yes=Number(b.dataset.chapter)===idx;b.classList.toggle('active',yes);b.setAttribute('aria-selected',String(yes));b.tabIndex=yes?0:-1});
}
document.addEventListener('DOMContentLoaded',()=>{
 drawInventory();selectInspector('peruca');selectChapter(0);
 $$('.ck-hotspot').forEach(b=>b.addEventListener('click',()=>selectInspector(b.dataset.piece)));
 $$('.ck-filter').forEach(b=>b.addEventListener('click',()=>{ckFilter=b.dataset.filter;$$('.ck-filter').forEach(btn=>{const on=btn===b;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on))});drawInventory()}));
 $('#ck-search').addEventListener('input',e=>{ckSearch=e.target.value.trim();drawInventory()});
 $('#ck-dialog-close').addEventListener('click',()=>$('#ck-piece-dialog').close());
 $('#ck-piece-dialog').addEventListener('click',e=>{if(e.target===$('#ck-piece-dialog'))e.target.close()});
 $$('.ck-chapter').forEach(b=>{b.addEventListener('click',()=>selectChapter(Number(b.dataset.chapter)));b.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();let delta=(e.key==='ArrowDown'||e.key==='ArrowRight')?1:-1;selectChapter(ckChapter+delta);$$('.ck-chapter')[ckChapter].focus()}})});
 $('#ck-next-chapter').addEventListener('click',()=>selectChapter(ckChapter+1));
 $('#ck-print').addEventListener('click',()=>window.print());
});
