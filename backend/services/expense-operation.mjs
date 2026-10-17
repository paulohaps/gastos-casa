import { validAmount } from '../data/validation.mjs';
/** No insert fallback: an uncertain commit must keep the same operation key. */
export async function createExpense(dataApi, jwt, body) {
  if(typeof body.idempotencyKey!=='string'||!/^[a-zA-Z0-9_-]{8,120}$/.test(body.idempotencyKey))
    return {status:400,message:'Atualize o aplicativo e reabra o cadastro para identificar esta despesa.'};
  const response=await dataApi('/rpc/record_expense',{method:'POST',body:JSON.stringify({
    p_data:body.dataGasto,p_valor:Number(body.valor),p_descricao:body.descricao.trim(),
    p_categoria:body.categoria||'Outros',p_forma_pagamento:body.formaPagamento||'Dinheiro',p_request_key:body.idempotencyKey
  })},jwt);
  if(!response.ok) {
    await response.text().catch(()=>null);
    return {status:[401,403,409].includes(response.status)?response.status:503,message:response.status===409?'Operação já utilizada com outros dados. Confira o histórico.':'Não foi possível confirmar a despesa. Tente novamente com os mesmos dados.'};
  }
  const result=await response.json().catch(()=>null), row=result?.expense;
  if(typeof result?.replayed!=='boolean'||typeof row?.id!=='string'||!row.id||row.data!==body.dataGasto
    ||!validAmount(row.valor)||Number(row.valor)!==Number(body.valor)||row.descricao!==body.descricao.trim()
    ||row.categoria!==(body.categoria||'Outros')||row.forma_pagamento!==(body.formaPagamento||'Dinheiro'))
    return {status:502,message:'Despesa sem confirmação válida. Confira o histórico ou tente novamente com os mesmos dados.'};
  return {data:[row],replayed:result.replayed};
}
