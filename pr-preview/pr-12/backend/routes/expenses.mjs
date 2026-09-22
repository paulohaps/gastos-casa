export function createExpensesRouter({
  requireAuth,
  readJson,
  json,
  dataApi,
  monthRange,
  smartEntryService
}) {
  return async function handleExpensesRoute(req, url) {
    const path = url.pathname;

    if (path === '/months' && req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const res = await dataApi('/gastos?select=data&order=data.desc', { method: 'GET' }, auth.jwt);
      const text = await res.text();
      if (!res.ok) {
        console.error(`[months] status=${res.status} body=${text.slice(0,300)}`);
        return json(req, res.status, { message: 'Erro ao carregar meses.' });
      }
      const rows = JSON.parse(text || '[]');
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
      let query = '/gastos?select=id,data,usuario,valor,descricao,categoria,forma_pagamento&order=data.desc,created_at.desc';
      const range = monthRange(month);
      if (range) query += `&data=gte.${range.start}&data=lt.${range.end}`;
      const res = await dataApi(query, { method: 'GET' }, auth.jwt);
      const text = await res.text();
      if (!res.ok) {
        console.error(`[expenses:get] status=${res.status} body=${text.slice(0,300)}`);
        return json(req, res.status, { message: 'Erro ao carregar gastos.' });
      }
      return json(req, 200, { expenses: JSON.parse(text || '[]'), token: auth.token });
    }

    if (path === '/expenses' && req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const body = await readJson(req);
      let res;

      if (body.action === 'add') {
        const row = {
          data: body.dataGasto,
          usuario: auth.user?.name || auth.user?.email || 'Usuário',
          valor: Number(body.valor),
          descricao: body.descricao,
          categoria: body.categoria || 'Outros',
          forma_pagamento: body.formaPagamento || 'Dinheiro'
        };
        res = await dataApi('/gastos', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(row)
        }, auth.jwt);
      } else if (body.action === 'update') {
        const row = {
          data: body.dataGasto,
          usuario: body.usuario || auth.user?.name || auth.user?.email || 'Usuário',
          valor: Number(body.valor),
          descricao: body.descricao,
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

      const text = await res.text();
      if (!res.ok) {
        console.error(`[expenses:${body.action}] status=${res.status} body=${text.slice(0,300)}`);
        return json(req, res.status, { message: text || 'Erro ao salvar gasto.' });
      }

      const data = text ? JSON.parse(text) : null;
      let learning = null;

      if (body.action === 'add' && body.smartEntry?.used === true) {
        const confirmed = Array.isArray(data) && data[0] ? data[0] : {
          descricao: body.descricao,
          categoria: body.categoria || 'Outros'
        };
        try {
          learning = await smartEntryService.recordLearning(auth.jwt, body.smartEntry, confirmed);
        } catch (err) {
          console.warn('[smart-learning] expense saved, learning skipped:', err?.message || err);
        }
        await smartEntryService.completeTelemetry(
          auth.jwt,
          body.smartEntry.telemetryId,
          body.smartEntry,
          confirmed,
          learning
        );
      }

      return json(req, 200, { ok: true, data, learning, token: auth.token });
    }

    return null;
  };
}
