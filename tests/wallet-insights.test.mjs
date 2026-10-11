import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalletInsightsService } from '../backend/services/wallet-insights.mjs';
const result = globalThis.GastosWalletPlanner.analyze({ month: '2026-10', limit: 50, expenses: [{ data: '2026-10-01', valor: 100, categoria: 'Contas', descricao: 'SEGREDO' }] });
const env = { INSIGHTS_AI_BASE_URL: 'https://ai.test/v1', INSIGHTS_AI_API_KEY: 'secret', INSIGHTS_AI_MODEL: 'configured-model' };
test('IA desligada e ausência de sinais não fazem chamada externa', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error(); };
  assert.equal((await createWalletInsightsService({ env: {}, fetchImpl }).explain('u', 'w', result)).source, 'heuristics');
  await createWalletInsightsService({ env, fetchImpl }).explain('u', 'w', { ...result, signals: [] });
  assert.equal(calls, 0);
});
test('payload compacto sem descrição; cache, isolamento e invalidação', async () => {
  let calls = 0, time = 1000, sent;
  const service = createWalletInsightsService({ env, now: () => time, fetchImpl: async (_, options) => {
    calls++; sent = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: 'Revise as contas.' } }], usage: { prompt_tokens: 50, completion_tokens: 10 } });
  } });
  await service.explain('u1', 'w1', result);
  assert.equal((await service.explain('u1', 'w1', result)).cached, true); assert.equal(calls, 1);
  assert.equal(sent.max_tokens, 180); assert.ok(!JSON.stringify(sent).includes('SEGREDO'));
  await service.explain('u2', 'w1', result); assert.equal(calls, 2);
  assert.equal((await service.explain('u1', 'w1', { ...result, spent: 120 })).reason, 'cooldown');
  time += 60001;
  await service.explain('u1', 'w1', { ...result, spent: 120 }); assert.equal(calls, 3);
  time += 6 * 3600000;
  assert.equal((await service.explain('u1', 'w1', result)).cached, false); assert.equal(calls, 4);
});
test('chamadas concorrentes idênticas usam uma solicitação e falha preserva heurísticas', async () => {
  let calls = 0;
  const service = createWalletInsightsService({ env, fetchImpl: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return Response.json({}, { status: 500 }); } });
  const answers = await Promise.all([service.explain('u', 'w', result), service.explain('u', 'w', result)]);
  assert.equal(calls, 1); assert.equal(answers[0].source, 'heuristics');
});
test('configuração pessoal muda o provedor e invalida cache ao trocar a chave', async () => {
  let time = 1000, calls = 0, key = 'key-one';
  const service = createWalletInsightsService({ env: {}, now: () => time,
    resolveConfig: async () => ({ provider: 'deepseek', model: 'deepseek-flash', apiKey: key }),
    fetchImpl: async (url, options) => { calls++; assert.equal(url, 'https://api.deepseek.com/chat/completions'); assert.equal(options.headers.authorization, 'Bearer ' + key); return Response.json({ choices: [{ message: { content: 'Seu limite.' } }] }); }
  });
  assert.equal(await service.configured('u', 'jwt'), true);
  await service.explain('u', 'w', result, 'jwt'); key = 'key-two'; time += 60001;
  assert.equal((await service.explain('u', 'w', result, 'jwt')).cached, false); assert.equal(calls, 2);
});
