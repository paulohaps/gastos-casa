export function createBudgetsRouter({ requireAuth, readJson, json, dataApi, monthToDb }) {
  return async function handleBudgetsRoute(req, url) {
    if (url.pathname !== '/budgets') return null;

    if (req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const dbMonth = monthToDb(url.searchParams.get('month'));
      if (!dbMonth) return json(req, 400, { message: 'Mês inválido.' });

      const res = await dataApi(
        `/orcamentos?mes=eq.${encodeURIComponent(dbMonth)}&select=id,mes,categoria,valor_limite&order=categoria.asc`,
        { method: 'GET' },
        auth.jwt
      );
      const text = await res.text();
      if (!res.ok) {
        console.error(`[budgets:get] status=${res.status} body=${text.slice(0,300)}`);
        return json(req, res.status, { message: text || 'Erro ao carregar orçamento.' });
      }
      return json(req, 200, { budgets: JSON.parse(text || '[]'), token: auth.token });
    }

    if (req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const body = await readJson(req);
      const dbMonth = monthToDb(body.month);
      if (!dbMonth) return json(req, 400, { message: 'Mês inválido.' });

      const inputItems = Array.isArray(body.items)
        ? body.items
        : (body.categoria ? [{ categoria: body.categoria, valorLimite: body.valorLimite }] : []);

      const categoriasValidas = new Set(['Mercado', 'Contas', 'Aluguel', 'Ifood', 'Outros']);
      const now = new Date().toISOString();
      const rows = inputItems.map(item => ({
        mes: dbMonth,
        categoria: item?.categoria,
        valor_limite: Number(item?.valorLimite || 0),
        updated_at: now
      }));

      if (!rows.length || rows.some(row =>
        !categoriasValidas.has(row.categoria) ||
        !Number.isFinite(row.valor_limite) ||
        row.valor_limite < 0
      )) {
        return json(req, 400, { message: 'Metas inválidas.' });
      }

      const res = await dataApi('/orcamentos?on_conflict=mes,categoria', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(rows)
      }, auth.jwt);
      const text = await res.text();
      if (!res.ok) {
        console.error(`[budgets:post] status=${res.status} body=${text.slice(0,300)}`);
        return json(req, res.status, { message: text || 'Erro ao salvar orçamento.' });
      }
      return json(req, 200, {
        ok: true,
        budgets: text ? JSON.parse(text) : [],
        token: auth.token
      });
    }

    return json(req, 405, { message: 'Método não permitido.' });
  };
}
