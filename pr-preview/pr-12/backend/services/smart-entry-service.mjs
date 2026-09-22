import {
  parseSmartEntry,
  normalizeLearningTerm,
  SMART_ENTRY_ALLOWED_CATEGORIES,
  SMART_ENTRY_ALLOWED_PAYMENTS
} from '../smart-entry/parser.mjs';
import { enhanceSmartEntryWithAi, isSmartEntryAiConfigured } from '../smart-entry/ai-provider.mjs';
import { summarizeSmartTelemetry } from '../smart-entry/metrics.mjs';

export function createSmartEntryService(options) {
  const ctx = {
    enabled: options.enabled !== false,
    timezone: options.timezone || 'America/Porto_Velho',
    dataApi: options.dataApi
  };

function smartEntryTodayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ctx.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function fetchSmartEntryRules(jwt, includeInactive = false) {
  try {
    let path = '/smart_entry_rules?select=id,termo_normalizado,categoria,confirmacoes,manual,ativo,created_at,updated_at,last_confirmed_at&order=manual.desc,confirmacoes.desc,termo_normalizado.asc';
    if (!includeInactive) path += '&ativo=eq.true';
    const res = await ctx.dataApi(path, { method: 'GET' }, jwt);
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[smart-rules:get] status=${res.status} body=${body.slice(0,300)}`);
      return [];
    }
    const text = await res.text();
    return JSON.parse(text || '[]');
  } catch (err) {
    console.warn('[smart-rules:get] failed', err?.message || err);
    return [];
  }
}

function isGenericLearningTerm(term) {
  return ['mercado','contas','aluguel','ifood','outros','delivery','internet'].includes(String(term || ''));
}

async function recordSmartEntryLearning(jwt, feedback, confirmedRow) {
  if (!ctx.enabled || feedback?.used !== true) return null;
  const category = confirmedRow?.categoria;
  const term = normalizeLearningTerm(confirmedRow?.descricao);
  if (!SMART_ENTRY_ALLOWED_CATEGORIES.includes(category) || !term || term.length < 3 || isGenericLearningTerm(term)) return null;

  const existingRes = await ctx.dataApi(
    `/smart_entry_rules?select=id,confirmacoes,manual,ativo&termo_normalizado=eq.${encodeURIComponent(term)}&categoria=eq.${encodeURIComponent(category)}&limit=1`,
    { method: 'GET' },
    jwt
  );
  if (!existingRes.ok) {
    const body = await existingRes.text();
    throw new Error(`learning lookup failed: ${existingRes.status} ${body.slice(0,160)}`);
  }
  const existing = JSON.parse(await existingRes.text() || '[]')[0] || null;
  const now = new Date().toISOString();

  if (existing) {
    const next = Math.max(0, Number(existing.confirmacoes) || 0) + 1;
    const res = await ctx.dataApi(
      `/smart_entry_rules?id=eq.${encodeURIComponent(existing.id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ confirmacoes: next, ativo: true, updated_at: now, last_confirmed_at: now })
      },
      jwt
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`learning update failed: ${res.status} ${text.slice(0,160)}`);
    return { learned: true, term, category, confirmations: next, corrected: feedback.suggestedCategory && feedback.suggestedCategory !== category };
  }

  const res = await ctx.dataApi(
    '/smart_entry_rules',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        termo_normalizado: term,
        categoria: category,
        confirmacoes: 1,
        manual: false,
        ativo: true,
        updated_at: now,
        last_confirmed_at: now
      })
    },
    jwt
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`learning insert failed: ${res.status} ${text.slice(0,160)}`);
  return { learned: true, term, category, confirmations: 1, corrected: feedback.suggestedCategory && feedback.suggestedCategory !== category };
}

