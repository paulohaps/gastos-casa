export function createSmartEntryRouter({ service, requireAuth, readJson, json, dataApi }) {
  return async function handleSmartEntryRoute(req, url) {
    const path = url.pathname;

    if (!path.startsWith('/smart-entry/')) return null;
    if (!service.isEnabled()) {
      return json(req, 404, { error: 'SMART_ENTRY_DISABLED', message: 'Lançamento inteligente indisponível.' });
    }

    if (path === '/smart-entry/parse' && req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;

      const body = await readJson(req);
      const text = String(body.text || '').trim();
      if (text.length < 3) {
        return json(req, 400, { error: 'SMART_ENTRY_TEXT_REQUIRED', message: 'Descreva o gasto com pelo menos 3 caracteres.' });
      }
      if (text.length > 500) {
        return json(req, 400, { error: 'SMART_ENTRY_TEXT_TOO_LONG', message: 'A descrição inteligente aceita até 500 caracteres.' });
      }

      const result = await service.parse(text, auth.jwt);
      return json(req, 200, {
        ...result,
        enabled: true,
        token: auth.token
      });
    }

    if (path === '/smart-entry/metrics' && req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      try {
        const metrics = await service.metrics(auth.jwt, url.searchParams.get('days'));
        return json(req, 200, { metrics, token: auth.token });
      } catch (err) {
        console.error('[smart-metrics] failed:', err?.message || err);
        return json(req, 500, { message: 'Não foi possível carregar a qualidade do Smart Entry.' });
      }
    }

    if (path === '/smart-entry/rules' && req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const rules = await service.fetchRules(auth.jwt, true);
      return json(req, 200, { rules, token: auth.token });
    }

    if (path === '/smart-entry/rules' && req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const body = await readJson(req);

      if (body.action === 'set-manual') {
        try {
          const rule = await service.setManualRule(auth.jwt, body.term, body.category);
          return json(req, 200, { ok: true, rule, token: auth.token });
        } catch (err) {
          return json(req, 400, { error: 'SMART_RULE_INVALID', message: err?.message || 'Não foi possível salvar a regra.' });
        }
      }

      if (body.action === 'delete') {
        const id = String(body.id || '');
        if (!id) return json(req, 400, { message: 'Regra inválida.' });
        const res = await dataApi(
          `/smart_entry_rules?id=eq.${encodeURIComponent(id)}`,
          { method: 'DELETE', headers: { Prefer: 'return=representation' } },
          auth.jwt
        );
        const text = await res.text();
        if (!res.ok) return json(req, res.status, { message: text || 'Erro ao excluir regra.' });
        return json(req, 200, { ok: true, token: auth.token });
      }

      if (body.action === 'delete-term') {
        const term = service.normalizeLearningTerm(body.term);
        if (!term) return json(req, 400, { message: 'Termo inválido.' });
        const res = await dataApi(
          `/smart_entry_rules?termo_normalizado=eq.${encodeURIComponent(term)}`,
          { method: 'DELETE', headers: { Prefer: 'return=representation' } },
          auth.jwt
        );
        const text = await res.text();
        if (!res.ok) return json(req, res.status, { message: text || 'Erro ao excluir aprendizado.' });
        return json(req, 200, { ok: true, token: auth.token });
      }

      if (body.action === 'set-active') {
        const id = String(body.id || '');
        if (!id) return json(req, 400, { message: 'Regra inválida.' });
        const res = await dataApi(
          `/smart_entry_rules?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ ativo: body.active === true, updated_at: new Date().toISOString() })
          },
          auth.jwt
        );
        const text = await res.text();
        if (!res.ok) return json(req, res.status, { message: text || 'Erro ao atualizar regra.' });
        return json(req, 200, {
          ok: true,
          rule: JSON.parse(text || '[]')[0] || null,
          token: auth.token
        });
      }

      return json(req, 400, { message: 'Ação inválida.' });
    }

    return json(req, 405, { message: 'Método não permitido.' });
  };
}
