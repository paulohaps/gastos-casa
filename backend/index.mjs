const AUTH_BASE_URL = (process.env.GASTOS_AUTH_BASE_URL || '').replace(/\/$/, '');
const DATA_API_URL = (process.env.GASTOS_DATA_API_URL || '').replace(/\/$/, '');
const APP_ORIGIN = process.env.GASTOS_APP_ORIGIN || 'https://paulohaps.github.io';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function corsHeaders(req) {
  const incoming = req.headers.get('origin');
  const allowOrigin = incoming === APP_ORIGIN || incoming === 'null' ? incoming : APP_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowOrigin || APP_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(req) }
  });
}

function noContent(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

async function readJson(req) {
  try { return await req.json(); }
  catch { return {}; }
}

function packSession(cookieName, cookieValue) {
  return Buffer.from(JSON.stringify({ cookieName, cookieValue }), 'utf8').toString('base64url');
}

function unpackSession(token) {
  if (!token) return null;
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (parsed?.cookieName && parsed?.cookieValue) return parsed;
  } catch {}
  return null;
}

function parseSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (values?.length) return values;
  }
  const one = headers.get('set-cookie');
  return one ? [one] : [];
}

function extractSessionCookie(headers) {
  const cookies = parseSetCookies(headers);
  const parsed = cookies.map(v => {
    const first = v.split(';')[0] || '';
    const idx = first.indexOf('=');
    if (idx < 1) return null;
    return { name: first.slice(0, idx).trim(), value: first.slice(idx + 1).trim() };
  }).filter(Boolean);

  const preferred = parsed.find(c => /session/i.test(c.name)) || parsed[0];
  return preferred ? { cookieName: preferred.name, cookieValue: preferred.value } : null;
}

function authHeaders(cookie) {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Origin': APP_ORIGIN,
    'Referer': APP_ORIGIN + '/'
  , ...(cookie ? { 'Cookie': `${cookie.cookieName}=${cookie.cookieValue}` } : {}) };
}

async function authFetch(path, options = {}, cookie = null) {
  const headers = { ...authHeaders(cookie), ...(options.headers || {}) };
  return fetch(AUTH_BASE_URL + path, { ...options, headers, redirect: 'manual' });
}

async function getSessionFromCookie(cookie) {
  if (!cookie) return null;
  const res = await authFetch('/get-session', { method: 'GET' }, cookie);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  if (data.user) return data;
  if (data.session?.user) return { user: data.session.user, session: data.session };
  return data;
}

async function getJwtFromCookie(cookie) {
  const attempts = ['/token', '/set-auth-jwt'];
  for (const path of attempts) {
    try {
      const res = await authFetch(path, { method: 'GET' }, cookie);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text) continue;
      try {
        const data = JSON.parse(text);
        const token = data?.token || data?.access_token || data?.jwt || data?.data?.token;
        if (token && typeof token === 'string' && token.split('.').length === 3) return token;
      } catch {
        const raw = text.trim().replace(/^"|"$/g, '');
        if (raw.split('.').length === 3) return raw;
      }
    } catch {}
  }
  return null;
}

async function resolveAuth(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const packed = unpackSession(token);
  const candidates = packed ? [packed] : [
    { cookieName: 'better-auth.session_token', cookieValue: token },
    { cookieName: '__Secure-better-auth.session_token', cookieValue: token },
    { cookieName: 'session_token', cookieValue: token }
  ];

  for (const cookie of candidates) {
    try {
      const sessionData = await getSessionFromCookie(cookie);
      if (!sessionData?.user) continue;
      const jwt = await getJwtFromCookie(cookie);
      return {
        user: sessionData.user,
        session: sessionData.session || null,
        cookie,
        jwt,
        token: packSession(cookie.cookieName, cookie.cookieValue)
      };
    } catch {}
  }
  return null;
}

async function requireAuth(req, requireJwt = false) {
  const auth = await resolveAuth(req);
  if (!auth) return { error: json(req, 401, { error: 'SESSION_EXPIRED', message: 'Sua sessão expirou. Entre novamente.' }) };
  if (requireJwt && !auth.jwt) {
    console.error('[auth] valid session but JWT unavailable');
    return { error: json(req, 500, { error: 'JWT_UNAVAILABLE', message: 'Não foi possível autorizar o acesso aos dados.' }) };
  }
  return { auth };
}

