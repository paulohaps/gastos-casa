const ALLOWED_CATEGORIES = ['Mercado', 'Contas', 'Aluguel', 'Ifood', 'Outros'];
const ALLOWED_PAYMENTS = ['Dinheiro', 'Vale'];
const STOPWORDS = new Set([
  'eu','de','do','da','dos','das','no','na','nos','nas','um','uma','uns','umas','e','em','com','para','por',
  'hoje','ontem','anteontem','amanha','amanhã','passado','passada','agora','meu','minha','o','a','os','as',
  'paguei','gastei','pago','pagar','deu','ficou','custou','foi','valor','reais','real','r$','rs'
]);

const CATEGORY_RULES = [
  { category: 'Aluguel', terms: ['aluguel','condominio','condomínio'] },
  { category: 'Ifood', terms: ['ifood','i food','delivery','lanche','delivery'] },
  { category: 'Contas', terms: ['internet','energia','luz','agua','água','telefone','celular','gas','gás','conta'] },
  { category: 'Mercado', terms: ['mercado','supermercado','atacadao','atacadão','assai','assaí','feira','hortifruti'] }
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.,/\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function moneyToNumber(raw) {
  if (raw == null) return null;
  let value = String(raw).trim().replace(/\s/g, '');
  if (value.includes(',') && value.includes('.')) {
    if (value.lastIndexOf(',') > value.lastIndexOf('.')) value = value.replace(/\./g, '').replace(',', '.');
    else value = value.replace(/,/g, '');
  } else if (value.includes(',')) {
    value = value.replace(',', '.');
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseLocalDate(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!m) return new Date();
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + amount);
  return d;
}

function parseDate(text, todayKey) {
  const normalized = normalizeText(text);
  const today = parseLocalDate(todayKey);

  if (/\banteontem\b/.test(normalized)) {
    return { value: formatDateKey(addDays(today, -2)), confidence: 0.99, source: 'relative' };
  }
  if (/\bontem\b/.test(normalized)) {
    return { value: formatDateKey(addDays(today, -1)), confidence: 0.99, source: 'relative' };
  }
  if (/\bhoje\b/.test(normalized)) {
    return { value: formatDateKey(today), confidence: 0.99, source: 'relative' };
  }

  const explicit = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (explicit) {
    const dd = Number(explicit[1]);
    const mm = Number(explicit[2]);
    let yyyy = explicit[3] ? Number(explicit[3]) : today.getUTCFullYear();
    if (yyyy < 100) yyyy += 2000;
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12));
    if (d.getUTCDate() === dd && d.getUTCMonth() === mm - 1) {
      return { value: formatDateKey(d), confidence: 0.99, source: 'explicit' };
    }
  }

  const dayOnly = normalized.match(/\bdia\s+(\d{1,2})\b/);
  if (dayOnly) {
    const dd = Number(dayOnly[1]);
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), dd, 12));
    if (d.getUTCDate() === dd) return { value: formatDateKey(d), confidence: 0.88, source: 'day-of-month' };
  }

  return { value: formatDateKey(today), confidence: 0.72, source: 'default-today' };
}

function extractNumericCandidates(text) {
  const normalized = normalizeText(text)
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\bdia\s+\d{1,2}\b/g, ' ');

  const values = [];
  const seen = new Set();
  const add = (raw, priority = 0) => {
    const value = moneyToNumber(raw);
    if (!value) return;
    const key = value.toFixed(2);
    if (seen.has(key)) return;
    seen.add(key);
    values.push({ value, raw, priority });
  };

  for (const m of normalized.matchAll(/r\$\s*(\d{1,7}(?:[.,]\d{1,2})?)/g)) add(m[1], 3);
  for (const m of normalized.matchAll(/(?:paguei|gastei|deu|ficou|custou|valor(?:\s+de)?|foi)\s*(?:r\$\s*)?(\d{1,7}(?:[.,]\d{1,2})?)/g)) add(m[1], 2);
  for (const m of normalized.matchAll(/\b(\d{1,7}(?:[.,]\d{1,2})?)\b/g)) add(m[1], /[.,]/.test(m[1]) ? 1 : 0);

  return values.sort((a,b) => b.priority - a.priority);
}

