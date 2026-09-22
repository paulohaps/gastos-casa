export function createReceiptsRouter({ service, requireAuth, readJson, json }) {
  return async function handleReceiptsRoute(req, url) {
    if (!url.pathname.startsWith('/receipts/')) return null;

    if (url.pathname === '/receipts/inspect' && req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;

      const body = await readJson(req);
      const qrPayload = String(body.qrPayload || '');
      const ocrText = String(body.ocrText || '');

      if (!qrPayload.trim() && !ocrText.trim()) {
        return json(req, 400, {
          error:'RECEIPT_INPUT_REQUIRED',
          message:'Envie o QR Code ou o texto extraído do cupom.'
        });
      }
      if (qrPayload.length > 4000 || ocrText.length > 20000) {
        return json(req, 400, {
          error:'RECEIPT_INPUT_TOO_LONG',
          message:'O conteúdo do comprovante excedeu o limite de processamento.'
        });
      }

      const receipt = await service.inspect(auth.jwt, { qrPayload, ocrText });
      return json(req, 200, { receipt, token:auth.token });
    }

    return json(req, 405, { message:'Método não permitido.' });
  };
}
