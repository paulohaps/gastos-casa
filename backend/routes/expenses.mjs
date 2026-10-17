import { createExpense } from '../services/expense-operation.mjs';
import { allRows } from '../data/rows.mjs';
import { validDate, validAmount } from '../data/validation.mjs';

export function createExpensesRouter({
  requireAuth,
  readJson,
  json,
  dataApi,
  monthRange,
  smartEntryService,
  receiptService
}) {
  return async function handleExpensesRoute(req, url) {
    const path = url.pathname;

    if (path === '/months' && req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const rows = await allRows(dataApi, '/gastos?select=data,id&order=data.desc,id.desc', auth.jwt);
      const months = [...new Set(rows.map(r => {
        const [y,m] = String(r.data).split('-');
        return `${m}/${y}`;
      }).filter(Boolean))];
      return json(req, 200, { months, token: auth.token, user: auth.user });
    }

    if (path === '/expenses' && req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const month = url.searchParams.get('month');
      let query = '/gastos?select=id,data,usuario,valor,descricao,categoria,forma_pagamento&order=data.desc,created_at.desc,id.desc';
      const range = monthRange(month);
      if (range) query += `&data=gte.${range.start}&data=lt.${range.end}`;
      const expenses = await allRows(dataApi, query, auth.jwt);
      return json(req, 200, { expenses, complete: true, token: auth.token });
    }

    if (path === '/expenses' && req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const body = await readJson(req);
      let res, operation;
      if (['add', 'update'].includes(body.action)) {
        const category = body.categoria || 'Outros';
        const method = body.formaPagamento || 'Dinheiro';
        if (!validAmount(body.valor) || !validDate(body.dataGasto) || typeof body.descricao !== 'string' || !body.descricao.trim() || body.descricao.trim().length > 500
          || !['Mercado', 'Contas', 'Aluguel', 'Ifood', 'Outros'].includes(category) || !['Dinheiro', 'Vale'].includes(method)) {
          return json(req, 400, { message: 'Confira valor, data, descrição, categoria e pagamento.' });
        }
      }
      if (['update', 'delete'].includes(body.action) && !body.id) return json(req, 400, { message: 'Despesa inválida.' });

      if (body.action === 'add') {
        operation=await createExpense(dataApi,auth.jwt,body);
        if(operation.status) return json(req,operation.status,{message:operation.message});
      } else if (body.action === 'update') {
        const row = {
          data: body.dataGasto,
          usuario: body.usuario || auth.user?.name || auth.user?.email || 'Usuário',
          valor: Number(body.valor),
          descricao: body.descricao.trim(),
          categoria: body.categoria || 'Outros',
          forma_pagamento: body.formaPagamento || 'Dinheiro',
          updated_at: new Date().toISOString()
        };
        res = await dataApi(
          `/gastos?id=eq.${encodeURIComponent(body.id)}`,
          { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) },
          auth.jwt
        );
      } else if (body.action === 'delete') {
        res = await dataApi(
          `/gastos?id=eq.${encodeURIComponent(body.id)}`,
          { method: 'DELETE', headers: { Prefer: 'return=representation' } },
          auth.jwt
        );
      } else {
        return json(req, 400, { message: 'Ação inválida.' });
      }

      let data=operation?.data;
      if(!operation) {
        const text=await res.text();
        if(!res.ok) return json(req,res.status,{message:'Não foi possível alterar a despesa.'});
        data=text?JSON.parse(text):null;
      }
      const replayed=operation?.replayed===true;
      let learning = null;

      if (body.action === 'add' && !replayed && body.smartEntry?.used === true) {
        const confirmed = Array.isArray(data) && data[0] ? data[0] : {
          descricao: body.descricao.trim(),
          categoria: body.categoria || 'Outros'
        };
        try {
          learning = await smartEntryService.recordLearning(auth.jwt, body.smartEntry, confirmed);
        } catch (err) {
          console.warn('[smart-learning] expense saved, learning skipped:', err?.message || err);
        }
        try {
        await smartEntryService.completeTelemetry(
          auth.jwt,
          body.smartEntry.telemetryId,
          body.smartEntry,
          confirmed,
          learning
        );
        } catch { console.warn('[smart-telemetry] expense saved, telemetry skipped'); }
      }

      let receiptImport = null;
      if (body.action === 'add' && !replayed && body.receipt?.accessKey && receiptService) {
        const confirmedExpense = Array.isArray(data) && data[0] ? data[0] : null;
        try {
          receiptImport = await receiptService.registerFromExpense(auth.jwt, confirmedExpense, body.receipt);
        } catch (err) {
          console.warn('[receipt:register] expense saved, receipt metadata skipped:', err?.message || err);
        }
      }

      return json(req, 200, { ok: true, data, learning, receiptImport, ...(operation?{replayed}:{}), token: auth.token });
    }

    return null;
  };
}
