(function(){
"use strict";
const STORAGE="demo-77-glaucosplay-v1";
const STATES=["recebido","orçamento","produção","finalizado"];
const LABELS={"recebido":"Recebido","orçamento":"Em orçamento","produção":"Em produção","finalizado":"Finalizado"};
const SAMPLES=[
{id:"GC-1024",nome:"Alex (exemplo)",tipo:"Peça ou acessório",descricao:"Acessório cenográfico para um figurino fantástico.",prazo:"2026-12",fase:"Já tenho referências",status:"produção",fixture:true},
{id:"GC-1025",nome:"Organização (exemplo)",tipo:"Convite para evento",descricao:"Possível participação em festival temático.",prazo:"2027-01",fase:"Consultar disponibilidade",status:"recebido",fixture:true},
{id:"GC-1026",nome:"Rafa (exemplo)",tipo:"Figurino",descricao:"Conversa inicial sobre peça personalizada.",prazo:"2027-02",fase:"Só tenho uma ideia",status:"orçamento",fixture:true}
];
function getOrders(){try{let list=JSON.parse(localStorage.getItem(STORAGE));if(Array.isArray(list))return list;}catch(e){}return SAMPLES.map(x=>({...x}));}
function save(list){try{localStorage.setItem(STORAGE,JSON.stringify(list));}catch(e){toast("O navegador não permitiu guardar os dados.");}}
function escapeHtml(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
let toastTimeout;function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.hidden=true,4400);}
function navigate(view,extra={}){const p=new URLSearchParams({view,...extra});history.pushState({},"","?"+p.toString());render();window.scrollTo({top:0,behavior:"instant"});}
function render(){const p=new URLSearchParams(location.search);let view=p.get("view")||"vitrine";if(!["vitrine","orcamento","acompanhar","gestao"].includes(view))view="vitrine";
document.querySelectorAll("[data-view]").forEach(el=>el.hidden=el.dataset.view!==view);
document.querySelectorAll(".nav button").forEach(el=>{if(el.dataset.go===view)el.setAttribute("aria-current","page");else el.removeAttribute("aria-current");});
if(view==="orcamento"&&p.get("kind")==="evento")document.getElementById("tipo").value="Convite para evento";
if(view==="acompanhar"){let id=p.get("id");if(id){document.getElementById("search-code").value=id;renderTracking(id);}else document.getElementById("tracking").innerHTML='<div class="empty">Digite um código ou use o pedido de exemplo GC-1024.</div>';}
if(view==="gestao")renderAdmin();
document.title=({"vitrine":"Cosplay & criação","orcamento":"Solicitar orçamento","acompanhar":"Acompanhar projeto","gestao":"Painel do estúdio"}[view])+" — demonstração conceitual";
}
function renderTracking(id){
const order=getOrders().find(x=>x.id.toUpperCase()===String(id).trim().toUpperCase());
const el=document.getElementById("tracking");
if(!order){el.innerHTML='<div class="empty"><b>Código não encontrado.</b><p>Experimente GC-1024 para visualizar a linha do tempo.</p></div>';return;}
const current=STATES.indexOf(order.status);
const descriptions=["A ideia foi registrada no cenário de demonstração.","Escopo e viabilidade em análise.","Etapa de criação ou preparação em andamento.","O projeto foi marcado como concluído."];
el.innerHTML='<div class="track-header"><div class="eyebrow">'+escapeHtml(order.id)+' · '+(order.fixture?"EXEMPLO FICTÍCIO":"TESTE LOCAL")+'</div><h3>'+escapeHtml(order.tipo)+'</h3><p>'+escapeHtml(order.descricao)+'</p><span class="status-chip">'+LABELS[order.status]+'</span></div><div class="timeline">'+STATES.map((s,i)=>'<div class="milestone '+(i<current?"done":i===current?"active":"")+'"><span class="dot"></span><div><h4>'+LABELS[s]+'</h4><p>'+descriptions[i]+'</p></div></div>').join("")+'</div>';
}
function renderAdmin(){const orders=getOrders(),filter=document.getElementById("filter").value;
const nums=[["Solicitações",orders.length],["Aguardando análise",orders.filter(x=>["recebido","orçamento"].includes(x.status)).length],["Em andamento",orders.filter(x=>x.status==="produção").length]];
document.getElementById("stats").innerHTML=nums.map(([t,n])=>'<div class="stat"><span>'+t+'</span><b>'+n+'</b><span>dados de teste</span></div>').join("");
const visible=orders.filter(x=>filter==="todas"||x.status===filter);
document.getElementById("orders").innerHTML=visible.length?visible.map(x=>{
const next=STATES.indexOf(x.status)<STATES.length-1;
return '<article class="order"><div><div class="code">'+escapeHtml(x.id)+' · '+(x.fixture?"FICTÍCIO":"CRIADO AQUI")+'</div><h3>'+escapeHtml(x.tipo)+'</h3><p>'+escapeHtml(x.nome)+' — '+escapeHtml(x.descricao).slice(0,170)+'</p></div><div class="order-status"><b>'+LABELS[x.status]+'</b><small>'+escapeHtml(x.prazo||"Prazo não informado")+'</small></div><button type="button" data-advance="'+escapeHtml(x.id)+'" '+(next?"":"disabled")+'>'+(next?"Avançar etapa →":"Finalizado")+'</button></article>';
}).join(""):'<div class="empty">Não há solicitações neste filtro.</div>';
}
document.addEventListener("click",e=>{
const nav=e.target.closest("[data-go]");if(nav){navigate(nav.dataset.go,nav.dataset.kind?{kind:nav.dataset.kind}:{});return;}
const advance=e.target.closest("[data-advance]");if(advance){const list=getOrders(),order=list.find(x=>x.id===advance.dataset.advance);if(!order)return;const n=STATES.indexOf(order.status);if(n>=0&&n<STATES.length-1){order.status=STATES[n+1];save(list);renderAdmin();toast("Etapa atualizada somente na demonstração.");}}
});
document.getElementById("request-form").addEventListener("submit",e=>{
e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;
const d=new FormData(f),list=getOrders();let id;do{id="GC-"+Math.floor(2000+Math.random()*7000);}while(list.some(x=>x.id===id));
list.unshift({id,nome:String(d.get("nome")).trim(),tipo:String(d.get("tipo")),descricao:String(d.get("descricao")).trim(),prazo:String(d.get("prazo")||""),fase:String(d.get("fase")||""),status:"recebido",fixture:false});
save(list);f.reset();navigate("acompanhar",{id});toast("Solicitação de teste "+id+" criada. Nenhum envio real foi feito.");
});
document.getElementById("track-form").addEventListener("submit",e=>{e.preventDefault();renderTracking(document.getElementById("search-code").value);});
document.getElementById("example-code").addEventListener("click",()=>{document.getElementById("search-code").value="GC-1024";renderTracking("GC-1024");});
document.getElementById("filter").addEventListener("change",renderAdmin);
document.getElementById("reset").addEventListener("click",()=>{save(SAMPLES.map(x=>({...x})));document.getElementById("filter").value="todas";renderAdmin();toast("Cenário fictício restaurado.");});
window.addEventListener("popstate",render);
render();
})();