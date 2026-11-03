"use strict";

// Nexus 3D — isolated client-side concept. All records are fabricated or created locally.
const STORAGE_KEY = "77-nexus3d-concept:v1";
const STAGES = ["Novo", "Em avaliação", "Em produção", "Pronto", "Entregue"];
const PIECES = [
  { id:"p1",name:"Busto Guardião",category:"Geek",tone:"orange",kind:"mask",badge:"COLECIONÁVEL",description:"Uma peça de destaque para prateleiras e setups." },
  { id:"p2",name:"Miniatura Aventureiro",category:"Geek",tone:"violet",kind:"figure",badge:"MINIATURA",description:"Personagens originais e universos fantásticos." },
  { id:"p3",name:"Ímã Criatura Pop",category:"Personalizados",tone:"green",kind:"magnet",badge:"PERSONALIZÁVEL",description:"Um toque divertido para pequenos espaços." },
  { id:"p4",name:"Luminária Orbital",category:"Decoração",tone:"orange",kind:"lamp",badge:"DECORAÇÃO",description:"Volume, textura e personalidade na decoração." },
  { id:"p5",name:"Vaso Geométrico",category:"Decoração",tone:"blue",kind:"vase",badge:"DESIGN",description:"Formas contemporâneas para seu ambiente." },
  { id:"p6",name:"Suporte Gamer",category:"Personalizados",tone:"violet",kind:"controller",badge:"SETUP",description:"Acessórios feitos para combinar com seu cantinho." }
];
const INITIAL_ORDERS = [
 {code:"NX-1001",name:"Cliente exemplo A",product:"Suporte Gamer",color:"Preto",quantity:1,description:"Suporte de mesa em tom grafite.",reference:"",stage:"Em produção",created:"02/11/2026",fictional:true},
 {code:"NX-1002",name:"Cliente exemplo B",product:"Miniatura Aventureiro",color:"Laranja",quantity:2,description:"Duas miniaturas para decoração.",reference:"",stage:"Em avaliação",created:"02/11/2026",fictional:true},
 {code:"NX-1003",name:"Cliente exemplo C",product:"Vaso Geométrico",color:"Branco",quantity:1,description:"Vaso com acabamento fosco.",reference:"",stage:"Pronto",created:"02/11/2026",fictional:true}
];
const INITIAL_STATE = () => ({orders:INITIAL_ORDERS.map(x=>({...x})),visible:PIECES.map(p=>p.id)});
function safeText(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function loadState(){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY));if(parsed&&Array.isArray(parsed.orders)&&Array.isArray(parsed.visible)&&parsed.orders.every(o=>STAGES.includes(o.stage)&&typeof o.code==="string"))return parsed;}catch{}return INITIAL_STATE();}
let state=loadState(),selectedCategory="Todos",selectedOrderFilter="Todos",lastFocus=null,toastTimeout;
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}
function byId(id){return document.getElementById(id);}
function artwork(kind){
 const shapes = {
  mask:'<path d="M74 175 92 79l43-35 46 35 17 96-24 54-41 19-38-19Z" fill="url(#g)" stroke="#f8ad66" stroke-width="3"/><path d="m77 83-31-51 54 22 23 33m47 0 23-33 54-22-31 51" fill="#db651e" stroke="#f8ad66" stroke-width="3"/><path d="m97 145 28 6-24 21-16-8Zm75 0-28 6 25 21 16-8Z" fill="#121b20"/><path d="m126 168 9 19 10-19-10-8Z" fill="#4f2219"/><path d="m105 200 31 14 29-14-30 32Z" fill="#263039"/><path d="M90 104q47-40 92 0" fill="none" stroke="#ffdfae" stroke-width="5" opacity=".6"/>',
  figure:'<path d="M124 77 98 55l-19 40 35 35 50-2 33-37-21-38-27 23Z" fill="#d6a079"/><circle cx="138" cy="102" r="33" fill="#f6d1a2"/><path d="m102 97 5-35 28-25 39 15 14 42-22-17-14-10-17 21-16-10Z" fill="#5a3967"/><path d="m110 105 13 5m32-5 13 5" stroke="#442d34" stroke-width="4" stroke-linecap="round"/><path d="M102 138q36-28 73 0l25 56-39 24-62-5-25-27Z" fill="url(#g)" stroke="#e6a9ff" stroke-width="3"/><path d="m79 181-30 44m144-44 30 37" stroke="#dca9a0" stroke-width="16" stroke-linecap="round"/><path d="m113 215-21 37m63-37 27 37" stroke="#37364d" stroke-width="25" stroke-linecap="round"/><path d="M80 150 202 208" stroke="#d6d8e5" stroke-width="7"/><path d="m80 150-19-14 9 21Z" fill="#fff"/>',
  magnet:'<path d="M86 98q-2-60 56-65 66-1 68 62 41 19 27 70-8 36-48 41-20 31-52 28-33 0-53-28-45-6-47-49-3-39 49-59Z" fill="url(#g)" stroke="#b2ff99" stroke-width="4"/><path d="M71 84 51 42l47 25m93 0 47-25-18 45" fill="#2b7538" stroke="#a6ff83" stroke-width="3"/><ellipse cx="102" cy="132" rx="20" ry="30" fill="#10251c"/><ellipse cx="175" cy="132" rx="20" ry="30" fill="#10251c"/><circle cx="108" cy="125" r="7" fill="#eaffd4"/><circle cx="181" cy="125" r="7" fill="#eaffd4"/><path d="M104 179q34 30 70-2" fill="none" stroke="#204829" stroke-width="9" stroke-linecap="round"/><circle cx="143" cy="78" r="10" fill="#d2ffb8"/>',
  lamp:'<path d="M127 220v-57h31v57m-50 3h72v13h-72Z" fill="#6d6f78"/><path d="M69 154C61 89 88 40 141 38c52-1 88 52 73 115Z" fill="url(#g)" stroke="#ffce88" stroke-width="4"/><path d="M69 153q75 20 144 0v14q-70 20-144 0Z" fill="#ffbd70"/><path d="m87 138 14-27m37-26 22-26m26 76 10-27" stroke="#ffe3ad" stroke-width="6" stroke-linecap="round" opacity=".7"/><ellipse cx="142" cy="228" rx="55" ry="10" fill="#cf6d29"/>',
  vase:'<path d="M93 39q40 16 86 0v34l-18 27 34 55-9 73q-46 25-93 0l-9-73 33-55-24-27Z" fill="url(#g)" stroke="#b3e6f0" stroke-width="3"/><ellipse cx="136" cy="40" rx="42" ry="13" fill="#1b4854" stroke="#b0dfed" stroke-width="5"/><ellipse cx="136" cy="40" rx="25" ry="6" fill="#0b232d"/><path d="M110 79q23 6 52 0M100 106q33 15 69 0M89 163q48 25 98 0M89 188q46 27 98 0M92 211q42 25 90 0" fill="none" stroke="#b1e0e7" stroke-opacity=".68" stroke-width="3"/><path d="m111 110-12 54 13 55m22-110-6 59 5 60m26-121 14 57-14 57" fill="none" stroke="#0b4554" stroke-width="5" opacity=".7"/>',
  controller:'<path d="M75 118Q77 84 112 89l59 2q39-5 44 30l19 65q4 31-24 32-16 0-34-25l-14-12h-47l-19 17q-20 26-37 14-18-11-10-35Z" fill="url(#g)" stroke="#c7a5e8" stroke-width="4"/><path d="M88 138h48m-24-24v49" stroke="#d9c7f2" stroke-width="11" stroke-linecap="round"/><circle cx="175" cy="131" r="8" fill="#fe9656"/><circle cx="194" cy="150" r="8" fill="#fe9656"/><circle cx="177" cy="163" r="7" fill="#c5d2f3"/><circle cx="157" cy="149" r="7" fill="#c5d2f3"/><path d="M127 175h37" stroke="#161821" stroke-width="9" stroke-linecap="round"/><path d="M105 90V58h68v32" stroke="#7d7d98" stroke-width="14"/><path d="M93 58h92v17H93Z" fill="#343e4b"/><path d="M96 73h83" stroke="#d9c9ea" stroke-width="3"/>'
 };
 const shades={mask:["#ffb267","#b54717"],figure:["#eeb6e8","#6e4591"],magnet:["#89e478","#306b39"],lamp:["#ffd18b","#b95b1d"],vase:["#9bd9e8","#276c82"],controller:["#c5a2ed","#6c468a"]};
 const colors=shades[kind]||shades.mask;
 return '<svg viewBox="0 0 280 280" role="img" aria-label="Ilustração conceitual original do produto"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+colors[0]+'"/><stop offset=".5" stop-color="'+colors[1]+'"/><stop offset="1" stop-color="#1c2125"/></linearGradient></defs><ellipse cx="142" cy="250" rx="81" ry="12" fill="#000" opacity=".48"/><path d="M67 225 142 208l73 17v20l-73 22-75-22Z" fill="#333840" stroke="#5f6870" stroke-width="2"/><path d="m67 225 75 16 73-16" fill="none" stroke="#737b81" stroke-width="2"/>'+shapes[kind]+'</svg>';
}
function renderProducts(){
 const items=PIECES.filter(p=>state.visible.includes(p.id)&&(selectedCategory==="Todos"||p.category===selectedCategory));
 byId("product-grid").innerHTML=items.length?items.map((p,i)=>'<article class="product-card"><div class="product-visual" data-tone="'+p.tone+'"><span class="product-tag">'+p.badge+'</span>'+artwork(p.kind)+'<span class="product-number">0'+(PIECES.indexOf(p)+1)+' / 06</span></div><div class="product-meta"><h3>'+safeText(p.name)+'</h3><p>'+safeText(p.description)+'</p><div class="product-bottom"><span class="on-request">SOB ORÇAMENTO</span><button class="product-action" type="button" data-quote="'+p.id+'">Personalizar ↗</button></div></div></article>').join(""):'<div class="empty-products">Nenhum produto nesta categoria. Você também pode solicitar algo personalizado.</div>';
 document.querySelectorAll("[data-filter]").forEach(b=>{let active=b.dataset.filter===selectedCategory;b.classList.toggle("active",active);b.setAttribute("aria-pressed",active?"true":"false");});
 const count=byId("product-grid").children.length;
 const total=byId("colecao").querySelector(".filter[data-filter='Todos'] span");if(total)total.textContent=String(state.visible.length).padStart(2,"0");
}
function renderCatalog(){
 byId("catalog-settings").innerHTML=PIECES.map(p=>'<label class="catalog-line"><span><b>'+safeText(p.name)+'</b><small>'+safeText(p.category)+'</small></span><input type="checkbox" class="toggle" data-catalog-toggle="'+p.id+'" aria-label="Mostrar '+safeText(p.name)+' na vitrine" '+(state.visible.includes(p.id)?"checked":"")+'></label>').join("");
}
function renderAdmin(){
 const total=state.orders.length,newOrders=state.orders.filter(o=>o.stage==="Novo").length,active=state.orders.filter(o=>["Em avaliação","Em produção"].includes(o.stage)).length,ready=state.orders.filter(o=>o.stage==="Pronto").length;
 const metrics=[["Solicitações",total,"Total no cenário local"],["Aguardando análise",newOrders,"Primeira etapa da fila"],["Em andamento",active,"Avaliação ou produção"],["Prontos",ready,"Aguardando entrega"]];
 byId("metrics").innerHTML=metrics.map(x=>'<article class="metric"><span class="metric-label">'+x[0]+'</span><strong class="metric-value">'+x[1]+'</strong><small class="metric-note">'+x[2]+'</small></article>').join("");
 const filters=["Todos",...STAGES];
 byId("order-filters").innerHTML=filters.map(f=>'<button type="button" class="order-filter '+(f===selectedOrderFilter?"active":"")+'" data-order-filter="'+safeText(f)+'" aria-pressed="'+(f===selectedOrderFilter)+'">'+safeText(f)+'</button>').join("");
 const orders=state.orders.filter(o=>selectedOrderFilter==="Todos"||o.stage===selectedOrderFilter).slice().reverse();
 byId("orders-list").innerHTML=orders.length?orders.map(o=>{
  const next=STAGES[STAGES.indexOf(o.stage)+1],additional=o.fictional?"Dados fictícios de exemplo":"Criado neste navegador";
  return '<article class="order-card"><div class="order-card-top"><span class="order-code">'+safeText(o.code)+'</span><span class="status-pill" data-status="'+safeText(o.stage)+'">'+safeText(o.stage)+'</span></div><h3>'+safeText(o.product)+'</h3><p>'+safeText(o.name)+' · '+safeText(o.color)+' · '+o.quantity+' unidade(s)</p><p>'+safeText(o.description)+'</p><div class="order-detail">'+safeText(o.created)+' · '+additional+'</div><div class="order-actions"><button class="small-quiet" type="button" data-follow-code="'+safeText(o.code)+'">Ver acompanhamento ↗</button>'+(next?'<button class="order-next" type="button" data-next="'+safeText(o.code)+'">Avançar para '+safeText(next)+' →</button>':'<span class="status-pill" data-status="Entregue">Fluxo concluído</span>')+'</div></article>';
 }).join(""):'<div class="orders-empty">Nenhuma encomenda neste estágio.</div>';
 renderCatalog();
}
function updateStage(code){const order=state.orders.find(o=>o.code===code);if(!order)return;const ix=STAGES.indexOf(order.stage);if(ix>=0&&ix<STAGES.length-1){order.stage=STAGES[ix+1];persist();renderAdmin();notify("Encomenda "+code+" atualizada para "+order.stage+".");}}
function viewTo(view){
 const admin=view==="admin";
 byId("customer-view").hidden=admin;byId("admin-view").hidden=!admin;
 document.title=(admin?"Gestão demo":"Vitrine demo")+" | Nexus 3D";
 if(admin)renderAdmin();else renderProducts();
 closeModal();if(admin||location.hash==="#inicio")window.scrollTo({top:0,behavior:"instant"});
}
function route(){viewTo(location.hash==="#gestao"?"admin":"customer");}
function goTo(view){const hash=view==="admin"?"#gestao":"#inicio";if(location.hash===hash)route();else location.hash=hash;}
function openModal(element){
 lastFocus=document.activeElement;byId("overlay").hidden=false;element.hidden=false;document.body.style.overflow="hidden";
 const first=element.querySelector("input,select,button");if(first)first.focus();
}
function closeModal(){byId("quote-drawer").hidden=true;byId("result-dialog").hidden=true;byId("overlay").hidden=true;document.body.style.overflow="";if(lastFocus&&lastFocus.isConnected&&typeof lastFocus.focus==="function")lastFocus.focus();lastFocus=null;}
function openQuote(productId){
 const options=[{id:"other",name:"Uma ideia totalmente nova"},...PIECES.filter(p=>state.visible.includes(p.id))];
 const select=byId("quote-product");select.innerHTML=options.map(p=>'<option value="'+p.id+'">'+safeText(p.name)+'</option>').join("");
 select.value=options.some(p=>p.id===productId)?productId:"other";
 openModal(byId("quote-drawer"));
}
function notify(text){const node=byId("toast");node.textContent=text;node.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>node.hidden=true,3500);}
function showResult(html){closeModal();byId("result-content").innerHTML=html;openModal(byId("result-dialog"));}
function statusView(order){
 let current=STAGES.indexOf(order.stage);
 return '<div class="stepper">'+STAGES.map((s,i)=>'<div class="stepper-row '+(i<=current?"done":"")+'"><strong>'+safeText(s)+(i===current?" · etapa atual":"")+'</strong><small>'+(i<current?"Etapa concluída na simulação":i===current?"Status exibido no cenário local":"Aguardando avanço")+'</small></div>').join("")+'</div>';
}
function showTracking(code){
 const normalized=String(code||"").trim().toUpperCase(),order=state.orders.find(o=>o.code===normalized);
 if(!order){notify("Código não encontrado. Experimente NX-1001.");return;}
 showResult('<span class="section-kicker">ACOMPANHAMENTO / DEMO</span><div class="result-icon">⌁</div><h2>Seu pedido, de perto.</h2><p>Informações ilustrativas da encomenda <b>'+safeText(order.product)+'</b>.</p><div class="big-code">'+safeText(order.code)+'</div>'+statusView(order)+'<p>Os status só mudam neste navegador, pela visão de gestão demonstrativa.</p><div class="result-actions"><button class="btn btn-primary" data-view-target="admin" type="button">Abrir gestão ↗</button><button class="btn btn-outline" type="button" data-close>Fechar</button></div>');
}
function submitQuote(e){
 e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;
 const data=new FormData(form),name=String(data.get("name")||"").trim(),desc=String(data.get("description")||"").trim(),qty=Number(data.get("quantity"));
 if(name.length<2||desc.length<5||!Number.isInteger(qty)||qty<1||qty>100){notify("Confira nome, descrição e quantidade (1 a 100).");return;}
 const chosen=PIECES.find(p=>p.id===data.get("product"));const item=chosen?chosen.name:"Projeto totalmente personalizado";
 const max=Math.max(1003,...state.orders.map(o=>Number(o.code.replace(/\D/g,""))||0)),code="NX-"+String(max+1);
 state.orders.push({code,name:name.slice(0,60),product:item,color:String(data.get("color")||""),quantity:qty,description:desc.slice(0,800),reference:String(data.get("reference")||"").slice(0,400),stage:"Novo",created:new Date().toLocaleDateString("pt-BR"),fictional:false});
 persist();form.reset();
 showResult('<div class="result-icon">✓</div><span class="section-kicker">SOLICITAÇÃO CRIADA / DEMO</span><h2>Ideia registrada!</h2><p>Seu orçamento de demonstração foi salvo <b>somente neste dispositivo</b>. Nenhuma mensagem foi enviada à Nexus 3D.</p><div class="big-code">'+safeText(code)+'</div><p>Guarde esse código para visualizar as etapas simuladas do projeto.</p><div class="result-actions"><button class="btn btn-primary" type="button" data-follow-code="'+safeText(code)+'">Acompanhar pedido ↗</button><button class="btn btn-outline" type="button" data-copy-code="'+safeText(code)+'">Copiar código</button></div>');
}
function installEvents(){
 document.addEventListener("click",e=>{
  const quote=e.target.closest("[data-quote]");if(quote){e.preventDefault();openQuote(quote.dataset.quote);return;}
  const switcher=e.target.closest("[data-view-target]");if(switcher){e.preventDefault();goTo(switcher.dataset.viewTarget);return;}
  if(e.target.closest("[data-close]")){closeModal();return;}
  const filter=e.target.closest("[data-filter]");if(filter){selectedCategory=filter.dataset.filter;renderProducts();return;}
  const orderFilter=e.target.closest("[data-order-filter]");if(orderFilter){selectedOrderFilter=orderFilter.dataset.orderFilter;renderAdmin();return;}
  const next=e.target.closest("[data-next]");if(next){updateStage(next.dataset.next);return;}
  const follow=e.target.closest("[data-follow-code]");if(follow){showTracking(follow.dataset.followCode);return;}
  const copy=e.target.closest("[data-copy-code]");if(copy){navigator.clipboard?.writeText(copy.dataset.copyCode).then(()=>notify("Código copiado!")).catch(()=>notify("Código: "+copy.dataset.copyCode));return;}
 });
 document.addEventListener("change",e=>{const checkbox=e.target.closest("[data-catalog-toggle]");if(!checkbox)return;const pid=checkbox.dataset.catalogToggle;if(checkbox.checked&&!state.visible.includes(pid))state.visible.push(pid);else if(!checkbox.checked)state.visible=state.visible.filter(id=>id!==pid);persist();renderProducts();notify("Vitrine de demonstração atualizada.");});
 byId("quote-form").addEventListener("submit",submitQuote);
 byId("track-form").addEventListener("submit",e=>{e.preventDefault();showTracking(byId("tracking-input").value);});
 byId("reset-demo").addEventListener("click",()=>{if(!confirm("Restaurar pedidos e catálogo fictícios deste navegador?"))return;state=INITIAL_STATE();selectedOrderFilter="Todos";selectedCategory="Todos";persist();renderAdmin();renderProducts();notify("Cenário de demonstração restaurado.");});
 byId("overlay").addEventListener("click",closeModal);
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&(!byId("quote-drawer").hidden||!byId("result-dialog").hidden)){closeModal();return;}const active=!byId("quote-drawer").hidden?byId("quote-drawer"):!byId("result-dialog").hidden?byId("result-dialog"):null;if(active&&e.key==="Tab"){const focusables=Array.from(active.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')).filter(el=>el.offsetParent!==null);if(!focusables.length)return;const first=focusables[0],last=focusables[focusables.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 window.addEventListener("hashchange",route);
}
installEvents();renderProducts();route();
