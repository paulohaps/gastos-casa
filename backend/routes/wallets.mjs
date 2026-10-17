import '../../js/core/wallet-planner.js';
import { allRows } from '../data/rows.mjs';
import { cents, totalCents } from '../../js/core/financial-selection.mjs';
const planner = globalThis.GastosWalletPlanner;
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
const walletFields = 'id,nome,limite_mensal,goal_nome,goal_valor,goal_reserva,goal_prazo,goal_mes';
const categories = ['Mercado', 'Contas', 'Aluguel', 'Ifood', 'Outros'];
function validMoney(value, allowZero = false) {
  if (typeof value !== 'number') return false;
  try { const amount=cents(value); return amount >= (allowZero ? 0 : 1) && amount <= 999999999999; } catch { return false; }
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function createWalletsRouter({ requireAuth, readJson, json, dataApi, insightsService }) {
  async function rows(path, jwt) {
    const res = await dataApi(path, { method: 'GET' }, jwt);
    if (!res.ok) throw new Error('WALLET_DATA_UNAVAILABLE');
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('WALLET_DATA_UNAVAILABLE');
    return data;
  }
  async function expenses(walletId, owner, month, jwt) {
    const [year, mm] = month.split('-').map(Number);
    const end = mm === 12 ? `${year + 1}-01-01` : `${year}-${String(mm + 1).padStart(2, '0')}-01`;
    const query = `/personal_expenses?select=id,wallet_id,data,valor,descricao,categoria&owner_id=eq.${owner}&wallet_id=eq.${walletId}&data=gte.${month}-01&data=lt.${end}&order=data.desc,id.desc`;
    const all=await allRows(dataApi,query,jwt,{maxRows:10000});
    if(all.some(row=>!['number','string'].includes(typeof row.valor)||row.wallet_id!==walletId||typeof row.id!=='string'||!row.id||!validDate(row.data)||row.data<month+'-01'||row.data>=end||typeof row.descricao!=='string'||typeof row.categoria!=='string')) throw new Error('WALLET_DATA_UNAVAILABLE');
    totalCents(all);
    return all;
  }
  return async function route(req, url) {
    if (!['/wallets', '/wallets/expenses', '/wallets/insights', '/wallets/goal'].includes(url.pathname)) return null;
    const { auth, error } = await requireAuth(req, true);
    if (error) return error;
    const owner = auth.user?.id;
    if (!uuid(owner)) return json(req, 403, { message: 'Identidade inválida para carteiras pessoais.' });
    const isPost = req.method === 'POST';
    if (!isPost && req.method !== 'GET') return json(req, 405, { message: 'Método inválido.' });
    const body = isPost ? await readJson(req) : {};
    try {
      if (url.pathname === '/wallets') {
        if (!isPost) return json(req, 200, { wallets: await rows(`/personal_wallets?select=${walletFields}&owner_id=eq.${owner}&order=created_at.asc&limit=100`, auth.jwt), token: auth.token });
        if (!['add', 'update', 'delete'].includes(body.action)) return json(req, 400, { message: 'Ação inválida.' });
        if (body.action !== 'add' && !uuid(body.id)) return json(req, 400, { message: 'Carteira inválida.' });
        const name = String(body.nome || '').trim();
        if (body.action !== 'delete' && (name.length < 2 || name.length > 80 || !validMoney(body.limiteMensal, true))) return json(req, 400, { message: 'Informe nome e limite mensal válidos.' });
        if (body.action === 'add') {
          const count = await rows(`/personal_wallets?select=id&owner_id=eq.${owner}&limit=100`, auth.jwt);
          if (count.length >= 100) return json(req, 400, { message: 'Limite de 100 carteiras atingido.' });
        }
        const payload = { nome: name, limite_mensal: body.limiteMensal, ...(body.action === 'add' ? { owner_id: owner } : {}) };
        const res = await dataApi('/personal_wallets' + (body.action === 'add' ? '' : `?id=eq.${body.id}&owner_id=eq.${owner}`), {
          method: { add: 'POST', update: 'PATCH', delete: 'DELETE' }[body.action], headers: { Prefer: 'return=representation' },
          ...(body.action === 'delete' ? {} : { body: JSON.stringify(payload) })
        }, auth.jwt);
        if (!res.ok) return json(req, res.status === 409 ? 409 : 503, { message: body.action === 'delete' ? 'Remova os lançamentos antes de excluir a carteira.' : 'Não foi possível salvar a carteira.' });
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('WALLET_DATA_UNAVAILABLE');
        if (!data.length) return json(req, 404, { message: 'Carteira não encontrada.' });
        return json(req, 200, { wallets: data, token: auth.token });
      }
      const walletId = isPost ? body.walletId : url.searchParams.get('walletId');
      if (!uuid(walletId)) return json(req, 400, { message: 'Carteira inválida.' });
      const wallet = (await rows(`/personal_wallets?select=${walletFields}&id=eq.${walletId}&owner_id=eq.${owner}&limit=1`, auth.jwt))[0];
      if (!wallet) return json(req, 404, { message: 'Carteira não encontrada.' });
      if (!['number','string'].includes(typeof wallet.limite_mensal)||cents(wallet.limite_mensal)>999999999999) throw new Error('WALLET_DATA_UNAVAILABLE');
      if (url.pathname === '/wallets/goal') {
        if (!isPost) return json(req, 405, { message: 'Use POST para salvar uma meta.' });
        const goal = body.goal;
        if (goal !== null && (!goal || typeof goal.name !== 'string' || goal.name.trim().length < 2 || goal.name.trim().length > 80 || !validMoney(goal.target) || !validMoney(goal.reserve, true) || goal.reserve > goal.target || !validDate(goal.deadline) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(goal.month)) || goal.deadline.slice(0, 7) < goal.month)) return json(req, 400, { message: 'Revise nome, valor, prazo e reserva da meta. O prazo deve ser neste mês ou depois.' });
        const payload = goal === null ? { goal_nome: null, goal_valor: null, goal_reserva: null, goal_prazo: null, goal_mes: null }
          : { goal_nome: goal.name.trim(), goal_valor: goal.target, goal_reserva: goal.reserve, goal_prazo: goal.deadline, goal_mes: goal.month };
        const response = await dataApi(`/personal_wallets?id=eq.${walletId}&owner_id=eq.${owner}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }, auth.jwt);
        if (!response.ok) return json(req, 503, { message: 'Não foi possível salvar sua meta. Tente novamente.' });
        const saved = await response.json();
        if (!Array.isArray(saved)) throw new Error('WALLET_DATA_UNAVAILABLE');
        if (!saved.length) return json(req, 404, { message: 'Carteira não encontrada.' });
        return json(req, 200, { wallets: saved, token: auth.token });
      }
      if (url.pathname === '/wallets/expenses' && isPost) {
        if (!['add', 'update', 'delete'].includes(body.action) || (body.action !== 'add' && !uuid(body.id))) return json(req, 400, { message: 'Ação ou lançamento inválido.' });
        const description = String(body.descricao || '').trim();
        if (body.action !== 'delete' && (!validDate(body.dataGasto) || !validMoney(body.valor) || !description || description.length > 500 || !categories.includes(body.categoria))) return json(req, 400, { message: 'Revise data, valor, descrição e categoria.' });
        const res = await dataApi('/personal_expenses' + (body.action === 'add' ? '' : `?id=eq.${body.id}&wallet_id=eq.${walletId}&owner_id=eq.${owner}`), {
          method: { add: 'POST', update: 'PATCH', delete: 'DELETE' }[body.action], headers: { Prefer: 'return=representation' },
          ...(body.action === 'delete' ? {} : { body: JSON.stringify({ data: body.dataGasto, valor: body.valor, descricao: description, categoria: body.categoria,
            ...(body.action === 'add' ? { owner_id: owner, wallet_id: walletId } : {}) }) })
        }, auth.jwt);
        if (!res.ok) return json(req, 503, { message: 'Não foi possível salvar o lançamento pessoal.' });
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('WALLET_DATA_UNAVAILABLE');
        if (!data.length) return json(req, 404, { message: 'Lançamento não encontrado.' });
        return json(req, 200, { expenses: data, token: auth.token });
      }
      if (url.pathname === '/wallets/insights' && !isPost) return json(req, 405, { message: 'Use POST para solicitar uma explicação.' });
      const month = isPost ? body.month : url.searchParams.get('month');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return json(req, 400, { message: 'Mês inválido.' });
      const items = await expenses(walletId, owner, month, auth.jwt);
      const result = planner.analyze({ expenses: items, limit: Number(wallet.limite_mensal), month });
      if(cents(result.spent)!==totalCents(items)) throw new Error('WALLET_DATA_UNAVAILABLE');
      if (url.pathname === '/wallets/insights') {
        const protectedBudget = planner.protect(result, wallet.goal_nome ? { month: wallet.goal_mes, reserve: Number(wallet.goal_reserva) } : null);
        const advice = wallet.goal_nome ? { ...result, daily: protectedBudget.daily, protectedBudget,
          signals: result.signals.map(signal => signal.type === 'fast_pace' ? { ...signal, amount: protectedBudget.daily } : signal) } : result;
        return json(req, 200, { explanation: await insightsService.explain(owner, walletId, advice, auth.jwt), token: auth.token });
      }
      return json(req, 200, { expenses: items, plan: result, aiConfigured: await insightsService.configured(owner, auth.jwt), token: auth.token });
    } catch {
      return json(req, 503, { message: 'Carteiras indisponíveis. Verifique a migração e tente novamente.' });
    }
  };
}
