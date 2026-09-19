export function createMembersRouter({ requireAuth, readJson, json, dataApi, authFetch }) {
  return async function handleMembersRoute(req, url) {
    if (url.pathname !== '/members') return null;

    if (req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const res = await dataApi(
        '/household_members?select=auth_user_id,nome,email,ativo,created_at&order=nome.asc',
        { method: 'GET' },
        auth.jwt
      );
      const text = await res.text();
      if (!res.ok) {
        console.error(`[members:get] status=${res.status} body=${text.slice(0,300)}`);
        return json(req, res.status, { message: text || 'Erro ao carregar usuários.' });
      }
      return json(req, 200, { members: JSON.parse(text || '[]'), token: auth.token });
    }

    if (req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const body = await readJson(req);
      if (body.action !== 'add') return json(req, 400, { message: 'Ação inválida.' });

      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (name.length < 2 || !email.includes('@') || password.length < 8) {
        return json(req, 400, {
          message: 'Informe nome, e-mail válido e senha com pelo menos 8 caracteres.'
        });
      }

      const signupRes = await authFetch('/sign-up/email', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      const signupText = await signupRes.text();
      let signupData = null;
      try {
        signupData = signupText ? JSON.parse(signupText) : null;
      } catch {
        signupData = { message: signupText };
      }
      if (!signupRes.ok) {
        console.warn(`[members:add:auth] status=${signupRes.status} body=${signupText.slice(0,300)}`);
        return json(req, signupRes.status, {
          message: signupData?.message || 'Não foi possível criar a conta.'
        });
      }

      const newUserId = signupData?.user?.id || signupData?.data?.user?.id || signupData?.id;
      if (!newUserId) {
        console.error('[members:add] auth user created but id missing');
        return json(req, 500, {
          message: 'A conta foi criada, mas não foi possível vinculá-la à casa.'
        });
      }

      const memberRes = await dataApi('/household_members', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          auth_user_id: newUserId,
          nome: name,
          email,
          ativo: true
        })
      }, auth.jwt);
      const memberText = await memberRes.text();
      if (!memberRes.ok) {
        console.error(`[members:add:db] status=${memberRes.status} body=${memberText.slice(0,300)}`);
        return json(req, memberRes.status, {
          message: memberText || 'Conta criada, mas não foi possível liberar o acesso à casa.'
        });
      }

      return json(req, 200, {
        ok: true,
        member: JSON.parse(memberText || '[]')[0] || null,
        token: auth.token
      });
    }

    return json(req, 405, { message: 'Método não permitido.' });
  };
}