async function dataApi(path, options, jwt) {
  const headers = new Headers(options?.headers || {});
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${jwt}`);
  if (options?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(DATA_API_URL + path, { ...options, headers });
}

function monthRange(month) {
  const m = /^(\d{2})\/(\d{4})$/.exec(month || '');
  if (!m) return null;
  const mm = Number(m[1]), yyyy = Number(m[2]);
  if (mm < 1 || mm > 12) return null;
  const start = `${yyyy}-${String(mm).padStart(2,'0')}-01`;
  const nmm = mm === 12 ? 1 : mm + 1;
  const ny = mm === 12 ? yyyy + 1 : yyyy;
  const end = `${ny}-${String(nmm).padStart(2,'0')}-01`;
  return { start, end };
}

function monthToDb(month) {
  const m = /^(\d{2})\/(\d{4})$/.exec(month || '');
  return m ? `${m[2]}-${m[1]}` : null;
}

async function handleLogin(req, signup = false) {
  const body = await readJson(req);
  const path = signup ? '/sign-up/email' : '/sign-in/email';
  const payload = signup
    ? { name: body.name, email: body.email, password: body.password }
    : { email: body.email, password: body.password };

  const res = await authFetch(path, { method: 'POST', body: JSON.stringify(payload) });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) {
    console.warn(`[auth] ${signup ? 'signup' : 'login'} failed status=${res.status} body=${text.slice(0,300)}`);
    return json(req, res.status, { error: data?.code || 'AUTH_FAILED', message: data?.message || 'Não foi possível autenticar.' });
  }

  const cookie = extractSessionCookie(res.headers);
  if (!cookie) {
    console.error('[auth] login succeeded but no session cookie was returned');
    return json(req, 500, { error: 'SESSION_COOKIE_MISSING', message: 'O servidor não retornou uma sessão válida.' });
  }

  const sessionData = await getSessionFromCookie(cookie);
  const user = sessionData?.user || data?.user || null;
  if (!user) return json(req, 500, { error: 'SESSION_INVALID', message: 'A sessão foi criada, mas não pôde ser validada.' });
  return json(req, 200, { token: packSession(cookie.cookieName, cookie.cookieValue), user, session: sessionData?.session || null });
}

async function handler(req) {
  if (req.method === 'OPTIONS') return noContent(req);
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (path === '/' || path === '/health') return json(req, 200, { service: 'gastospwa', version: '2026-09-19.3', ok: true });
    if (path === '/login' && req.method === 'POST') return handleLogin(req, false);
    if (path === '/signup' && req.method === 'POST') return handleLogin(req, true);

    if (path === '/session' && req.method === 'GET') {
      const { auth, error } = await requireAuth(req, false); if (error) return error;
      return json(req, 200, { token: auth.token, user: auth.user, session: auth.session });
    }

    if (path === '/logout' && req.method === 'POST') {
      const { auth, error } = await requireAuth(req, false); if (error) return error;
      try { await authFetch('/sign-out', { method: 'POST', body: '{}' }, auth.cookie); } catch {}
      return json(req, 200, { ok: true });
    }

    if (path === '/months' && req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true); if (error) return error;
      const res = await dataApi('/gastos?select=data&order=data.desc', { method: 'GET' }, auth.jwt);
      const text = await res.text();
      if (!res.ok) { console.error(`[months] status=${res.status} body=${text.slice(0,300)}`); return json(req, res.status, { message: 'Erro ao carregar meses.' }); }
      const rows = JSON.parse(text || '[]');
      const months = [...new Set(rows.map(r => { const [y,m] = String(r.data).split('-'); return `${m}/${y}`; }).filter(Boolean))];
      return json(req, 200, { months, token: auth.token, user: auth.user });
    }

    if (path === '/expenses' && req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true); if (error) return error;
      const month = url.searchParams.get('month');
      let query = '/gastos?select=id,data,usuario,valor,descricao,categoria,forma_pagamento&order=data.desc,created_at.desc';
      const range = monthRange(month);
      if (range) query += `&data=gte.${range.start}&data=lt.${range.end}`;
      const res = await dataApi(query, { method: 'GET' }, auth.jwt);
      const text = await res.text();
      if (!res.ok) { console.error(`[expenses:get] status=${res.status} body=${text.slice(0,300)}`); return json(req, res.status, { message: 'Erro ao carregar gastos.' }); }
      return json(req, 200, { expenses: JSON.parse(text || '[]'), token: auth.token });
    }

    if (path === '/expenses' && req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true); if (error) return error;
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
        res = await dataApi('/gastos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }, auth.jwt);
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
        res = await dataApi(`/gastos?id=eq.${encodeURIComponent(body.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }, auth.jwt);
      } else if (body.action === 'delete') {
        res = await dataApi(`/gastos?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } }, auth.jwt);
      } else return json(req, 400, { message: 'Ação inválida.' });
      const text = await res.text();
      if (!res.ok) { console.error(`[expenses:${body.action}] status=${res.status} body=${text.slice(0,300)}`); return json(req, res.status, { message: text || 'Erro ao salvar gasto.' }); }
      return json(req, 200, { ok: true, data: text ? JSON.parse(text) : null, token: auth.token });
    }

    if (path === '/budgets' && req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true); if (error) return error;
      const dbMonth = monthToDb(url.searchParams.get('month'));
      if (!dbMonth) return json(req, 400, { message: 'Mês inválido.' });
      const res = await dataApi(`/orcamentos?mes=eq.${encodeURIComponent(dbMonth)}&select=id,mes,categoria,valor_limite&order=categoria.asc`, { method: 'GET' }, auth.jwt);
      const text = await res.text();
      if (!res.ok) { console.error(`[budgets:get] status=${res.status} body=${text.slice(0,300)}`); return json(req, res.status, { message: text || 'Erro ao carregar orçamento.' }); }
      return json(req, 200, { budgets: JSON.parse(text || '[]'), token: auth.token });
    }

    if (path === '/budgets' && req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true); if (error) return error;
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

      if (!rows.length || rows.some(row => !categoriasValidas.has(row.categoria) || !Number.isFinite(row.valor_limite) || row.valor_limite < 0)) {
        return json(req, 400, { message: 'Metas inválidas.' });
      }

      const res = await dataApi('/orcamentos?on_conflict=mes,categoria', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(rows)
      }, auth.jwt);
      const text = await res.text();
      if (!res.ok) { console.error(`[budgets:post] status=${res.status} body=${text.slice(0,300)}`); return json(req, res.status, { message: text || 'Erro ao salvar orçamento.' }); }
      return json(req, 200, { ok: true, budgets: text ? JSON.parse(text) : [], token: auth.token });
    }

    if (path === '/recurring' && req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true); if (error) return error;
      const res = await dataApi('/gastos_recorrentes?select=id,descricao,valor,categoria,forma_pagamento,dia_vencimento,ativo&order=dia_vencimento.asc', { method: 'GET' }, auth.jwt);
      const text = await res.text();
      if (!res.ok) { console.error(`[recurring:get] status=${res.status} body=${text.slice(0,300)}`); return json(req, res.status, { message: text || 'Erro ao carregar recorrentes.' }); }
      return json(req, 200, { recurring: JSON.parse(text || '[]'), token: auth.token });
    }

    if (path === '/recurring' && req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true); if (error) return error;
      const body = await readJson(req);
      let res;
      if (body.action === 'add') {
        const row = { descricao: body.descricao, valor: Number(body.valor), categoria: body.categoria || 'Outros', forma_pagamento: body.formaPagamento || 'Dinheiro', dia_vencimento: Number(body.diaVencimento), ativo: body.ativo !== false };
        res = await dataApi('/gastos_recorrentes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }, auth.jwt);
      } else if (body.action === 'update') {
        const row = { descricao: body.descricao, valor: Number(body.valor), categoria: body.categoria || 'Outros', forma_pagamento: body.formaPagamento || 'Dinheiro', dia_vencimento: Number(body.diaVencimento), ativo: body.ativo !== false, updated_at: new Date().toISOString() };
        res = await dataApi(`/gastos_recorrentes?id=eq.${encodeURIComponent(body.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }, auth.jwt);
      } else if (body.action === 'delete') {
        res = await dataApi(`/gastos_recorrentes?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } }, auth.jwt);
      } else return json(req, 400, { message: 'Ação inválida.' });
      const text = await res.text();
      if (!res.ok) { console.error(`[recurring:${body.action}] status=${res.status} body=${text.slice(0,300)}`); return json(req, res.status, { message: text || 'Erro ao salvar recorrente.' }); }
      return json(req, 200, { ok: true, data: text ? JSON.parse(text) : null, token: auth.token });
    }

    return json(req, 404, { message: 'Rota não encontrada.' });
  } catch (err) {
    console.error(`[fatal] ${req.method} ${path}:`, err?.stack || err);
    return json(req, 500, { error: 'INTERNAL_ERROR', message: 'Erro interno no servidor.' });
  }
}

export default handler;