async function setManualSmartRule(jwt, termInput, category) {
  const term = normalizeLearningTerm(termInput);
  if (!term || term.length < 2) throw new Error('Termo inválido.');
  if (!SMART_ENTRY_ALLOWED_CATEGORIES.includes(category)) throw new Error('Categoria inválida.');
  const now = new Date().toISOString();

  const manualRes = await ctx.dataApi(
    `/smart_entry_rules?termo_normalizado=eq.${encodeURIComponent(term)}&manual=eq.true`,
    { method: 'PATCH', body: JSON.stringify({ manual: false, updated_at: now }) },
    jwt
  );
  if (!manualRes.ok) {
    const body = await manualRes.text();
    throw new Error(`manual reset failed: ${manualRes.status} ${body.slice(0,160)}`);
  }

  const existingRes = await ctx.dataApi(
    `/smart_entry_rules?select=id,confirmacoes&termo_normalizado=eq.${encodeURIComponent(term)}&categoria=eq.${encodeURIComponent(category)}&limit=1`,
    { method: 'GET' },
    jwt
  );
  if (!existingRes.ok) {
    const body = await existingRes.text();
    throw new Error(`manual lookup failed: ${existingRes.status} ${body.slice(0,160)}`);
  }
  const existing = JSON.parse(await existingRes.text() || '[]')[0] || null;

  if (existing) {
    const res = await ctx.dataApi(
      `/smart_entry_rules?id=eq.${encodeURIComponent(existing.id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ manual: true, ativo: true, updated_at: now })
      },
      jwt
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`manual update failed: ${res.status} ${text.slice(0,160)}`);
    return JSON.parse(text || '[]')[0] || null;
  }

  const res = await ctx.dataApi(
    '/smart_entry_rules',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ termo_normalizado: term, categoria: category, confirmacoes: 0, manual: true, ativo: true, updated_at: now, last_confirmed_at: now })
    },
    jwt
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`manual insert failed: ${res.status} ${text.slice(0,160)}`);
  return JSON.parse(text || '[]')[0] || null;
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));
}

function normalizeComparison(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function createSmartEntryTelemetry(jwt, result) {
  try {
    const row = {
      intent: result?.intent === 'unsupported' ? 'unsupported' : 'expense',
      parser_version: String(result?.parserVersion || 'unknown').slice(0, 80),
      needs_review: result?.needsReview !== false,
      warnings_count: Array.isArray(result?.warnings) ? result.warnings.length : 0,
      category_source: result?.source?.categoria ? String(result.source.categoria).slice(0, 80) : null,
      category_confidence: clampConfidence(result?.confidence?.categoria),
      value_confidence: clampConfidence(result?.confidence?.valor),
      description_confidence: clampConfidence(result?.confidence?.descricao),
      payment_confidence: clampConfidence(result?.confidence?.formaPagamento),
      date_confidence: clampConfidence(result?.confidence?.data)
    };
    const res = await ctx.dataApi('/smart_entry_telemetry', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row)
    }, jwt);
    const text = await res.text();
    if (!res.ok) {
      console.warn(`[smart-telemetry:create] status=${res.status} body=${text.slice(0,240)}`);
      return null;
    }
    return JSON.parse(text || '[]')[0]?.id || null;
  } catch (err) {
    console.warn('[smart-telemetry:create] failed', err?.message || err);
    return null;
  }
}

async function completeSmartEntryTelemetry(jwt, telemetryId, feedback, confirmedRow, learning) {
  if (!telemetryId || feedback?.used !== true || !confirmedRow) return null;
  try {
    const read = await ctx.dataApi(
      `/smart_entry_telemetry?select=id,created_at,confirmed&id=eq.${encodeURIComponent(telemetryId)}&limit=1`,
      { method: 'GET' },
      jwt
    );
    if (!read.ok) {
      const body = await read.text();
      throw new Error(`telemetry lookup failed: ${read.status} ${body.slice(0,160)}`);
    }
    const event = JSON.parse(await read.text() || '[]')[0];
    if (!event || event.confirmed === true) return null;

    const now = new Date();
    const created = new Date(event.created_at);
    const confirmationMs = Number.isNaN(created.getTime()) ? null : Math.max(0, now.getTime() - created.getTime());
    const suggestedValue = Number(feedback.suggestedValue);
    const finalValue = Number(confirmedRow.valor);

    const patch = {
      confirmed: true,
      confirmed_at: now.toISOString(),
      confirmation_ms: confirmationMs,
      corrected_value: Number.isFinite(suggestedValue) && Number.isFinite(finalValue)
        ? Math.abs(suggestedValue - finalValue) >= 0.005
        : true,
      corrected_description: normalizeComparison(feedback.suggestedDescription) !== normalizeComparison(confirmedRow.descricao),
      corrected_category: String(feedback.suggestedCategory || '') !== String(confirmedRow.categoria || ''),
      corrected_payment: String(feedback.suggestedPayment || '') !== String(confirmedRow.forma_pagamento || ''),
      corrected_date: String(feedback.suggestedDate || '') !== String(confirmedRow.data || ''),
      learning_recorded: learning?.learned === true
    };

    const res = await ctx.dataApi(
      `/smart_entry_telemetry?id=eq.${encodeURIComponent(telemetryId)}`,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) },
      jwt
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`telemetry update failed: ${res.status} ${text.slice(0,160)}`);
    return JSON.parse(text || '[]')[0] || null;
  } catch (err) {
    console.warn('[smart-telemetry:complete] skipped:', err?.message || err);
    return null;
  }
}

async function buildSmartEntryMetrics(jwt, days) {
  const safeDays = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const since = new Date(Date.now() - safeDays * 86400000).toISOString();
  const select = [
    'intent','needs_review','warnings_count','category_source',
    'confirmed','confirmation_ms','corrected_value','corrected_description',
    'corrected_category','corrected_payment','corrected_date','learning_recorded','created_at'
  ].join(',');
  const res = await ctx.dataApi(
    `/smart_entry_telemetry?select=${select}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=5000`,
    { method: 'GET' },
    jwt
  );
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Erro ao carregar telemetria.');
  return summarizeSmartTelemetry(JSON.parse(text || '[]'), safeDays);
}

async function fetchSmartEntryHistory(jwt) {
  try {
    const res = await ctx.dataApi('/gastos?select=descricao,categoria&order=data.desc,created_at.desc&limit=120', { method: 'GET' }, jwt);
    if (!res.ok) return [];
    const text = await res.text();
    return JSON.parse(text || '[]');
  } catch {
    return [];
  }
}

function validateSmartEntryResult(result) {
  if (!result || result.intent !== 'expense' || !result.draft) return result;
  const draft = result.draft;
  if (draft.categoria && !SMART_ENTRY_ALLOWED_CATEGORIES.includes(draft.categoria)) draft.categoria = 'Outros';
  if (draft.formaPagamento && !SMART_ENTRY_ALLOWED_PAYMENTS.includes(draft.formaPagamento)) draft.formaPagamento = 'Dinheiro';
  if (draft.descricao) draft.descricao = String(draft.descricao).trim().slice(0, 120);
  if (draft.valor != null) {
    const value = Number(draft.valor);
    draft.valor = Number.isFinite(value) && value > 0 ? value : null;
  }
  return result;
}



  return {
    isEnabled: () => ctx.enabled,
    isAiConfigured: isSmartEntryAiConfigured,
    todayKey: smartEntryTodayKey,
    fetchRules: fetchSmartEntryRules,
    fetchHistory: fetchSmartEntryHistory,
    parse: async (text, jwt, inputMode = 'text') => {
      const [history, learnedRules] = await Promise.all([
        fetchSmartEntryHistory(jwt),
        fetchSmartEntryRules(jwt)
      ]);
      let result = parseSmartEntry(text, { todayKey: smartEntryTodayKey(), history, learnedRules, inputMode });
      result = await enhanceSmartEntryWithAi(result, { text, history, inputMode });
      result = validateSmartEntryResult(result);
      const telemetryId = await createSmartEntryTelemetry(jwt, result);
      return { ...result, telemetryId };
    },
    metrics: buildSmartEntryMetrics,
    setManualRule: setManualSmartRule,
    normalizeLearningTerm,
    recordLearning: recordSmartEntryLearning,
    completeTelemetry: completeSmartEntryTelemetry
  };
}
