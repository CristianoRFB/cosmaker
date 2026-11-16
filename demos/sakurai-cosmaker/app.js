'use strict';
/** Sakurai — isolated, unofficial concept demo. No backend or network mutations. */
(() => {
  const KEY = '77_sakurai_demo_v1';
  const STAGES = [
    {label:'Ideia e referências', description:'O conceito e os elementos do figurino são alinhados.'},
    {label:'Planejamento e modelagem',description:'A estrutura, as medidas e os materiais são organizados.'},
    {label:'Costura e composição',description:'As peças estão sendo construídas e combinadas.'},
    {label:'Detalhes e acabamentos',description:'Os últimos detalhes estão em revisão.'},
    {label:'Projeto concluído',description:'O processo ilustrativo foi finalizado.'}
  ];
  const ART = {
    eclipse:{name:'Guardiã do Eclipse',category:'fantasia',sub:'Tecidos, estrutura e brilho',file:'eclipse.svg',story:'Contraste entre tecidos escuros, acabamento escarlate e ornamentos dourados. Uma ideia de como um projeto poderia ter referências, materiais e etapas documentados.'},
    cristal:{name:'Jardim de Cristal',category:'detalhes',sub:'Camadas, bordados e textura',file:'cristal.svg',story:'A proposta usa volumes suaves, elementos translúcidos e detalhes florais para mostrar a riqueza de uma construção por etapas.'},
    raposa:{name:'Espírito da Raposa',category:'fantasia',sub:'Máscara, tecido e adereços',file:'raposa.svg',story:'Conceito de máscara estilizada, capa e acessórios contrastantes, pensado para demonstrar a organização visual de um portfólio.'},
    aurora:{name:'Cavaleira da Aurora',category:'armadura',sub:'Armadura, recortes e pintura',file:'aurora.svg',story:'Um estudo de volumes geométricos, peças com aparência metálica e detalhes de acabamento para explorar a categoria armaduras.'},
    flor:{name:'Flora Noturna',category:'detalhes',sub:'Aplicações, flores e composição',file:'flor.svg',story:'Camadas, aplicações delicadas e texturas rosadas organizadas como uma ficha de conceito ilustrativo.'}
  };
  const SEED = [
    {code:'DEMO-042',title:'Guardiã do Eclipse',alias:'Pessoa ilustrativa 01',art:'eclipse',step:2,publicNote:'A base das peças está em montagem. A próxima etapa será a revisão dos detalhes e acabamentos.'},
    {code:'DEMO-027',title:'Jardim de Cristal',alias:'Pessoa ilustrativa 02',art:'cristal',step:1,publicNote:'O conceito de referência foi alinhado; agora a modelagem ilustrativa começa a tomar forma.'},
    {code:'DEMO-061',title:'Cavaleira da Aurora',alias:'Pessoa ilustrativa 03',art:'aurora',step:4,publicNote:'A peça ilustrativa foi concluída. Esta etapa demonstra como o cliente poderia acompanhar a finalização.'},
    {code:'DEMO-019',title:'Espírito da Raposa',alias:'Pessoa ilustrativa 04',art:'raposa',step:0,publicNote:'Referências iniciais em organização. Este é um projeto completamente fictício.'}
  ];
  const safe = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const artSrc = id => `assets/${ART[id] ? ART[id].file : 'eclipse.svg'}`;
  const itemStage = item => STAGES[Math.min(4,Math.max(0, Number(item.step)||0))].label;
  function seed(){return SEED.map(o=>({...o}));}
  function validateRecord(o){return o && typeof o==='object' && /^DEMO-\d{3,5}$/.test(o.code) && typeof o.title==='string' && typeof o.alias==='string' && typeof o.publicNote==='string' && typeof o.step==='number' && o.step>=0 && o.step<=4 && ART[o.art];}
  function readStore(){
    try{const raw=localStorage.getItem(KEY); if(!raw)return seed();const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>30||!parsed.every(validateRecord))return seed();return parsed;}
    catch{return seed();}
  }
  function saveStore(items){try{localStorage.setItem(KEY,JSON.stringify(items));return true;}catch{return false;}}
  let items=readStore(), selected=null, activeFilter='todos', searchValue='', toastTimer;
  function toast(message){let el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3500);}
  function closeDialog(el){if(el?.open)el.close();}
  function common(){
    const button=document.getElementById('menu-btn'), links=document.getElementById('nav-links');
    button?.addEventListener('click',()=>{const open=links.classList.toggle('is-open');button.setAttribute('aria-expanded',String(open));button.textContent=open?'×':'☰';button.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');});
    links?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{links.classList.remove('is-open');button?.setAttribute('aria-expanded','false');if(button){button.textContent='☰';button.setAttribute('aria-label','Abrir menu');}}));
    document.querySelectorAll('dialog').forEach(d=>{d.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>closeDialog(d)));d.addEventListener('click',e=>{if(e.target===d)closeDialog(d);});});
  }
  function renderGallery(){
    const root=document.getElementById('gallery');if(!root)return;
    const cards=Object.entries(ART).filter(([_,v])=>activeFilter==='todos'||v.category===activeFilter);
    root.innerHTML=cards.map(([id,v])=>`<button type="button" class="project-card" data-project="${safe(id)}" aria-label="Ver detalhes do conceito ${safe(v.name)}"><span class="art-wrap"><img src="${artSrc(id)}" alt="Estudo visual ilustrativo: ${safe(v.name)}" loading="lazy"><span class="art-label">CONCEITO / DEMO</span></span><span class="card-caption"><span><h3>${safe(v.name)}</h3><p>${safe(v.sub)}</p></span><span class="round-arrow" aria-hidden="true">↗</span></span></button>`).join('');
    root.querySelectorAll('[data-project]').forEach(b=>b.addEventListener('click',()=>{
      const item=ART[b.dataset.project],dialog=document.getElementById('project-dialog');
      document.getElementById('dialog-title').textContent=item.name;
      document.getElementById('dialog-image').src=artSrc(b.dataset.project);
      document.getElementById('dialog-image').alt=`Ilustração autoral fictícia de ${item.name}`;
      document.getElementById('dialog-desc').textContent=item.story+' Esta arte é uma ilustração original da demonstração, não um trabalho feito pela Sakurai.';
      dialog.showModal();
    }));
  }
  function portfolio(){document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderGallery();}));renderGallery();}
  function trackerMessage(title,description,kind='◇'){
    document.getElementById('tracker-detail').innerHTML=`<div class="empty-state"><div class="empty-icon" aria-hidden="true">${safe(kind)}</div><h2 class="serif">${safe(title)}</h2><p>${safe(description)}</p></div>`;
  }
  function trackerDetail(item){
    if(!item){trackerMessage('Código não encontrado','Este código não existe nos dados fictícios deste navegador. Experimente DEMO-042.','?');return;}
    const badgeClass=item.step===4?'completed':item.step<=1?'preparation':'waiting';
    const dotText=i=>i<item.step?'✓':i===item.step?'●':String(i+1);
    const pct=Math.round((item.step+1)/5*100);
    document.getElementById('tracker-detail').innerHTML=`<div class="detail-content"><div class="status-head"><span class="label-kicker" style="color:var(--muted)">Projeto ${safe(item.code)} / ilustração</span><span class="status-badge ${badgeClass}">${safe(itemStage(item))}</span></div><div class="project-heading"><img src="${artSrc(item.art)}" alt="Conceito fictício do figurino"><div><h2>${safe(item.title)}</h2><p>${safe(item.alias)} · Exemplo sem encomenda real</p></div></div><hr class="detail-divider"><div class="progress-heading"><h3>Andamento do processo</h3><span>Etapa ${item.step+1} de 5</span></div><div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso ilustrativo do projeto"><div class="progress-fill" style="width:${pct}%"></div></div><ol class="timeline">${STAGES.map((stage,i)=>`<li class="${i<item.step?'done':i===item.step?'current':''}"><span class="step-dot" aria-hidden="true">${dotText(i)}</span><div><h4>${safe(stage.label)}</h4><p>${safe(stage.description)}</p></div></li>`).join('')}</ol><hr class="detail-divider"><div class="info-card"><h4>Recado da bancada <span aria-hidden="true">✳</span></h4><p>${safe(item.publicNote)}</p></div><div class="btn-row" style="margin-top:25px"><a href="atelie.html" class="btn btn-outline btn-small">Alterar etapa no ateliê demo ↗</a></div><p style="color:var(--muted);font-size:11px;margin-top:17px">Atualização local e fictícia. Nenhuma mensagem é enviada à artista ou aos seus clientes.</p></div>`;
  }
  function tracker(){
    const input=document.getElementById('lookup-code'),form=document.getElementById('lookup-form'),field=document.getElementById('lookup-field');
    const requested=new URLSearchParams(location.search).get('codigo');
    if(requested){input.value=requested.toUpperCase().slice(0,24);trackerDetail(items.find(x=>x.code===input.value));}
    else trackerMessage('Cada etapa, mais perto do resultado','Consulte DEMO-042 para visualizar um acompanhamento completo de exemplo.','✳');
    input.addEventListener('input',()=>field.classList.remove('invalid'));
    form.addEventListener('submit',e=>{e.preventDefault();const code=input.value.trim().toUpperCase();if(!/^DEMO-\d{3,5}$/.test(code)){field.classList.add('invalid');input.focus();return;}field.classList.remove('invalid');input.value=code;const item=readStore().find(x=>x.code===code);trackerDetail(item);history.replaceState(null,'',`${location.pathname}?codigo=${encodeURIComponent(code)}`);});
    document.getElementById('try-sample').addEventListener('click',()=>{items=readStore();input.value='DEMO-042';trackerDetail(items.find(x=>x.code==='DEMO-042'));field.classList.remove('invalid');history.replaceState(null,'',`${location.pathname}?codigo=DEMO-042`);toast('Projeto fictício carregado.');});
    window.addEventListener('storage',e=>{if(e.key===KEY && input.value){items=readStore();trackerDetail(items.find(x=>x.code===input.value.toUpperCase()));}});
  }
  function group(item){if(item.step===4)return 'done';if(item.step>=2)return 'making';return 'start';}
  function renderStats(){const root=document.getElementById('stats');const metrics=[['Em preparação',items.filter(o=>o.step<=1).length,'A iniciar ou planejar'],['Na bancada',items.filter(o=>o.step>=2&&o.step<4).length,'Costura e acabamentos'],['Concluídos',items.filter(o=>o.step===4).length,'Processos ilustrativos encerrados']];root.innerHTML=metrics.map(([label,count,detail])=>`<div class="stat"><div class="stat-top"><span>${label}</span><span aria-hidden="true">✳</span></div><div class="stat-number">${count.toString().padStart(2,'0')}</div><div class="stat-bottom">${detail}</div></div>`).join('');}
  function renderBoard(){
    const root=document.getElementById('board');const cols=[['start','A começar','Ideias e modelagem'],['making','Em produção','Costura e acabamentos'],['done','Concluídos','Finalizações']];const visible=items.filter(o=>(o.title+' '+o.code+' '+o.alias).toLocaleLowerCase('pt-BR').includes(searchValue));
    root.innerHTML=cols.map(([key,label,help])=>{const filtered=visible.filter(o=>group(o)===key);return `<div class="board-col"><div class="board-col-header"><span>${label}</span><span class="count">${filtered.length}</span></div>${filtered.length?filtered.map(o=>`<button class="order-card" type="button" data-edit="${safe(o.code)}" aria-label="Editar ${safe(o.title)}"><span class="tag">${safe(o.code)}</span><h3>${safe(o.title)}</h3><p>${safe(o.alias)}</p><div class="order-card-foot"><span>${safe(itemStage(o))}</span><b>Editar ↗</b></div></button>`).join(''):`<div class="empty-col">Nenhum projeto nesta etapa.<br>${help}</div>`}</div>`;}).join('');
    root.querySelectorAll('[data-edit]').forEach(el=>el.addEventListener('click',()=>{selected=el.dataset.edit;renderEditor();document.getElementById('editor').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});}));
  }
  function renderEditor(){
    const target=document.getElementById('editor'),item=items.find(x=>x.code===selected);
    if(!item){target.classList.add('hide');target.innerHTML='';return;}
    target.classList.remove('hide');target.innerHTML=`<div class="editor-top"><h2>Editar projeto <span style="font-family:var(--sans);font-size:12px;opacity:.8">${safe(item.code)}</span></h2><button type="button" id="editor-close" aria-label="Fechar edição">×</button></div><div class="editor-body"><div class="editor-summary"><img src="${artSrc(item.art)}" alt="Arte de conceito fictícia"><div><h3>${safe(item.title)}</h3><p>${safe(item.alias)}</p><p>Sem prazo ou pedido real</p><button class="btn btn-outline btn-small" type="button" id="preview-client" style="margin-top:13px">Visualizar cliente ↗</button></div></div><form id="edit-form" class="editor-form"><div class="field"><label for="edit-status">Etapa da produção</label><select id="edit-status" name="step">${STAGES.map((s,i)=>`<option value="${i}" ${item.step===i?'selected':''}>${i+1}. ${safe(s.label)}</option>`).join('')}</select><small>Mudar a etapa atualiza a linha do tempo exibida ao cliente neste navegador.</small></div><div class="field"><label for="edit-note">Recado visível ao cliente</label><textarea id="edit-note" name="note" maxlength="320" required>${safe(item.publicNote)}</textarea><small>Não coloque dados reais. Este campo aparece no acompanhamento demo.</small></div><div class="editor-actions"><button type="submit" class="btn btn-primary">Salvar alteração →</button><button type="button" class="btn btn-soft" id="copy-code">Copiar código</button></div><p class="mini-help" role="status" id="save-info">Ainda sem alterações nesta edição.</p></form></div>`;
    document.getElementById('editor-close').addEventListener('click',()=>{selected=null;renderEditor();});
    document.getElementById('preview-client').addEventListener('click',()=>{location.href=`acompanhamento.html?codigo=${encodeURIComponent(item.code)}`;});
    document.getElementById('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(item.code);toast('Código de exemplo copiado.');}catch{toast('Código: '+item.code);}});
    document.getElementById('edit-form').addEventListener('submit',e=>{
      e.preventDefault();const form=e.currentTarget;const step=Number(form.elements.step.value), note=form.elements.note.value.trim();
      if(!Number.isInteger(step)||step<0||step>4||note.length<3||note.length>320){toast('Revise a etapa e o recado (3 a 320 caracteres).');return;}
      const snapshot=items.map(x=>x.code===item.code?{...x,step,publicNote:note}:x);
      if(!saveStore(snapshot)){toast('Não foi possível salvar neste navegador.');return;}
      items=snapshot;renderStats();renderBoard();renderEditor();const info=document.getElementById('save-info');if(info)info.textContent='Alteração salva neste navegador. Confira a visão do cliente.';toast('Etapa atualizada na demonstração.');
    });
  }
  function admin(){
    renderStats();renderBoard();
    document.getElementById('search-orders').addEventListener('input',e=>{searchValue=e.target.value.toLocaleLowerCase('pt-BR').trim();renderBoard();});
    const modal=document.getElementById('new-dialog');document.getElementById('new-project').addEventListener('click',()=>modal.showModal());
    document.getElementById('new-project-form').addEventListener('submit',e=>{
      e.preventDefault();const form=e.currentTarget,title=form.elements.title.value.trim(),alias=form.elements.alias.value.trim(),art=form.elements.art.value;
      if(title.length<3||alias.length<3||!ART[art]){toast('Informe um conceito e identificador fictício válidos.');return;}
      const max=Math.max(...items.map(o=>Number(o.code.split('-')[1])),61);const code=`DEMO-${String(max+1).padStart(3,'0')}`;
      const project={code,title,alias,art,step:0,publicNote:'O projeto de exemplo foi criado na fase inicial. Acompanhe as próximas etapas de demonstração.'};
      if(items.length>=30){toast('Limite de projetos de exemplo atingido.');return;}
      const snapshot=[...items,project];if(!saveStore(snapshot)){toast('Não foi possível salvar neste navegador.');return;}
      items=snapshot;searchValue='';document.getElementById('search-orders').value='';selected=code;renderStats();renderBoard();renderEditor();closeDialog(modal);form.reset();toast(`Projeto ${code} criado na demonstração.`);document.getElementById('editor').scrollIntoView({block:'nearest'});
    });
    const reset=document.getElementById('reset-dialog');document.getElementById('reset-demo').addEventListener('click',()=>reset.showModal());
    document.getElementById('confirm-reset').addEventListener('click',()=>{if(!saveStore(seed())){toast('Não foi possível restaurar os dados.');return;}items=seed();selected=null;searchValue='';document.getElementById('search-orders').value='';renderStats();renderBoard();renderEditor();closeDialog(reset);toast('Exemplos originais restaurados.');});
    window.addEventListener('storage',e=>{if(e.key===KEY){items=readStore();renderStats();renderBoard();renderEditor();}});
  }
  common();const page=document.body.dataset.page;if(page==='portfolio')portfolio();else if(page==='acompanhamento')tracker();else if(page==='atelie')admin();
})();
