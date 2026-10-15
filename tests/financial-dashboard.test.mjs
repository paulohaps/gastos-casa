import test from 'node:test';
import assert from 'node:assert/strict';
import { cents, totalCents, safeTotal, selectExpenses, belongsToMonth } from '../js/core/financial-selection.mjs';
import { calculateSettlement } from '../backend/settlements/calculator.mjs';

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
test('divisão ímpar conserva centavos sem inverter dívida após quitação',()=>{
 const expenses=[{usuario:'Paulo Henrique',valor:0.03,forma_pagamento:'Dinheiro'}];
 const before=calculateSettlement(expenses,[]);
 assert.equal(before.remaining,0.01);assert.deepEqual(before.responsibilityCents,{paulo:2,fernando:1});
 const after=calculateSettlement(expenses,[{pagador:'Fernando Gustavo',recebedor:'Paulo Henrique',valor:0.01,forma_pagamento:'Dinheiro'}]);
 assert.equal(after.debtor,null);assert.equal(after.isSettled,true);assert.equal(after.remaining,0);
});
test('centavo indivisível atribuído a PH, sem criar moeda fracionária',()=>{
 for(let total=0;total<1000;total++){
  const r=calculateSettlement([{usuario:'Paulo Henrique',valor:(total/100).toFixed(2)}]);
  assert.equal(r.responsibilityCents.paulo+r.responsibilityCents.fernando,total);
  assert.equal(cents(r.remaining),Math.floor(total/2));
 }
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
