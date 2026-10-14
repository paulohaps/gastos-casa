import test from 'node:test';
import assert from 'node:assert/strict';
import { cents, totalCents, safeTotal, selectExpenses, belongsToMonth } from '../js/core/financial-selection.mjs';
import { calculateSettlement } from '../backend/settlements/calculator.mjs';
import { createSettlementsRouter } from '../backend/routes/settlements.mjs';

test('totais da dashboard usam centavos inteiros e não perdem resíduos por soma',()=>{
 assert.equal(cents('0.01'),1);assert.equal(cents('12.30'),1230);
 assert.equal(totalCents([{valor:0.1},{valor:0.2},{valor:'0.01'}]),31);
 assert.equal(safeTotal([{valor:0.005}]),null);assert.equal(safeTotal([{valor:-1}]),null);
 assert.throws(()=>cents('9007199254740992'));assert.equal(totalCents([]),0);
});
test('a seleção distingue pagador, escopo privado e método ausente',()=>{
 const rows=[{scope:'house',usuario:'PH',formaPagamento:'Dinheiro',categoria:'Mercado',descricao:'Café',valor:1},{scope:'personal',categoria:'Mercado',descricao:'Café pessoal',valor:2}];
 const filters={type:'all',category:'',person:'',method:'',query:''};
 assert.equal(selectExpenses(rows,filters).length,2);
 assert.equal(selectExpenses(rows,{...filters,method:'Dinheiro'}).length,1);
 assert.equal(selectExpenses(rows,{...filters,person:'Fernando'}).length,0);
 assert.equal(selectExpenses(rows,{...filters,type:'personal',query:'cafe'}).length,1);
 assert.equal(selectExpenses(rows,{...filters,category:'Outros'}).length,0);
});
// Characterizations of unresolved backend blockers. These are NOT certification
// that the legacy behavior is correct. The new dashboard never uses this balance.
test('bloqueador legado reproduzido: divisão ímpar gera meio centavo e inverte dívida',()=>{
 const expenses=[{usuario:'Paulo Henrique',valor:0.01,forma_pagamento:'Dinheiro'}];
 const before=calculateSettlement(expenses,[]);
 assert.equal(before.remaining,0.005);assert.equal(safeTotal([{valor:before.remaining}]),null);
 const after=calculateSettlement(expenses,[{pagador:'Fernando Gustavo',recebedor:'Paulo Henrique',valor:0.01,forma_pagamento:'Dinheiro'}]);
 assert.equal(after.debtor,'Paulo Henrique');assert.equal(after.isSettled,false);
});
test('bloqueador legado reproduzido: duas quitações concorrentes ultrapassam saldo',async()=>{
 const writes=[],pending=[];
 const router=createSettlementsRouter({
  requireAuth:async()=>({auth:{jwt:'test',token:'test',user:{name:'Paulo Henrique'}}}),readJson:req=>req.json(),json:(_req,status,body)=>Response.json(body,{status}),monthRange:()=>({start:'2026-09-01',end:'2026-10-01'}),monthToDb:()=> '2026-09',
  dataApi:async(path,options={})=>{
   if(path.startsWith('/gastos?'))return Response.json([{usuario:'Paulo Henrique',valor:100,forma_pagamento:'Dinheiro'},{usuario:'Fernando Gustavo',valor:300,forma_pagamento:'Dinheiro'}]);
   if(path.startsWith('/acertos?')){await new Promise(resolve=>{pending.push(resolve);if(pending.length===2)pending.forEach(r=>r())});return Response.json([{pagador:'Paulo Henrique',recebedor:'Fernando Gustavo',valor:35,forma_pagamento:'Dinheiro'}]);}
   if(path==='/acertos'&&options.method==='POST'){const row=JSON.parse(options.body);writes.push(row);return Response.json([{id:String(writes.length),...row}]);}
   throw Error('Unexpected path');
  }
 });
 const request=()=>new Request('https://test.invalid/settlements',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'add',month:'09/2026',dataPagamento:'2026-09-22',recebedor:'Fernando Gustavo',formaPagamento:'Dinheiro',valor:65})});
 const responses=await Promise.all([router(request(),new URL('https://test.invalid/settlements')),router(request(),new URL('https://test.invalid/settlements'))]);
 assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(writes.reduce((n,r)=>n+r.valor,0),130);
});
test('somar gastos nunca incorpora pagamentos de acerto',()=>{
 const expenses=[{valor:100},{valor:300}],payments=[{valor:35}];
 assert.equal(totalCents(expenses),40000);assert.equal(totalCents(payments),3500);
});

test('consulta histórica só pertence ao ponto mensal quando todas as datas coincidem',()=>{
 assert.equal(belongsToMonth([{data:'18/08/2026'}],'2026-07'),false);
 assert.equal(belongsToMonth([{data:'2026-08-18'}],'2026-08'),true);
 assert.equal(belongsToMonth([],'2026-08'),true);
 assert.equal(belongsToMonth([{data:'18/08/2026'},{data:'01/09/2026'}],'2026-08'),false);
});
