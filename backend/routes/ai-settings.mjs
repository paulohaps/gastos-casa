import { AI_PROVIDERS } from '../services/ai-settings.mjs';
const messages = { INVALID_CONFIG: 'Escolha um provedor e um modelo válido.', INVALID_KEY: 'Informe a chave de API desse provedor.',
  STORAGE_UNAVAILABLE: 'Não foi possível acessar a configuração de IA. Tente novamente.', COOLDOWN: 'Aguarde 30 segundos antes de testar novamente.',
  KEY_REJECTED: 'O provedor recusou a chave. Confira a chave e as permissões.', PROVIDER_LIMIT: 'Limite ou saldo do provedor atingido. Confira sua conta.',
  MODEL_UNAVAILABLE: 'Esse modelo não está disponível para sua chave. Escolha outro modelo.', EMPTY_RESPONSE: 'O modelo não retornou texto. Tente outro modelo.' };
export function createAiSettingsRouter({ requireAuth, readJson, json, service }) {
  return async (req, url) => {
    if (url.pathname !== '/ai/settings') return null;
    const { auth, error } = await requireAuth(req, true);
    if (error) return error;
    const owner = auth.user?.id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner || '')) return json(req, 403, { message: 'Identidade inválida.' });
    try {
      if (req.method === 'GET') return json(req, 200, { settings: await service.get(owner, auth.jwt), providers: AI_PROVIDERS, storageReady: service.storageReady(), token: auth.token });
      if (req.method !== 'POST') return json(req, 405, { message: 'Método inválido.' });
      const body = await readJson(req);
      if (body.action === 'save') return json(req, 200, { settings: await service.save(owner, auth.jwt, body), token: auth.token });
      if (body.action === 'test') return json(req, 200, { connection: await service.test(owner, auth.jwt, body), token: auth.token });
      if (body.action === 'delete') { await service.remove(owner, auth.jwt); return json(req, 200, { settings: null, token: auth.token }); }
      return json(req, 400, { message: 'Ação inválida.' });
    } catch (e) {
      const code = e.message;
      return json(req, ['INVALID_CONFIG', 'INVALID_KEY', 'KEY_REJECTED', 'MODEL_UNAVAILABLE'].includes(code) ? 400 : ['COOLDOWN', 'PROVIDER_LIMIT'].includes(code) ? 429 : 503,
        { code: Object.hasOwn(messages, code) ? code : 'PROVIDER_UNAVAILABLE', message: messages[code] || 'O provedor de IA não respondeu. Tente novamente.' });
    }
  };
}
