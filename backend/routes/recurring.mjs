export function createRecurringRouter({ requireAuth, readJson, json, dataApi }) {
  return async function handleRecurringRoute(req, url) {
    if (url.pathname !== '/recurring') return null;

    if (req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const res = await dataApi(
        '/gastos_recorrentes?select=id,descricao,valor,categoria,forma_pagamento,dia_vencimento,ativo&order=dia_vencimento.asc',
        { method: 'GET' },
        auth.jwt
      );
      const text = await res.text();
      if (!res.ok) {
        console.error(`[recurring:get] status=${res.status} body=${text.slice(0,300)}`);
        return json(req, res.status, { message: text || 'Erro ao carregar recorrentes.' });
      }
      return json(req, 200, { recurring: JSON.parse(text || '[]'), token: auth.token });
    }

    if (req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const body = await readJson(req);
      let res;

      if (body.action === 'add') {
        const row = {
          descricao: body.descricao,
          valor: Number(body.valor),
          categoria: body.categoria || 'Outros',
          forma_pagamento: body.formaPagamento || 'Dinheiro',
          dia_vencimento: Number(body.diaVencimento),
          ativo: body.ativo !== false
        };
        res = await dataApi('/gastos_recorrentes', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(row)
        }, auth.jwt);
      } else if (body.action === 'update') {
        const row = {
          descricao: body.descricao,
          valor: Number(body.valor),
          categoria: body.categoria || 'Outros',
          forma_pagamento: body.formaPagamento || 'Dinheiro',
          dia_vencimento: Number(body.diaVencimento),
          ativo: body.ativo !== false,
          updated_at: new Date().toISOString()
        };
        res = await dataApi(
          `/gastos_recorrentes?id=eq.${encodeURIComponent(body.id)}`,
          { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) },
          auth.jwt
        );
      } else if (body.action === 'delete') {
        res = await dataApi(
          `/gastos_recorrentes?id=eq.${encodeURIComponent(body.id)}`,
          { method: 'DELETE', headers: { Prefer: 'return=representation' } },
          auth.jwt
        );
      } else {
        return json(req, 400, { message: 'Ação inválida.' });
      }

      const text = await res.text();
      if (!res.ok) {
        console.error(`[recurring:${body.action}] status=${res.status} body=${text.slice(0,300)}`);
        return json(req, res.status, { message: text || 'Erro ao salvar recorrente.' });
      }
      return json(req, 200, {
        ok: true,
        data: text ? JSON.parse(text) : null,
        token: auth.token
      });
    }

    return json(req, 405, { message: 'Método não permitido.' });
  };
}
