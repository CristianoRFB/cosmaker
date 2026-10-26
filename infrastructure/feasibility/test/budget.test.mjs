import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InvocationBudget,MemoryReservations,DailyLedger,FREE_LIMITS} from '../src/budget.mjs';
test('exact50subrequests include retries and51is refused before network; caller cannot force redirects',async()=>{
 let calls=0;const b=new InvocationBudget(async(_url,init)=>{assert.equal(init.redirect,'manual');calls++;return new Response('ok');});
 for(let i=0;i<50;i++)await(await b.fetch('http://127.0.0.1:1',{redirect:'follow'})).text();
 await assert.rejects(b.fetch('http://127.0.0.1:1'),{code:'SUBREQUEST_BUDGET'});assert.equal(calls,50);
});
test('active connections count until the body is consumed or cancelled; redirects never grant a second hop',async()=>{
 const b=new InvocationBudget(async()=>new Response(new ReadableStream({start(){}})));
 const responses=await Promise.all(Array.from({length:6},()=>b.fetch('http://127.0.0.1:1')));await assert.rejects(b.fetch('http://127.0.0.1:1'),{code:'CONNECTION_BUDGET'});
 await Promise.all(responses.map(r=>r.body.cancel()));assert.equal(b.connections,0);
 const redirect=new InvocationBudget(async()=>new Response(null,{status:302,headers:{Location:'https://untrusted.invalid'}}));await assert.rejects(redirect.fetch('http://127.0.0.1:1'),{code:'REDIRECT_REFUSED'});assert.equal(redirect.count,1);
});
test('memory reservations fail before allocation and release once, without claiming actual128MiB heap enforcement',()=>{
 const m=new MemoryReservations(),release=m.reserve(80*1024*1024);assert.throws(()=>m.reserve(20*1024*1024),{code:'MEMORY_RESERVATION_BUDGET'});release();release();assert.equal(m.used,0);assert.equal(new InvocationBudget().report().memoryMeasuredByThisGuard,false);
});
test('UTC daily limit counts100000and resets on next date; unsupported CPU always fails closed',()=>{
 const d=new DailyLedger();for(let i=0;i<100000;i++)d.charge(new Date('2026-10-26T23:59:59Z'));assert.throws(()=>d.charge(new Date('2026-10-26T23:59:59Z')),{code:'DAILY_REQUEST_BUDGET'});assert.equal(d.charge(new Date('2026-10-27T00:00:00Z')),1);
 assert.equal(FREE_LIMITS.cpuMs,10);assert.throws(()=>new InvocationBudget().assertStrictCpu(),{code:'CPU_ENFORCER_UNAVAILABLE'});
});
