const VERSION="af9540e140897fb15baeb8c5b6296dbeede24493";
const ROOT="https://raw.githubusercontent.com/CristianoRFB/cosmaker/"+VERSION+"/demos/sakurai-portfolio-v2/";
const TOTAL=3408855;
const CHUNK=375000;
const TYPES={html:"text/html; charset=utf-8",css:"text/css; charset=utf-8",js:"text/javascript; charset=utf-8",webp:"image/webp",jpg:"image/jpeg"};
const CONTENT_POLICY="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
function headers(type,ttl) {
 return new Headers({"content-type":type,"cache-control":"public, max-age="+ttl,"x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","x-frame-options":"DENY","content-security-policy":CONTENT_POLICY});
}
async function remoteFile(path) {
 const r=await fetch(ROOT+path,{cf:{cacheEverything:true,cacheTtl:86400}});
 if(!r.ok)throw new Error("Origin "+r.status+" "+path);
 return r;
}
async function video(request) {
 const headersOut=headers("video/mp4",86400);
 headersOut.set("accept-ranges","bytes");
 headersOut.set("access-control-allow-origin","*");
 const range=request.headers.get("range");
 let start=0,end=TOTAL-1,status=200;
 if(range) {
  const m=/^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{"content-range":"bytes */"+TOTAL}});
  if(!m[1]){ const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return new Response(null,{status:416,headers:{"content-range":"bytes */"+TOTAL}});start=Math.max(0,TOTAL-suffix);}
  else start=Number(m[1]);
  end=m[1]&&m[2]?Number(m[2]):TOTAL-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=TOTAL||end<start)return new Response(null,{status:416,headers:{"content-range":"bytes */"+TOTAL}});
  end=Math.min(end,TOTAL-1);
  status=206;headersOut.set("content-range","bytes "+start+"-"+end+"/"+TOTAL);
 }
 const length=end-start+1;
 headersOut.set("content-length",String(length));
 if(request.method==="HEAD")return new Response(null,{status,headers:headersOut});
 try {
  const first=Math.floor(start/CHUNK),last=Math.floor(end/CHUNK);
  const pieces=await Promise.all(Array.from({length:last-first+1},async(_,k)=>{
   const i=first+k;
   const file="images/processo-franco.part"+String(i).padStart(2,"0");
   const response=await remoteFile(file);
   const b=new Uint8Array(await response.arrayBuffer());
   const expected=i===9?TOTAL-(9*CHUNK):CHUNK;
   if(b.byteLength!==expected)throw new Error("Bad segment length: "+i+"="+b.byteLength);
   return b;
  }));
  const all=new Uint8Array(length);
  let dest=0;
  for(let k=0;k<pieces.length;k++) {
   const piece=pieces[k],i=first+k,begin=Math.max(0,start-i*CHUNK),limit=Math.min(piece.length,end-i*CHUNK+1);
   const section=piece.subarray(begin,limit);all.set(section,dest);dest+=section.length;
  }
  if(dest!==length)throw new Error("Invalid assembly length");
  return new Response(all,{status,headers:headersOut});
 }catch(e){console.error(JSON.stringify({event:"video_error",error:String(e)}));return new Response("Video temporariamente indisponível",{status:503,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}})}
}
export default {async fetch(request){
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Método não permitido",{status:405,headers:{"allow":"GET, HEAD"}});
 const u=new URL(request.url);
 let path;
 try{path=u.pathname==="/"? "index.html":decodeURIComponent(u.pathname.slice(1))}catch{return new Response("Rota inválida",{status:400})}
 if(path==="projetos/franco"||path==="projetos/caitlyn")path+=".html";
 if(path==="images/processo-franco.mp4")return video(request);
 if(!/^(index\.html|app\.js|project\.js|style\.css|projetos\/(franco|caitlyn)\.html|images\/[a-z0-9-]+\.(webp|jpg))$/.test(path))return new Response("Não encontrado",{status:404});
 try{
  const upstream=await remoteFile(path);
  const ext=path.split(".").pop();
  const h=headers(TYPES[ext]||"application/octet-stream",ext==="html"?120:3600);
  h.set("content-length",upstream.headers.get("content-length")||"");
  if(!h.get("content-length"))h.delete("content-length");
  return new Response(request.method==="HEAD"?null:upstream.body,{status:200,headers:h});
 }catch(e){console.error(JSON.stringify({event:"asset_error",path,error:String(e)}));return new Response("Arquivo indisponível",{status:503})}
}};