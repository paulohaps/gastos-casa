import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createAssistantService } from '../backend/services/assistant.mjs';
// Explicit isolated integration run; never accepts a production Data API URL.
const file = process.env.GASTOS_RELEASE_SESSION_FILE;
if (!file) throw new Error('GASTOS_RELEASE_SESSION_FILE is required.');
const state=JSON.parse(await readFile(file,'utf8'));
assert.equal(state.authOrigin,'https://ep-wild-wind-ac7p8wta.neonauth.sa-east-1.aws.neon.tech/release_identity/auth');
const base='https://ep-wild-wind-ac7p8wta.apirest.sa-east-1.aws.neon.tech/gastos_casa/rest/v1';
const accounts=[];
for(const a of state.accounts.slice(0,2)) {
 const c=JSON.parse(Buffer.from(a.token,'base64url').toString());
 const r=await fetch(state.authOrigin+'/token',{headers:{Cookie:c.cookieName+'='+c.cookieValue,Origin:'https://paulohaps.github.io'}}); assert.equal(r.status,200);
 const jwt=(await r.json()).token;const claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()); accounts.push({jwt,id:claims.sub});
}
const api=(path,options={},jwt)=>fetch(base+path,{...options,headers:{...Object.fromEntries(new Headers(options.headers)),Authorization:'Bearer '+jwt,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})}});
let inserted=[],payment;
try {
 const before=await api('/gastos?select=id&data=gte.2099-11-01&data=lt.2099-12-01',{},accounts[0].jwt); assert.deepEqual(await before.json(),[]);
 for(const [i,value] of [100,200.01].entries()) {
  const r=await api('/gastos',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({data:'2099-11-'+(i?'14':'07'),valor:value,usuario:i?'Fernando Gustavo':'Paulo Henrique',forma_pagamento:'Dinheiro',descricao:'Grounding isolated regression',categoria:'Mercado'})},accounts[i].jwt);
  const d=await r.json();assert.equal(r.status,201,JSON.stringify(d));inserted.push(d[0].id);
 }
 const r=await api('/rpc/record_settlement',{method:'POST',body:JSON.stringify({p_competencia:'2099-11-01',p_data_pagamento:'2099-11-21',p_recebedor:'Fernando Gustavo',p_forma_pagamento:'Dinheiro',p_valor:10,p_observacao:'Grounding isolated regression',p_request_key:randomUUID()})},accounts[0].jwt);
 assert.equal(r.status,200); payment=(await r.json())[0].id;
 const results=[];
 for(const [i,a] of accounts.entries()) {
  let snapshot;
  const service=createAssistantService({dataApi:api,now:()=>Date.parse('2099-12-01T12:00:00Z'),resolveConfig:async()=>({provider:'deepseek',model:'deepseek-chat',apiKey:'no-provider-call'}),generate:async(_,instruction)=>{snapshot=JSON.parse(instruction.split('Dados autorizados (campos Cents em centavos; demais valores monetários em reais): ')[1]);}});
  const prepared=await service.prepare(a.id,a.jwt,{context:{scope:'house',month:'2099-11'},messages:[{role:'user',content:'Quanto devo e em quais dias gasto mais?'}]});
  await prepared.stream({}); prepared.release();
  assert.equal(snapshot.settlements.status,'available'); assert.equal(snapshot.current.total,300.01);assert.equal(snapshot.current.count,2);
  assert.equal(i?snapshot.settlements.receivableCents:snapshot.settlements.payableCents,4001);
  assert.equal(snapshot.spendingPatterns.distinctSpendingDays,2);
  assert.equal(snapshot.myPaidSpendingPatterns.distinctSpendingDays,1);
  results.push({identity:i?'FG':'PH',actualAuth:true,nativeRls:true,exactCents:true,settlementsGrounded:true,dailyPatterns:true,providerCalled:false});
 }
 if (process.env.GASTOS_GROUNDING_REPORT) await writeFile(process.env.GASTOS_GROUNDING_REPORT,JSON.stringify(results,null,2));console.log('PASS: Auth/JWT/Data API/RLS reais; dívidas e dias autorizados para PH e FG; nenhum provedor chamado.');
} finally {
 if(payment){const r=await api('/acertos?id=eq.'+payment,{method:'DELETE'},accounts[0].jwt);assert.ok(r.ok);}
 for(const id of inserted){const r=await api('/gastos?id=eq.'+id,{method:'DELETE'},accounts[0].jwt);assert.ok(r.ok);}
 console.log('Limpeza: somente os registros sintéticos rastreados no banco isolado.');
}
