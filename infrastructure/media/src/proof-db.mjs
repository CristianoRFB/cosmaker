import {Firestore} from '../../spark/src/firestore.mjs';
import {Budget,localConfig} from '../../spark/src/core.mjs';
export function proofDatabase(env){const config=localConfig(env);let requests=0;const instance=()=>{const budget=new Budget(),fetch=budget.fetch.bind(budget);budget.fetch=async(...args)=>{requests++;return fetch(...args);};return new Firestore(config,budget);};return{get: (...args)=>instance().get(...args),transaction: (...args)=>instance().transaction(...args),query: (...args)=>instance().query(...args),prefix:instance().prefix,requests:()=>requests};}
