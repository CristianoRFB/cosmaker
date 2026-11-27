// RFB V6 — reaplica a paleta e o modo escolhidos na home, sem backend.
(() => {
  const root=document.documentElement;
  const saved=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
  const save=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
  const color=saved('sakurai-rfb-palette-v3');
  const mode=saved('sakurai-rfb-mode-v3')==='light'?'light':'dark';
  root.dataset.theme=mode;
  const btn=document.getElementById('project-theme-toggle');
  function label(){btn.textContent=root.dataset.theme==='dark'?'☼':'☾';btn.setAttribute('aria-label',root.dataset.theme==='dark'?'Ativar modo claro':'Ativar modo escuro')}
  btn.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';save('sakurai-rfb-mode-v3',root.dataset.theme);apply();label()});
  const valid=/^#[0-9A-F]{6}$/i.test(color||'');
  function mix(a,b,t){const c=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const v=c(a),w=c(b);return '#'+v.map((n,i)=>Math.round(n*(1-t)+w[i]*t).toString(16).padStart(2,'0')).join('').toUpperCase()}
  function luminance(hex){const vals=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return vals[0]*.2126+vals[1]*.7152+vals[2]*.0722}
  function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
  function apply(){if(!valid)return;const dark=root.dataset.theme==='dark';const bg=dark?'#151219':'#FAF7F9';const values={'--brand':color,'--brand-deep':mix(color,'#130A18',dark?.23:.18),'--brand-soft':mix(color,bg,dark?.81:.87),'--brand-faint':mix(color,bg,dark?.92:.94),'--brand-lift':mix(color,'#FFFFFF',.34),'--on-brand':ratio(color,'#140F16')>=ratio(color,'#FFFFFF')?'#140F16':'#FFFFFF'};for(const [k,v] of Object.entries(values))root.style.setProperty(k,v)}
  apply();label();document.getElementById('project-year').textContent=new Date().getFullYear();
})();
// RFB V7: mesmo fallback de fotografia nas páginas individuais.
(() => {
  const mirror='https://raw.githubusercontent.com/CristianoRFB/cosmaker/b81653482c26fb0ea81817940cbc7c06db9ff1f6/demos/sakurai-portfolio-v2/images/';
  window.addEventListener('error',event => {
    const img=event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const current=img.getAttribute('src')||'';
    if(!img.dataset.rfbMirrorTried && /^\.?\.?\/images\/[a-z0-9-]+\.(webp|jpg)$/i.test(current)){
      img.dataset.rfbMirrorTried='1';
      img.src=mirror+current.split('/').pop();
    }else if(img.dataset.rfbMirrorTried==='1' && !img.dataset.rfbFailed){
      img.dataset.rfbFailed='1';
      img.style.opacity='0';
      img.closest('.project-photo, .project-lead-visual, .project-related-link')?.classList.add('image-unavailable');
    }
  },true);
})();