function parseValue(text) {
  const values = extractNumericCandidates(text);
  if (!values.length) return { value: null, confidence: 0, ambiguous: false };
  const topPriority = values[0].priority;
  const top = values.filter(item => item.priority === topPriority);

  if (top.length > 1) return { value: null, confidence: 0.3, ambiguous: true, candidates: top.map(x => x.value) };
  if (values.length > 1 && topPriority === 0) {
    return { value: null, confidence: 0.35, ambiguous: true, candidates: values.map(x => x.value) };
  }

  return { value: values[0].value, confidence: topPriority >= 2 ? 0.99 : 0.92, ambiguous: false };
}

function parsePayment(text) {
  const normalized = normalizeText(text);
  if (/\b(vale|vale alimentacao|vale refeicao|vr|va)\b/.test(normalized)) {
    return { value: 'Vale', confidence: 0.99, source: 'rules' };
  }
  if (/\b(pix|cartao|cartao de credito|cartao de debito|credito|debito|dinheiro|especie)\b/.test(normalized)) {
    return { value: 'Dinheiro', confidence: 0.97, source: 'rules' };
  }
  return { value: 'Dinheiro', confidence: 0.55, source: 'default' };
}

function classifyByRules(text) {
  const normalized = normalizeText(text);
  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some(term => normalized.includes(normalizeText(term)))) {
      return { value: rule.category, confidence: 0.97, source: 'rules' };
    }
  }
  return { value: 'Outros', confidence: 0.45, source: 'fallback' };
}

function significantTokens(value) {
  return normalizeText(value)
    .split(' ')
    .filter(token => token.length >= 3 && !STOPWORDS.has(token) && !/^\d/.test(token));
}

