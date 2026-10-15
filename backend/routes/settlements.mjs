import { HOUSEHOLD } from '../settlements/calculator.mjs';
import { allRows } from '../data/rows.mjs';
import { validDate, validAmount } from '../data/validation.mjs';
const METHODS = new Set(['Dinheiro', 'Vale']);
const PEOPLE = new Set(Object.values(HOUSEHOLD));

export function createSettlementsRouter({ requireAuth, readJson, json, dataApi, monthRange, monthToDb }) {
  return async function handleSettlementsRoute(req, url) {
    if (url.pathname !== '/settlements') return null;
    const { auth, error } = await requireAuth(req, true);
    if (error) return error;
    if (req.method === 'GET') {
      const month = monthToDb(url.searchParams.get('month'));
      if (!month) return json(req, 400, { message: 'Competência inválida.' });
      const settlements = await allRows(dataApi, `/acertos?select=id,competencia,data_pagamento,pagador,recebedor,forma_pagamento,valor,observacao,created_at&competencia=eq.${month}-01&order=data_pagamento.desc,created_at.desc,id.desc`, auth.jwt);
      const capabilityResponse = await dataApi('/rpc/settlement_capabilities', { method: 'POST', body: '{}' }, auth.jwt);
      const capability = capabilityResponse.ok ? await capabilityResponse.json() : null;
      return json(req, 200, { settlements, complete: true, atomicSettlements: capability?.atomic === true && capability?.policy === 'cents-v1', token: auth.token });
    }
    if (req.method !== 'POST') return json(req, 405, { message: 'Método inválido.' });
    const body = await readJson(req);
    if (body.action === 'delete') {
      if (!body.id) return json(req, 400, { message: 'Acerto inválido.' });
      const response = await dataApi(`/acertos?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'DELETE', headers: { Prefer: 'return=representation' }
      }, auth.jwt);
      if (!response.ok) return json(req, response.status, { message: 'Não foi possível excluir o pagamento.' });
      const rows = await response.json();
      if (!Array.isArray(rows)) return json(req, 502, { message: 'Resposta inválida dos acertos.' });
      if (!rows.length) return json(req, 404, { message: 'Acerto não encontrado.' });
      return json(req, 200, { ok: true, data: rows, token: auth.token });
    }
    if (body.action !== 'add') return json(req, 400, { message: 'Ação inválida.' });
    const payer = String(auth.user?.name || '').trim();
    const receiver = String(body.recebedor || '').trim();
    const note = String(body.observacao || '').trim();
    const month = monthToDb(body.month);
    if (!month || !monthRange(body.month)) return json(req, 400, { message: 'Competência inválida.' });
    if (!PEOPLE.has(payer) || !PEOPLE.has(receiver) || payer === receiver) return json(req, 400, { message: 'Pagador ou recebedor inválido.' });
    if (!METHODS.has(body.formaPagamento)) return json(req, 400, { message: 'Forma de pagamento inválida.' });
    if (!validAmount(body.valor)) return json(req, 400, { message: 'Informe um valor positivo, com até duas casas decimais.' });
    if (!validDate(body.dataPagamento)) return json(req, 400, { message: 'Data do pagamento inválida.' });
    if (note.length > 240) return json(req, 400, { message: 'A observação deve ter no máximo 240 caracteres.' });
    if (typeof body.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(body.idempotencyKey)) return json(req, 400, { message: 'Reabra o formulário para identificar este pagamento.' });
    const response = await dataApi('/rpc/record_settlement', {
      method: 'POST', body: JSON.stringify({
        p_competencia: month + '-01', p_data_pagamento: body.dataPagamento,
        p_recebedor: receiver, p_forma_pagamento: body.formaPagamento,
        p_valor: body.valor, p_observacao: note, p_request_key: body.idempotencyKey
      })
    }, auth.jwt);
    if (!response.ok) {
      const conflict = response.status === 409;
      const problem = await response.json().catch(() => null);
      let details;
      try {
        const parsed = JSON.parse(problem?.details || 'null');
        if (validAmount(parsed?.remaining) || parsed?.remaining === 0) details = { remaining: Number(parsed.remaining) };
      } catch { /* Missing structured detail must not hide the original conflict. */ }

      return json(req, conflict ? 409 : response.status === 401 || response.status === 403 ? response.status : 503, {
        message: conflict ? 'Saldo ou pagamento atualizado. Confira os acertos antes de tentar novamente.' : 'Não foi possível confirmar o pagamento seguro. Tente novamente com os mesmos dados.',
        ...(conflict && details ? { details } : {})
      });
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.id) return json(req, 502, { message: 'Pagamento sem confirmação válida. Tente novamente com os mesmos dados.' });
    return json(req, 200, { ok: true, data: rows, token: auth.token });
  };
}
