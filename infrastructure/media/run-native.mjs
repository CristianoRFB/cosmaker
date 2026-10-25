import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const service=spawn(process.execPath,[root+'infrastructure/media/test/local-supabase.mjs'],{cwd:root,stdio:['ignore','pipe','inherit']});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Official local storage startup timed out')),90000);service.stdout.on('data',v=>{process.stdout.write(v);if(v.toString().includes('OFFICIAL_SUPABASE_OSS_LOCAL_READY')){clearTimeout(timer);resolve();}});service.once('exit',code=>{clearTimeout(timer);reject(Error('Local storage exited: '+code));});service.once('error',reject);});
 const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--test',root+'infrastructure/media/test/native-storage.mjs'],{cwd:root,stdio:'inherit'});child.on('exit',resolve);child.on('error',reject);});
 process.exitCode=result??1;
}finally{
 service.kill('SIGTERM');
 await new Promise(resolve=>service.exitCode!==null?resolve():service.once('exit',resolve));
}
