import { createSmartEntryService } from './services/smart-entry-service.mjs';
import { createSmartEntryRouter } from './routes/smart-entry.mjs';
import { createExpensesRouter } from './routes/expenses.mjs';
import { createBudgetsRouter } from './routes/budgets.mjs';
import { createMembersRouter } from './routes/members.mjs';
import { createRecurringRouter } from './routes/recurring.mjs';

const AUTH_BASE_URL = (process.env.GASTOS_AUTH_BASE_URL || '').replace(/\/$/, '');
const DATA_API_URL = (process.env.GASTOS_DATA_API_URL || '').replace(/\/$/, '');
const APP_ORIGIN = process.env.GASTOS_APP_ORIGIN || 'https://paulohaps.github.io';
const SMART_ENTRY_ENABLED = !['0', 'false', 'off', 'no'].includes(String(process.env.SMART_ENTRY_ENABLED || 'true').toLowerCase());
const SMART_ENTRY_TIMEZONE = process.env.SMART_ENTRY_TIMEZONE || 'America/Porto_Velho';

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

const smartEntryService = createSmartEntryService({
  enabled: SMART_ENTRY_ENABLED,
  timezone: SMART_ENTRY_TIMEZONE,
  dataApi
});

const smartEntryRouter = createSmartEntryRouter({
  service: smartEntryService,
  requireAuth,
  readJson,
  json,
  dataApi
});

const expensesRouter = createExpensesRouter({
  requireAuth,
  readJson,
  json,
  dataApi,
  monthRange,
  smartEntryService
});

const budgetsRouter = createBudgetsRouter({
  requireAuth,
  readJson,
  json,
  dataApi,
  monthToDb
});

const membersRouter = createMembersRouter({
  requireAuth,
  readJson,
  json,
  dataApi,
  authFetch
});

const recurringRouter = createRecurringRouter({
  requireAuth,
  readJson,
  json,
  dataApi
});

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
    if (path === '/' || path === '/health') return json(req, 200, {
      service: 'gastospwa',
      version: '2026-09-19.9',
      ok: true,
      features: { smartEntry: SMART_ENTRY_ENABLED, smartEntryLearning: SMART_ENTRY_ENABLED, smartEntryTelemetry: SMART_ENTRY_ENABLED }
    });
    if (path === '/features' && req.method === 'GET') {
      return json(req, 200, {
        smartEntry: SMART_ENTRY_ENABLED,
        smartEntryLearning: SMART_ENTRY_ENABLED,
        smartEntryTelemetry: SMART_ENTRY_ENABLED,
        smartEntryParser: 'rules-learning-history-v4',
        smartEntryAiConfigured: smartEntryService.isAiConfigured()
      });
    }
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

    const smartEntryResponse = await smartEntryRouter(req, url);
    if (smartEntryResponse) return smartEntryResponse;

    for (const router of [expensesRouter, budgetsRouter, membersRouter, recurringRouter]) {
      const response = await router(req, url);
      if (response) return response;
    }

    return json(req, 404, { message: 'Rota não encontrada.' });
  } catch (err) {
    console.error(`[fatal] ${req.method} ${path}:`, err?.stack || err);
    return json(req, 500, { error: 'INTERNAL_ERROR', message: 'Erro interno no servidor.' });
  }
}

export default handler;
