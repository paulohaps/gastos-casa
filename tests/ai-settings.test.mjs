import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_PROVIDERS, callAi, createAiSettingsService } from '../backend/services/ai-settings.mjs';
import { createAiSettingsRouter } from '../backend/routes/ai-settings.mjs';
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const key = 'test-key-never-expose', env = { AI_SETTINGS_ENCRYPTION_KEY: 'ab'.repeat(32) };
function setup(extra = {}) {
  let row = null; const calls = [];
  const service = createAiSettingsService({ env, ...extra, dataApi: async (path, options, jwt) => {
    calls.push({ path, options, jwt });
    if (options.method === 'POST') row = JSON.parse(options.body);
    if (options.method === 'DELETE') row = null;
    return options.method === 'GET' ? Response.json(row ? [row] : []) : new Response(null, { status: 204 });
  } });
  return { service, calls, row: () => row };
}
test('chave criptografada, metadata sem segredo, AAD por dono e atualização sem redigitar', async () => {
  const { service, calls, row } = setup();
  const saved = await service.save(owner, 'jwt', { provider: 'gemini', model: AI_PROVIDERS[0].models[0].id, apiKey: key });
  assert.ok(!JSON.stringify(saved).includes(key)); assert.ok(!row().key_ciphertext.includes(key));
  assert.equal((await service.resolve(owner, 'jwt')).apiKey, key);
  assert.equal(await service.resolve(other, 'jwt'), null); // ciphertext cannot move between owners
  const metadata = await service.get(owner, 'jwt');
  assert.deepEqual(Object.keys(metadata).sort(), ['hasKey', 'model', 'provider', 'updatedAt']);
  assert.ok(calls.at(-1).path.includes('owner_id=eq.' + owner));
  assert.ok(!calls.at(-1).path.includes('key_ciphertext'));
  await service.save(owner, 'jwt', { provider: 'gemini', model: 'gemini-3.8-flash' });
  assert.equal((await service.resolve(owner, 'jwt')).apiKey, key);
  await assert.rejects(service.save(owner, 'jwt', { provider: 'deepseek', model: 'deepseek-flash' }), /INVALID_KEY/);
  await service.remove(owner, 'jwt'); assert.equal(await service.get(owner, 'jwt'), null);
});
test('endereços fixos, modelos válidos, segredo no header e limite de saída', async () => {
  const seen = [];
  const fetchImpl = async (url, options) => { seen.push({ url, options, body: JSON.parse(options.body) }); return Response.json(url.includes('googleapis') ? { candidates: [{ content: { parts: [{ thought: true, text: 'Não publicar pensamento' }, { text: 'Revise seu limite.' }] } }] } : { choices: [{ message: { content: 'Revise seu limite.' } }] }); };
  for (const provider of AI_PROVIDERS) {
    const answer = await callAi({ provider: provider.id, model: provider.models[0].id, apiKey: key }, 'Sistema', 'Resumo', { fetchImpl });
    assert.equal(answer.text, 'Revise seu limite.');
  }
  assert.equal(seen[0].options.headers['x-goog-api-key'], key); assert.ok(!seen[0].url.includes(key));
  assert.equal(seen[0].body.generationConfig.maxOutputTokens, 180);
  assert.equal(seen[1].options.headers.authorization, 'Bearer ' + key); assert.equal(seen[1].body.max_tokens, 180);
  assert.deepEqual(seen[1].body.thinking, { type: 'disabled' });
  const { service } = setup();
  await assert.rejects(service.save(owner, 'jwt', { provider: 'gemini', model: '../internal', apiKey: key }), /INVALID_CONFIG/);
  await assert.rejects(service.save(owner, 'jwt', { provider: 'other', model: 'x', apiKey: key }), /INVALID_CONFIG/);
});
test('falhas do provedor não vazam corpo ou chave, teste tem cooldown e não salva', async () => {
  let count = 0;
  const { service, row } = setup({ fetchImpl: async () => { count++; return Response.json({ secret: key }, { status: 401 }); } });
  const body = { provider: 'deepseek', model: 'deepseek-flash', apiKey: key };
  await assert.rejects(service.test(owner, 'jwt', body), /KEY_REJECTED/);
  await assert.rejects(service.test(owner, 'jwt', body), /COOLDOWN/);
  assert.equal(count, 1); assert.equal(row(), null);
  const router = createAiSettingsRouter({ requireAuth: async () => ({ auth: { user: { id: owner }, jwt: 'jwt' } }), service,
    readJson: req => req.json(), json: (_, status, answer) => Response.json(answer, { status }) });
  const req = new Request('https://test/ai/settings', { method: 'POST', body: JSON.stringify({ ...body, action: 'test' }) });
  const response = await router(req, new URL(req.url)); assert.equal(response.status, 429); assert.ok(!(await response.text()).includes(key));
});
test('sem sessão não acessa configurações; armazenamento sem chave mestre falha fechado', async () => {
  let called = false;
  const router = createAiSettingsRouter({ requireAuth: async () => ({ error: Response.json({}, { status: 401 }) }), service: { get: () => { called = true; } } });
  const req = new Request('https://test/ai/settings');assert.equal((await router(req, new URL(req.url))).status, 401);assert.equal(called, false);
  const { service } = setup({ env: {} });
  assert.equal(service.storageReady(), false);
  await assert.rejects(service.save(owner, 'jwt', { provider: 'deepseek', model: 'deepseek-flash', apiKey: key }), /STORAGE_UNAVAILABLE/);
});
test('a rota usa a identidade da sessão e traduz falha sem ecoar segredo do provedor', async () => {
  let identity;
  const router = createAiSettingsRouter({ requireAuth: async () => ({ auth: { user: { id: owner }, jwt: 'jwt' } }),
    service: { save: async (id, jwt) => { identity = { id, jwt }; throw new Error('HTTP 500: ' + key); } },
    readJson: req => req.json(), json: (_, status, body) => Response.json(body, { status }) });
  const req = new Request('https://test/ai/settings', { method: 'POST', body: JSON.stringify({ action: 'save', owner_id: other, apiKey: key }) });
  const response = await router(req, new URL(req.url)); assert.deepEqual(identity, { id: owner, jwt: 'jwt' });
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes(key));
});