function classifyByHistory(text, history) {
  const inputTokens = significantTokens(text);
  if (!inputTokens.length || !Array.isArray(history) || !history.length) return null;

  const scores = new Map();
  let exact = null;

  for (const row of history) {
    if (!ALLOWED_CATEGORIES.includes(row?.categoria)) continue;
    const desc = normalizeText(row?.descricao);
    if (!desc) continue;
    const descTokens = significantTokens(desc);
    if (!descTokens.length) continue;

    const overlap = inputTokens.filter(token => descTokens.includes(token));
    if (!overlap.length) continue;

    const containsExact = normalizeText(text).includes(desc) || desc.includes(normalizeText(text));
    const score = containsExact ? 4 : overlap.length / Math.max(inputTokens.length, descTokens.length);
    if (containsExact) exact = { value: row.categoria, confidence: 0.96, source: 'history-exact' };
    scores.set(row.categoria, (scores.get(row.categoria) || 0) + score);
  }

  if (exact) return exact;
  const ranked = [...scores.entries()].sort((a,b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [category, score] = ranked[0];
  const second = ranked[1]?.[1] || 0;
  if (score >= 1.4 && score >= second * 1.35) {
    return { value: category, confidence: Math.min(0.92, 0.72 + score * 0.07), source: 'history' };
  }
  return null;
}

function deriveDescription(text, category) {
  let clean = String(text || '').trim();
  clean = clean
    .replace(/r\$\s*\d{1,7}(?:[.,]\d{1,2})?/gi, ' ')
    .replace(/\b\d{1,7}(?:[.,]\d{1,2})?\s*(?:reais|real)?\b/gi, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\bdia\s+\d{1,2}\b/gi, ' ')
    .replace(/\b(paguei|gastei|deu|ficou|custou|foi|hoje|ontem|anteontem|no pix|pix|no cart[aã]o|cart[aã]o|cr[eé]dito|d[eé]bito|dinheiro|em esp[eé]cie|no vale|vale alimenta[cç][aã]o|vale refei[cç][aã]o|vale)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(no|na|em|de|do|da)\s+/i, '');

  clean = clean.replace(/\s+(no|na|em|de|do|da)$/i, '').trim();
  if (!clean || clean.length < 2) return category === 'Ifood' ? 'iFood' : category;
  return titleCase(clean.slice(0, 120));
}

function detectUnsupportedIntent(text) {
  const n = normalizeText(text);
  if (!n) return 'Texto vazio.';
  const blockers = [
    /\b(me lembra|lembrete|lembrar|agendar)\b/,
    /\b(cancelar|apagar|excluir|remover)\b/,
    /\b(quanto|qual|quais|listar|mostra|mostrar)\b.*\b(gastei|gasto|gastos|despesa|despesas)\b/,
    /\b(nao gastei|nao paguei|não gastei|não paguei)\b/
  ];
  if (blockers.some(re => re.test(n))) return 'A frase parece ser um comando ou consulta, não um novo gasto.';
  if (/[?]$/.test(String(text).trim())) return 'A frase parece ser uma pergunta, não um novo gasto.';
  return null;
}

export function parseSmartEntry(text, options = {}) {
  const raw = String(text || '').trim().slice(0, 500);
  const todayKey = options.todayKey || formatDateKey(new Date());
  const history = Array.isArray(options.history) ? options.history : [];
  const warnings = [];

  const unsupported = detectUnsupportedIntent(raw);
  if (unsupported) {
    return {
      intent: 'unsupported',
      parserVersion: 'rules-history-v1',
      draft: null,
      confidence: {},
      needsReview: true,
      warnings: [{ code: 'UNSUPPORTED_INTENT', field: null, message: unsupported }],
      source: { parser: 'rules-history-v1' }
    };
  }

  const value = parseValue(raw);
  const date = parseDate(raw, todayKey);
  const payment = parsePayment(raw);
  let category = classifyByRules(raw);
  if (category.confidence < 0.9) {
    const historyCategory = classifyByHistory(raw, history);
    if (historyCategory) category = historyCategory;
  }
  const description = deriveDescription(raw, category.value);
  const descriptionConfidence = description ? (description === category.value || (category.value === 'Ifood' && description === 'iFood') ? 0.78 : 0.9) : 0;

  if (!value.value) {
    warnings.push({
      code: value.ambiguous ? 'MULTIPLE_VALUES' : 'VALUE_MISSING',
      field: 'valor',
      message: value.ambiguous
        ? 'Encontrei mais de um valor possível. Confirme o valor antes de lançar.'
        : 'Não consegui identificar o valor do gasto.'
    });
  }
  if (date.confidence < 0.8) {
    warnings.push({ code: 'DATE_DEFAULTED', field: 'data', message: 'A data não foi informada; considerei hoje.' });
  }
  if (payment.confidence < 0.7) {
    warnings.push({ code: 'PAYMENT_DEFAULTED', field: 'formaPagamento', message: 'A forma de pagamento não foi informada; considerei Dinheiro/PIX/Cartão.' });
  }
  if (category.confidence < 0.7) {
    warnings.push({ code: 'CATEGORY_LOW_CONFIDENCE', field: 'categoria', message: 'Não identifiquei a categoria com segurança. Revise antes de confirmar.' });
  }

  const draft = {
    valor: value.value,
    descricao: description,
    categoria: category.value,
    formaPagamento: payment.value,
    data: date.value
  };

  const confidence = {
    valor: value.confidence,
    descricao: descriptionConfidence,
    categoria: category.confidence,
    formaPagamento: payment.confidence,
    data: date.confidence
  };

  const needsReview = Object.entries(confidence).some(([key, score]) => {
    if (key === 'categoria' || key === 'valor') return score < 0.7;
    return score < 0.55;
  }) || !draft.valor || warnings.some(w => ['MULTIPLE_VALUES','VALUE_MISSING'].includes(w.code));

  return {
    intent: 'expense',
    parserVersion: 'rules-history-v1',
    draft,
    confidence,
    needsReview,
    warnings,
    source: {
      parser: 'rules-history-v1',
      categoria: category.source,
      pagamento: payment.source,
      data: date.source
    }
  };
}

export const SMART_ENTRY_ALLOWED_CATEGORIES = ALLOWED_CATEGORIES;
export const SMART_ENTRY_ALLOWED_PAYMENTS = ALLOWED_PAYMENTS;
