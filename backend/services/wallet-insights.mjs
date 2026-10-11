import { createHash } from 'node:crypto';
import { callAi } from './ai-settings.mjs';
import '../../js/core/wallet-planner.js';
const planner = globalThis.GastosWalletPlanner;
export function createWalletInsightsService({ fetchImpl = fetch, now = () => Date.now(), env = process.env, resolveConfig = async () => null } = {}) {
  const cache = new Map(), pending = new Map(), lastCalls = new Map();
  const ttl = 6 * 60 * 60 * 1000;
  async function config(owner, jwt) {
    const personal = await resolveConfig(owner, jwt);
    return personal || (env.INSIGHTS_AI_BASE_URL && env.INSIGHTS_AI_API_KEY && env.INSIGHTS_AI_MODEL ? { provider: 'system', baseUrl: env.INSIGHTS_AI_BASE_URL, apiKey: env.INSIGHTS_AI_API_KEY, model: env.INSIGHTS_AI_MODEL } : null);
  }
  const configured = async (owner, jwt) => Boolean(await config(owner, jwt));
  function prune() {
    for (const [key, item] of cache) if (item.expires <= now()) cache.delete(key);
    for (const [key, time] of lastCalls) if (now() - time >= 60000) lastCalls.delete(key);
    while (cache.size >= 500) cache.delete(cache.keys().next().value);
  }
  async function explain(ownerId, walletId, result, jwt) {
    const fallback = { source: 'heuristics', text: result.signals.map(s => s.action).join(' ') || 'Sem sinais relevantes com os dados disponíveis.', cached: false, usage: null };
    if (!result.signals.length) return fallback;
    const connection = await config(ownerId, jwt);
    if (!connection) return fallback;
    const compact = planner.compact(result);
    const digest = createHash('sha256').update(JSON.stringify([connection.provider, connection.model, connection.apiKey, compact])).digest('hex');
    const key = ownerId + ':' + walletId + ':' + digest;
    prune();
    const hit = cache.get(key);
    if (hit) return { ...hit.value, cached: true };
    if (pending.has(key)) return pending.get(key);
    if (lastCalls.has(ownerId)) return { ...fallback, reason: 'cooldown' };
    lastCalls.set(ownerId, now());
    const work = (async () => {
      try {
        const answer = await callAi(connection,
          'Em português, explique os sinais financeiros fornecidos em até 3 frases. Dê uma ação prática. Use apenas os números recebidos. Não prometa economia, não invente histórico nem renda. Quando houver protectedBudget, a referência diária já desconta sua reserva mensal; reserva é orçamento protegido, não dinheiro poupado ou transferido. Delivery é uma simulação de redução em 20%; ritmo é estimativa e contas fixas afetam o início do mês.',
          JSON.stringify(compact), { fetchImpl });
        const value = { source: 'ai', ...answer, cached: false };
        cache.set(key, { value, expires: now() + ttl });
        return value;
      } catch (error) { return { ...fallback, reason: 'provider_unavailable', providerCode: ['KEY_REJECTED', 'PROVIDER_LIMIT', 'MODEL_UNAVAILABLE'].includes(error.message) ? error.message : 'PROVIDER_UNAVAILABLE' }; }

    })();
    pending.set(key, work);
    try { return await work; } finally { pending.delete(key); }
  }
  return { explain, configured };
}
