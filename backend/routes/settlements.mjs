import { calculateSettlement, HOUSEHOLD } from '../settlements/calculator.mjs';

const METHODS = new Set(['Dinheiro', 'Vale']);
const PEOPLE = new Set(Object.values(HOUSEHOLD));

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

async function parseRows(response, context) {
  const text = await response.text();
  if (!response.ok) {
    console.error(`[settlements:${context}] status=${response.status} body=${text.slice(0, 300)}`);
    const error = new Error('Falha ao acessar os acertos.');
    error.status = response.status;
    throw error;
  }
  return JSON.parse(text || '[]');
}

export function createSettlementsRouter({ requireAuth, readJson, json, dataApi, monthRange, monthToDb }) {
  async function monthData(month, jwt) {
    const range = monthRange(month);
    const dbMonth = monthToDb(month);
    if (!range || !dbMonth) return null;

    const [expenseResponse, settlementResponse] = await Promise.all([
      dataApi(`/gastos?select=usuario,valor,forma_pagamento&data=gte.${range.start}&data=lt.${range.end}`, { method: 'GET' }, jwt),
      dataApi(`/acertos?select=id,competencia,data_pagamento,pagador,recebedor,forma_pagamento,valor,observacao,created_at&competencia=eq.${dbMonth}-01&order=data_pagamento.desc,created_at.desc`, { method: 'GET' }, jwt)
    ]);

    return {
      expenses: await parseRows(expenseResponse, 'expenses'),
      settlements: await parseRows(settlementResponse, 'list'),
      dbMonth
    };
  }

  return async function handleSettlementsRoute(req, url) {
    if (url.pathname !== '/settlements') return null;

    if (req.method === 'GET') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const data = await monthData(url.searchParams.get('month'), auth.jwt);
      if (!data) return json(req, 400, { message: 'Competência inválida.' });
      return json(req, 200, { settlements: data.settlements, token: auth.token });
    }

    if (req.method === 'POST') {
      const { auth, error } = await requireAuth(req, true);
      if (error) return error;
      const body = await readJson(req);

      if (body.action === 'delete') {
        if (!body.id) return json(req, 400, { message: 'Acerto inválido.' });
        const response = await dataApi(`/acertos?id=eq.${encodeURIComponent(body.id)}`, {
          method: 'DELETE', headers: { Prefer: 'return=representation' }
        }, auth.jwt);
        const rows = await parseRows(response, 'delete');
        if (!rows.length) return json(req, 404, { message: 'Acerto não encontrado.' });
        return json(req, 200, { ok: true, data: rows, token: auth.token });
      }

      if (body.action !== 'add') return json(req, 400, { message: 'Ação inválida.' });

      const payer = String(auth.user?.name || '').trim();
      const receiver = String(body.recebedor || '').trim();
      const method = String(body.formaPagamento || '');
      const value = Number(body.valor);
      const note = String(body.observacao || '').trim();
      const data = await monthData(body.month, auth.jwt);

      if (!data) return json(req, 400, { message: 'Competência inválida.' });
      if (!PEOPLE.has(payer) || !PEOPLE.has(receiver) || payer === receiver) {
        return json(req, 400, { message: 'Pagador ou recebedor inválido.' });
      }
      if (!METHODS.has(method)) return json(req, 400, { message: 'Forma de pagamento inválida.' });
      if (!Number.isFinite(value) || value <= 0) return json(req, 400, { message: 'Informe um valor maior que zero.' });
      if (!validDate(body.dataPagamento)) return json(req, 400, { message: 'Data do pagamento inválida.' });
      if (note.length > 240) return json(req, 400, { message: 'A observação deve ter no máximo 240 caracteres.' });

      const balance = calculateSettlement(data.expenses, data.settlements, method);
      if (balance.isSettled) return json(req, 409, { message: `${method} já está quitado nesta competência.` });
      if (balance.debtor !== payer || balance.creditor !== receiver) {
        return json(req, 409, { message: 'O acerto deve ser registrado pelo devedor atual para o credor atual.' });
      }
      if (value - balance.remaining > 0.005) {
        return json(req, 409, {
          message: 'O valor supera o saldo restante.',
          details: { remaining: balance.remaining }
        });
      }

      const row = {
        competencia: `${data.dbMonth}-01`,
        data_pagamento: body.dataPagamento,
        pagador: payer,
        recebedor: receiver,
        forma_pagamento: method,
        valor: Math.round(value * 100) / 100,
        observacao: note || null
      };
      const response = await dataApi('/acertos', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row)
      }, auth.jwt);
      const rows = await parseRows(response, 'add');
      return json(req, 200, { ok: true, data: rows, token: auth.token });
    }

    return null;
  };
}
