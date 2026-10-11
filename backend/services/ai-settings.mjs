import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const AI_PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', keyUrl: 'https://aistudio.google.com/api-keys', models: [
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', description: 'Rápido e econômico', recommended: true },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Análises mais elaboradas' }
  ] },
  { id: 'deepseek', name: 'DeepSeek', keyUrl: 'https://platform.deepseek.com/api_keys', models: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'Conversa rápida', recommended: true },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: 'Análises mais elaboradas' }
  ] }
];
export function validateConfig({ provider, model, apiKey }) {
  if (!AI_PROVIDERS.some(p => p.id === provider) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(String(model || ''))) throw new Error('INVALID_CONFIG');
  if (typeof apiKey !== 'string' || apiKey.trim().length < 12 || apiKey.length > 512 || /[\s\x00-\x1f]/.test(apiKey.trim())) throw new Error('INVALID_KEY');
  return { provider, model, apiKey: apiKey.trim() };
}
export function createAiSettingsService({ dataApi, env = process.env, fetchImpl = fetch, now = () => Date.now() }) {
  const tests = new Map();
  function encryptionKey() {
    const value = env.AI_SETTINGS_ENCRYPTION_KEY || '';
    if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('STORAGE_UNAVAILABLE');
    return Buffer.from(value, 'hex');
  }
  function encrypt(apiKey, owner) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    cipher.setAAD(Buffer.from(owner));
    const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(v => v.toString('base64url')).join('.');
  }
  function decrypt(value, owner) {
    const [iv, tag, encrypted] = value.split('.').map(v => Buffer.from(v, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAAD(Buffer.from(owner)); decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
  async function get(owner, jwt, credentials = false) {
    const res = await dataApi(`/private_ai_settings?select=provider,model,updated_at${credentials ? ',key_ciphertext' : ''}&owner_id=eq.${owner}&limit=1`, { method: 'GET' }, jwt);
    if (!res.ok) throw new Error('STORAGE_UNAVAILABLE');
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('STORAGE_UNAVAILABLE');
    const row = rows[0];
    if (!row) return null;
    return credentials ? { ...row, apiKey: decrypt(row.key_ciphertext, owner) } : { provider: row.provider, model: row.model, updatedAt: row.updated_at, hasKey: true };
  }
  async function resolve(owner, jwt) {
    try { return await get(owner, jwt, true); } catch { return null; }
  }
  async function candidate(owner, jwt, body) {
    const current = body.apiKey ? null : await get(owner, jwt, true);
    if (!body.apiKey && current?.provider !== body.provider) throw new Error('INVALID_KEY');
    return validateConfig({ ...body, apiKey: body.apiKey || current?.apiKey });
  }
  async function save(owner, jwt, body) {
    const config = await candidate(owner, jwt, body);
    const res = await dataApi('/private_ai_settings?on_conflict=owner_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({
      owner_id: owner, provider: config.provider, model: config.model, key_ciphertext: encrypt(config.apiKey, owner), updated_at: new Date(now()).toISOString()
    }) }, jwt);
    if (!res.ok) throw new Error('STORAGE_UNAVAILABLE');
    return { provider: config.provider, model: config.model, hasKey: true };
  }
  async function remove(owner, jwt) {
    const res = await dataApi(`/private_ai_settings?owner_id=eq.${owner}`, { method: 'DELETE' }, jwt);
    if (!res.ok) throw new Error('STORAGE_UNAVAILABLE');
  }
  async function test(owner, jwt, body) {
    for (const [id, time] of tests) if (now() - time >= 30000) tests.delete(id);
    if (tests.has(owner)) throw new Error('COOLDOWN');
    const config = await candidate(owner, jwt, body);
    if (tests.size >= 1000) throw new Error('COOLDOWN');
    tests.set(owner, now());
    await callAi(config, 'Responda somente OK.', 'Teste de conexão.', { fetchImpl, maxTokens: 32 });
    return { ok: true, provider: config.provider, model: config.model };
  }
  return { get, resolve, save, remove, test, storageReady: () => /^[0-9a-f]{64}$/i.test(env.AI_SETTINGS_ENCRYPTION_KEY || '') };
}
export async function callAi(config, instruction, content, { fetchImpl = fetch, maxTokens = 180 } = {}) {
  let url, headers, body;
  if (config.provider === 'gemini') {
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(config.model) + ':generateContent';
    headers = { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey };
    body = { systemInstruction: { parts: [{ text: instruction }] }, contents: [{ role: 'user', parts: [{ text: content }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2, thinkingConfig: config.model.startsWith('gemini-2.5') ? { thinkingBudget: 0 } : { thinkingLevel: 'minimal' } } };
  } else if (config.provider === 'deepseek' || config.provider === 'system') {
    url = config.provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : config.baseUrl.replace(/\/$/, '') + '/chat/completions';
    headers = { 'content-type': 'application/json', authorization: 'Bearer ' + config.apiKey };
    body = { model: config.model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: 'system', content: instruction }, { role: 'user', content }],
      ...(config.provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {}) };
  } else throw new Error('INVALID_CONFIG');
  const response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(12000), redirect: 'error' });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'KEY_REJECTED' : response.status === 429 ? 'PROVIDER_LIMIT' : response.status === 404 || response.status === 400 ? 'MODEL_UNAVAILABLE' : 'PROVIDER_UNAVAILABLE');
  const data = await response.json();
  const text = config.provider === 'gemini' ? data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') : data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('EMPTY_RESPONSE');
  const usage = config.provider === 'gemini' ? data.usageMetadata : data.usage;
  return { text: text.trim().slice(0, 1200), usage: usage ? { input: usage.promptTokenCount ?? usage.prompt_tokens ?? null, output: usage.candidatesTokenCount ?? usage.completion_tokens ?? null } : null };
}
