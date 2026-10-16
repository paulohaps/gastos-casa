import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisPeriod, shiftMonth } from '../js/core/analysis-period.mjs';
import { createAssistantService, validateConversation } from '../backend/services/assistant.mjs';
import { contextKey } from '../backend/services/conversations.mjs';
import { parseAnalysis } from '../src/shared/api/conversation.ts';
const owner='11111111-1111-4111-8111-111111111111', walletId='22222222-2222-4222-8222-222222222222';
const payload=context=>({context,messages:[{role:'user',content:'Compare os meses.'}]});
function setup(dataApi) {
 const calls=[], instructions=[];
 const service=createAssistantService({dataApi:async(path,options,jwt)=>{calls.push({path,jwt});return dataApi(path,options,jwt)},resolveConfig:async()=>({provider:'deepseek',model:'deepseek-chat',apiKey:'private'}),generate:async(_,instruction)=>instructions.push(instruction)});
 return {service,calls,instructions};
}
test('períodos inclusivos atravessam dezembro e preservam chave mensal',()=>{
 assert.deepEqual(analysisPeriod({month:'2026-02',startMonth:'2025-12'}).months,['2025-12','2026-01','2026-02']);
 assert.equal(shiftMonth('2026-01',-1),'2025-12');
 assert.equal(contextKey({scope:'house',month:'2026-02'}),'house:2026-02');
 assert.equal(contextKey({scope:'house',month:'2026-02',startMonth:'2026-02'}),'house:2026-02');
 assert.equal(contextKey({scope:'house',month:'2026-02',startMonth:'2025-12'}),'house:2025-12..2026-02');
 assert.notEqual(contextKey({scope:'wallet',walletId,month:'2026-02',startMonth:'2025-12'}),contextKey({scope:'house',month:'2026-02',startMonth:'2025-12'}));
});
test('intervalos inválidos, invertidos e acima de 12 meses são rejeitados',()=>{
 for(const startMonth of ['2026-03','2025-02','bad','2025-13','0000-01',null]) assert.throws(()=>validateConversation(payload({scope:'house',month:'2026-02',startMonth})),/INVALID_CONTEXT/);
 assert.equal(analysisPeriod({month:'2026-02',startMonth:'2025-03'}).months.length,12);
});
test('agregação mensal inclui meses vazios e compara intervalos de mesma duração',async()=>{
 const fixture=[{data:'2025-12-01',valor:'0.10',categoria:'Mercado'},{data:'2025-12-02',valor:'0.20',categoria:'Mercado'},{data:'2026-02-28',valor:'10',categoria:'Outros'}];
 const {service,calls,instructions}=setup(async path=>Response.json(path.includes('gte.2025-12')?fixture:[{data:'2025-10-01',valor:5,categoria:'Mercado'}]));
 const prepared=await service.prepare(owner,'jwt',payload({scope:'house',month:'2026-02',startMonth:'2025-12'}));
 assert.deepEqual(prepared.analysis.months,[{month:'2025-12',total:.3,count:2},{month:'2026-01',total:0,count:0},{month:'2026-02',total:10,count:1}]);
 assert.equal(prepared.analysis.total,10.3); parseAnalysis(prepared.analysis);
 await prepared.stream({});prepared.release();
 assert.ok(calls.some(({path})=>path.includes('gte.2025-09-01')&&path.includes('lt.2025-12-01')));
 assert.ok(calls.some(({path})=>path.includes('gte.2025-12-01')&&path.includes('lt.2026-03-01')));
 assert.match(instructions[0],/"difference":5.3/);
});
test('falha parcial, registros fora do intervalo e paginação incompleta não geram totais',async()=>{
 for(const kind of ['error','outside','full']) {
 const {service,instructions}=setup(async path=>kind==='error'&&path.includes('gte.2025-09')?Response.json({}, {status:503}):Response.json(kind==='outside'?[{data:'2028-01-01',valor:1,categoria:'Outros'}]:kind==='full'?Array.from({length:1000},()=>({data:path.includes('gte.2025-09')?'2025-09-01':'2025-12-01',valor:1,categoria:'Outros'})):[]));
 await assert.rejects(service.prepare(owner,'jwt',payload({scope:'house',month:'2026-02',startMonth:'2025-12'})),/DATA_UNAVAILABLE/);
 assert.equal(instructions.length,0);
 }
});
test('carteira de outro dono falha antes de despesas; intervalo não fabrica orçamento histórico',async()=>{
 const denied=setup(async()=>Response.json([]));
 await assert.rejects(denied.service.prepare(owner,'jwt',payload({scope:'wallet',walletId,month:'2026-02',startMonth:'2025-12'})),/WALLET_NOT_FOUND/);
 assert.equal(denied.calls.length,1);
 const valid=setup(async path=>Response.json(path.startsWith('/personal_wallets')?[{id:walletId,nome:'Privado',limite_mensal:600,goal_nome:'Viagem',goal_valor:1000,goal_reserva:100,goal_mes:'2026-02'}]:[]));
 const prepared=await valid.service.prepare(owner,'jwt',payload({scope:'wallet',walletId,month:'2026-02',startMonth:'2025-12'}));
 await prepared.stream({});prepared.release();
 assert.ok(valid.calls.every(({path,jwt})=>path.includes('owner_id=eq.'+owner)&&jwt==='jwt'));
 assert.match(valid.instructions[0],/"budgetUnavailable"/);
 assert.ok(!valid.instructions[0].includes('"budget":600'));
 assert.ok(!valid.instructions[0].includes('"protectedBudget":'));
});
test('fronteira do cartão rejeita mês ausente, total inconsistente e valores inválidos',()=>{
 const valid={startMonth:'2026-01',endMonth:'2026-02',total:3,count:2,months:[{month:'2026-01',total:1,count:1},{month:'2026-02',total:2,count:1}]};
 for(const value of [{...valid,total:99},{...valid,months:valid.months.slice(1)},{...valid,months:[{...valid.months[0],total:NaN},valid.months[1]]},{...valid,count:4}]) assert.throws(()=>parseAnalysis(value));
 assert.equal(parseAnalysis(valid).total,3);
});
test('cartão do período persiste no histórico e conteúdo inválido não é retomado',async()=>{
 const { createConversationsService, validateStoredConversation }=await import('../backend/services/conversations.mjs');
 const { parseConversation }=await import('../src/shared/api/conversation.ts');
 const analysis={startMonth:'2026-01',endMonth:'2026-02',total:3,count:2,months:[{month:'2026-01',total:1,count:1},{month:'2026-02',total:2,count:1}]};
 let stored={id:owner,revision:0,messages:[]};
 const service=createConversationsService({dataApi:async(_,options)=>{if(options.method==='PATCH')stored={...stored,...JSON.parse(options.body)};return Response.json([stored]);}});
 await service.complete(owner,'jwt',stored,'Compare','Resposta',undefined,analysis);
 assert.deepEqual(parseConversation({conversation:stored}).messages[1].analysis,analysis);
 assert.deepEqual(validateStoredConversation(stored).messages[1].analysis,analysis);
 for(const mutate of [()=>({...stored,messages:[{role:'user',content:'x',analysis},{role:'assistant',content:'x'}]}),()=>({...stored,messages:[{role:'user',content:'x'},{role:'assistant',content:'x',analysis:{...analysis,total:5}}]})]) {
 assert.throws(()=>validateStoredConversation(mutate()),/HISTORY_UNAVAILABLE/);
 assert.throws(()=>parseConversation({conversation:mutate()}));
 }
});
