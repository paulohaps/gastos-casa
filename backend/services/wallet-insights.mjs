import { createHash } from 'node:crypto';
import '../../js/core/wallet-planner.js';
const planner = globalThis.GastosWalletPlanner;
export function createWalletInsightsService({ fetchImpl = fetch, now = () => Date.now(), env = process.env } = {}) {
  const cache = new Map(), pending = new Map(), lastCalls = new Map();
  const ttl = 6 * 60 * 60 * 1000;
  const configured = () => Boolean(env.INSIGHTS_AI_BASE_URL && env.INSIGHTS_AI_API_KEY && env.INSIGHTS_AI_MODEL);
  function prune() {
    for (const [key, item] of cache) if (item.expires <= now()) cache.delete(key);
    for (const [key, time] of lastCalls) if (now() - time >= 60000) lastCalls.delete(key);
    while (cache.size >= 500) cache.delete(cache.keys().next().value);
  }
  async function explain(ownerId, walletId, result) {
    const fallback = { source: 'heuristics', text: result.signals.map(s => s.action).join(' ') || 'Sem sinais relevantes com os dados disponíveis.', cached: false, usage: null };
    if (!configured() || !result.signals.length) return fallback;
    const compact = planner.compact(result);
    const digest = createHash('sha256').update(JSON.stringify([env.INSIGHTS_AI_MODEL, compact])).digest('hex');
    const key = ownerId + ':' + walletId + ':' + digest;
    prune();
    const hit = cache.get(key);
    if (hit) return { ...hit.value, cached: true };
    if (pending.has(key)) return pending.get(key);
    if (lastCalls.has(ownerId)) return { ...fallback, reason: 'cooldown' };
    lastCalls.set(ownerId, now());
    const work = (async () => {
      try {
        const response = await fetchImpl(env.INSIGHTS_AI_BASE_URL.replace(/\/$/, '') + '/chat/completions', {
          method: 'POST', signal: AbortSignal.timeout(8000),
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.INSIGHTS_AI_API_KEY },
          body: JSON.stringify({ model: env.INSIGHTS_AI_MODEL, max_tokens: 180, temperature: 0.2, messages: [
            { role: 'system', content: 'Em português, explique os sinais financeiros fornecidos em até 3 frases. Dê uma ação prática. Use apenas os números recebidos. Não prometa economia, não invente histórico nem renda. Delivery é uma simulação de redução em 20%; ritmo é estimativa e contas fixas afetam o início do mês.' },
            { role: 'user', content: JSON.stringify(compact) }
          ] })
        });
        if (!response.ok) return { ...fallback, reason: 'provider_unavailable' };
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) return fallback;
        const value = { source: 'ai', text: text.trim().slice(0, 1200), cached: false,
          usage: data.usage ? { input: data.usage.prompt_tokens ?? null, output: data.usage.completion_tokens ?? null } : null };
        cache.set(key, { value, expires: now() + ttl });
        return value;
      } catch { return { ...fallback, reason: 'provider_unavailable' }; }

    })();
    pending.set(key, work);
    try { return await work; } finally { pending.delete(key); }
  }
  return { explain, configured };
}
