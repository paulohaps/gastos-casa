const ALLOWED_CATEGORIES = ['Mercado', 'Contas', 'Aluguel', 'Ifood', 'Outros'];
const ALLOWED_PAYMENTS = ['Dinheiro', 'Vale'];
const STOPWORDS = new Set([
  'eu','de','do','da','dos','das','no','na','nos','nas','um','uma','uns','umas','e','em','com','para','por',
  'hoje','ontem','anteontem','amanha','amanhã','passado','passada','agora','meu','minha','o','a','os','as',
  'paguei','gastei','comprei','pago','pagar','comprar','deu','ficou','custou','foi','valor','reais','real','r

const CATEGORY_RULES = [
  { category: 'Aluguel', terms: ['aluguel','condominio','condomínio'] },
  { category: 'Ifood', terms: ['ifood','i food','delivery','lanche','delivery'] },
  { category: 'Contas', terms: ['internet','energia','luz','agua','água','telefone','celular','gas','gás','conta'] },
  { category: 'Mercado', terms: ['mercado','supermercado','atacadao','atacadão','assai','assaí','feira','hortifruti'] },
  { category: 'Outros', terms: ['combustivel','combustível','gasolina','etanol','diesel','posto','farmacia','farmácia','remedio','remédio','medicamento','restaurante','almoco','almoço','jantar','refeicao','refeição','uber','taxi','táxi','estacionamento','academia','veterinario','veterinário','racao','ração'] }
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.,/$\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value) {
  const s = String(value || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const small = new Set(['de','da','do','das','dos','e']);
  const brands = new Map([
    ['ifood','iFood'], ['assai','Assaí'], ['atacadao','Atacadão'],
    ['uber','Uber'], ['pix','PIX']
  ]);
  return s.split(' ').map((word, index) => {
    const normalized = normalizeText(word);
    if (brands.has(normalized)) return brands.get(normalized);
    if (index > 0 && small.has(normalized)) return normalized;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
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

  const spokenDecimal = normalized.match(/\b(\d{1,7})\s+e\s+(\d{1,2})\s*(?:centavos?)?\b/);
  if (spokenDecimal) {
    const whole = Number(spokenDecimal[1]);
    const cents = Number(spokenDecimal[2]);
    if (Number.isFinite(whole) && Number.isFinite(cents) && cents >= 0 && cents < 100) {
      values.push({ value: whole + cents / 100, raw: spokenDecimal[0], priority: 4 });
      seen.add((whole + cents / 100).toFixed(2));
    }
  }
  const add = (raw, priority = 0) => {
    const value = moneyToNumber(raw);
    if (!value) return;
    const key = value.toFixed(2);
    if (seen.has(key)) return;
    seen.add(key);
    values.push({ value, raw, priority });
  };

  for (const m of normalized.matchAll(/r\$\s*(\d{1,7}(?:[.,]\d{1,2})?)/g)) add(m[1], 3);
  for (const m of normalized.matchAll(/(?:paguei|gastei|comprei|deu|ficou|custou|valor(?:\s+de)?|foi)\s*(?:r\$\s*)?(\d{1,7}(?:[.,]\d{1,2})?)/g)) add(m[1], 2);
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

export function normalizeLearningTerm(value) {
  const tokens = significantTokens(value);
  return tokens.join(' ').slice(0, 120);
}

function ruleMatchesInput(normalizedInput, ruleTerm) {
  const normalizedRule = normalizeLearningTerm(ruleTerm);
  if (!normalizedRule) return false;
  if (normalizedInput.includes(normalizedRule)) return true;
  const inputTokens = new Set(significantTokens(normalizedInput));
  const ruleTokens = significantTokens(normalizedRule);
  return ruleTokens.length > 0 && ruleTokens.every(token => inputTokens.has(token));
}

function classifyByLearnedRules(text, learnedRules) {
  if (!Array.isArray(learnedRules) || !learnedRules.length) return null;
  const normalizedInput = normalizeText(text);
  const matching = learnedRules.filter(rule =>
    rule?.ativo !== false &&
    ALLOWED_CATEGORIES.includes(rule?.categoria) &&
    ruleMatchesInput(normalizedInput, rule?.termo_normalizado)
  );
  if (!matching.length) return null;

  const manual = matching
    .filter(rule => rule.manual === true)
    .sort((a,b) => String(b.termo_normalizado || '').length - String(a.termo_normalizado || '').length)[0];
  if (manual) {
    return {
      value: manual.categoria,
      confidence: 0.99,
      source: 'manual-rule',
      term: manual.termo_normalizado
    };
  }

  const byTerm = new Map();
  for (const rule of matching) {
    const term = normalizeLearningTerm(rule.termo_normalizado);
    if (!term) continue;
    if (!byTerm.has(term)) byTerm.set(term, []);
    byTerm.get(term).push(rule);
  }

  const candidates = [];
  for (const [term, rows] of byTerm.entries()) {
    const ranked = rows
      .map(row => ({ category: row.categoria, confirmations: Math.max(0, Number(row.confirmacoes) || 0) }))
      .sort((a,b) => b.confirmations - a.confirmations);
    const top = ranked[0];
    if (!top || top.confirmations < 1) continue;
    const second = ranked[1]?.confirmations || 0;
    if (second > 0 && top.confirmations <= second) continue;

    let confidence = top.confirmations >= 3 ? 0.95 : top.confirmations === 2 ? 0.84 : 0.68;
    if (second > 0) {
      const margin = top.confirmations / Math.max(1, top.confirmations + second);
      confidence = Math.min(confidence, 0.68 + margin * 0.25);
    }

    candidates.push({
      value: top.category,
      confidence,
      source: 'learned-rule',
      term,
      confirmations: top.confirmations,
      competingConfirmations: second
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a,b) =>
    b.confidence - a.confidence ||
    b.confirmations - a.confirmations ||
    b.term.length - a.term.length
  );
  return candidates[0];
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

function stripTransactionNoise(text) {
  return String(text || '')
    .replace(/r\$\s*\d{1,7}(?:[.,]\d{1,2})?/gi, ' ')
    .replace(/\b\d{1,7}\s+e\s+\d{1,2}\s*(?:centavos?)?\b/gi, ' ')
    .replace(/\b\d{1,7}(?:[.,]\d{1,2})?\s*(?:reais|real)?\b/gi, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\bdia\s+\d{1,2}\b/gi, ' ')
    .replace(/\b(paguei|gastei|comprei|deu|ficou|custou|foi|valor|hoje|ontem|anteontem|amanh[aã])\b/gi, ' ')
    .replace(/\b(no pix|pelo pix|pix|no cart[aã]o|cart[aã]o de cr[eé]dito|cart[aã]o de d[eé]bito|cart[aã]o|cr[eé]dito|d[eé]bito|dinheiro|em esp[eé]cie|no vale|vale alimenta[cç][aã]o|vale refei[cç][aã]o|vale)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPurpose(text, category) {
  const normalized = normalizeText(text);
  return DESCRIPTION_PURPOSE_RULES.find(rule =>
    rule.category === category &&
    rule.terms.some(term => normalized.includes(normalizeText(term)))
  ) || null;
}

function matchingHistoryDescription(text, category, history) {
  const normalizedInput = normalizeText(text);
  if (!normalizedInput || !Array.isArray(history)) return null;
  const candidates = history
    .filter(row => row?.categoria === category && row?.descricao)
    .map(row => ({ original: String(row.descricao).trim(), normalized: normalizeText(row.descricao) }))
    .filter(row => row.normalized.length >= 3 && normalizedInput.includes(row.normalized))
    .sort((a,b) => b.normalized.length - a.normalized.length);
  return candidates[0]?.original || null;
}

function extractMerchant(text, purpose) {
  let clean = stripTransactionNoise(text);
  clean = clean
    .replace(/\b(?:hoje|ontem|anteontem)\b.*$/i, ' ')
    .replace(/\b(?:no|pelo)\s+(?:pix|cart[aã]o)\b.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const prep = clean.match(/\b(?:no|na|em)\s+(.{2,70})$/i);
  let candidate = prep?.[1]?.trim() || '';

  if (!candidate && purpose) {
    const normalizedClean = normalizeText(clean);
    if (
      (purpose.label === 'Combustível' && normalizedClean.startsWith('posto ')) ||
      (purpose.label === 'Farmácia' && normalizedClean.startsWith('farmacia ')) ||
      (purpose.label === 'Mercado' && /^(assai|atacadao|supermercado)\b/.test(normalizedClean))
    ) {
      candidate = clean;
    }

    const normalizedPurposeTerms = purpose.terms.map(normalizeText);
    const tokens = clean.split(/\s+/).filter(Boolean);
    const useful = tokens.filter(token => {
      const n = normalizeText(token);
      return n.length >= 3 &&
        !STOPWORDS.has(n) &&
        !normalizedPurposeTerms.some(term => term.split(' ').includes(n)) &&
        !['no','na','em','de','do','da'].includes(n);
    });
    if (!candidate && useful.length && useful.length <= 4) candidate = useful.join(' ');
  }

  candidate = candidate
    .replace(/^(?:o|a|um|uma)\s+/i, '')
    .replace(/\b(?:hoje|ontem|anteontem|pix|cart[aã]o|dinheiro|vale)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!candidate) return null;
  const normalizedCandidate = normalizeText(candidate);
  const genericTerms = new Set([
    'mercado','supermercado','feira','hortifruti','internet','energia','luz','agua','telefone','celular',
    'gas','aluguel','condominio','ifood','delivery','lanche','combustivel','gasolina','etanol','diesel',
    'posto','farmacia','remedio','medicamento','restaurante','almoco','jantar','refeicao','transporte',
    'estacionamento','pet','racao','academia'
  ]);
  if (genericTerms.has(normalizedCandidate)) return null;
  if (normalizedCandidate.length > 60) return null;
  return titleCase(candidate);
}

function deriveDescription(text, category, history = []) {
  const historyDescription = matchingHistoryDescription(text, category, history);
  if (historyDescription) {
    return { value: historyDescription.slice(0, 120), confidence: 0.98, source: 'history-description' };
  }

  const purpose = findPurpose(text, category);
  const merchant = extractMerchant(text, purpose);

  if (purpose && merchant) {
    const normalizedPurpose = normalizeText(purpose.label);
    const normalizedMerchant = normalizeText(merchant);
    if (normalizedMerchant === normalizedPurpose || normalizedMerchant.startsWith(normalizedPurpose + ' ')) {
      return { value: merchant.slice(0, 120), confidence: 0.94, source: 'template-merchant' };
    }
    return { value: (purpose.label + ' • ' + merchant).slice(0, 120), confidence: 0.94, source: 'template-purpose-merchant' };
  }

  if (purpose) {
    return { value: purpose.label.slice(0, 120), confidence: 0.93, source: 'template-purpose' };
  }

  const fallback = category === 'Ifood' ? 'iFood' : category;
  return { value: fallback, confidence: 0.78, source: 'category-template' };
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
  const learnedRules = Array.isArray(options.learnedRules) ? options.learnedRules : [];
  const warnings = [];

  const unsupported = detectUnsupportedIntent(raw);
  if (unsupported) {
    return {
      intent: 'unsupported',
      parserVersion: 'rules-learning-history-v3',
      draft: null,
      confidence: {},
      needsReview: true,
      warnings: [{ code: 'UNSUPPORTED_INTENT', field: null, message: unsupported }],
      source: { parser: 'rules-learning-history-v3' }
    };
  }

  const value = parseValue(raw);
  const date = parseDate(raw, todayKey);
  const payment = parsePayment(raw);
  const learnedCategory = classifyByLearnedRules(raw, learnedRules);
  let category = learnedCategory || classifyByRules(raw);
  if (!learnedCategory && category.confidence < 0.9) {
    const historyCategory = classifyByHistory(raw, history);
    if (historyCategory && historyCategory.confidence > category.confidence) category = historyCategory;
  }
  const description = deriveDescription(raw, category.value, history);
  const descriptionConfidence = description?.confidence || 0;

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
    descricao: description?.value || (category.value === 'Ifood' ? 'iFood' : category.value),
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

  const needsReview = Object.values(confidence).some(score => score < 0.7) ||
    !draft.valor ||
    warnings.some(w => ['MULTIPLE_VALUES','VALUE_MISSING'].includes(w.code));

  return {
    intent: 'expense',
    parserVersion: 'rules-learning-history-v3',
    draft,
    confidence,
    needsReview,
    warnings,
    source: {
      parser: 'rules-learning-history-v3',
      categoria: category.source,
      categoriaTermo: category.term || null,
      categoriaConfirmacoes: category.confirmations || 0,
      descricao: description?.source || 'category-template',
      pagamento: payment.source,
      data: date.source
    }
  };
}

export const SMART_ENTRY_ALLOWED_CATEGORIES = ALLOWED_CATEGORIES;
export const SMART_ENTRY_ALLOWED_PAYMENTS = ALLOWED_PAYMENTS;
,'rs',
  'semana','mes','mês','mensal','mensalidade','compra','compras','despesa','despesas','gasto','gastos','coisa','coisas',
  'janeiro','fevereiro','marco','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro',
  'almoco','almoço','jantar','lanche','refeicao','refeição'
]);

const DESCRIPTION_PURPOSE_RULES = [
  { category: 'Mercado', label: 'Mercado', terms: ['mercado','supermercado'] },
  { category: 'Mercado', label: 'Mercado', terms: ['atacadao','atacadão','assai','assaí'] },
  { category: 'Mercado', label: 'Feira', terms: ['feira','hortifruti'] },
  { category: 'Contas', label: 'Internet', terms: ['internet','banda larga','wifi'] },
  { category: 'Contas', label: 'Energia elétrica', terms: ['energia','luz','energia eletrica','energia elétrica'] },
  { category: 'Contas', label: 'Água', terms: ['agua','água'] },
  { category: 'Contas', label: 'Telefone', terms: ['telefone','celular'] },
  { category: 'Contas', label: 'Gás', terms: ['gas','gás'] },
  { category: 'Aluguel', label: 'Condomínio', terms: ['condominio','condomínio'] },
  { category: 'Aluguel', label: 'Aluguel', terms: ['aluguel'] },
  { category: 'Ifood', label: 'iFood', terms: ['ifood','i food'] },
  { category: 'Ifood', label: 'Delivery', terms: ['delivery'] },
  { category: 'Ifood', label: 'Lanche', terms: ['lanche'] },
  { category: 'Outros', label: 'Combustível', terms: ['combustivel','combustível','gasolina','etanol','diesel','posto'] },
  { category: 'Outros', label: 'Farmácia', terms: ['farmacia','farmácia','remedio','remédio','medicamento'] },
  { category: 'Outros', label: 'Alimentação', terms: ['restaurante','almoco','almoço','jantar','refeicao','refeição'] },
  { category: 'Outros', label: 'Transporte', terms: ['uber','taxi','táxi','corrida','99'] },
  { category: 'Outros', label: 'Estacionamento', terms: ['estacionamento'] },
  { category: 'Outros', label: 'Pet', terms: ['pet','racao','ração','veterinario','veterinário'] },
  { category: 'Outros', label: 'Academia', terms: ['academia'] }
];

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
    .replace(/[^a-z0-9.,/$\s-]/g, ' ')
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

  const spokenDecimal = normalized.match(/\b(\d{1,7})\s+e\s+(\d{1,2})\s*(?:centavos?)?\b/);
  if (spokenDecimal) {
    const whole = Number(spokenDecimal[1]);
    const cents = Number(spokenDecimal[2]);
    if (Number.isFinite(whole) && Number.isFinite(cents) && cents >= 0 && cents < 100) {
      values.push({ value: whole + cents / 100, raw: spokenDecimal[0], priority: 4 });
      seen.add((whole + cents / 100).toFixed(2));
    }
  }
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

export function normalizeLearningTerm(value) {
  const tokens = significantTokens(value);
  return tokens.join(' ').slice(0, 120);
}

function ruleMatchesInput(normalizedInput, ruleTerm) {
  const normalizedRule = normalizeLearningTerm(ruleTerm);
  if (!normalizedRule) return false;
  if (normalizedInput.includes(normalizedRule)) return true;
  const inputTokens = new Set(significantTokens(normalizedInput));
  const ruleTokens = significantTokens(normalizedRule);
  return ruleTokens.length > 0 && ruleTokens.every(token => inputTokens.has(token));
}

function classifyByLearnedRules(text, learnedRules) {
  if (!Array.isArray(learnedRules) || !learnedRules.length) return null;
  const normalizedInput = normalizeText(text);
  const matching = learnedRules.filter(rule =>
    rule?.ativo !== false &&
    ALLOWED_CATEGORIES.includes(rule?.categoria) &&
    ruleMatchesInput(normalizedInput, rule?.termo_normalizado)
  );
  if (!matching.length) return null;

  const manual = matching
    .filter(rule => rule.manual === true)
    .sort((a,b) => String(b.termo_normalizado || '').length - String(a.termo_normalizado || '').length)[0];
  if (manual) {
    return {
      value: manual.categoria,
      confidence: 0.99,
      source: 'manual-rule',
      term: manual.termo_normalizado
    };
  }

  const byTerm = new Map();
  for (const rule of matching) {
    const term = normalizeLearningTerm(rule.termo_normalizado);
    if (!term) continue;
    if (!byTerm.has(term)) byTerm.set(term, []);
    byTerm.get(term).push(rule);
  }

  const candidates = [];
  for (const [term, rows] of byTerm.entries()) {
    const ranked = rows
      .map(row => ({ category: row.categoria, confirmations: Math.max(0, Number(row.confirmacoes) || 0) }))
      .sort((a,b) => b.confirmations - a.confirmations);
    const top = ranked[0];
    if (!top || top.confirmations < 1) continue;
    const second = ranked[1]?.confirmations || 0;
    if (second > 0 && top.confirmations <= second) continue;

    let confidence = top.confirmations >= 3 ? 0.95 : top.confirmations === 2 ? 0.84 : 0.68;
    if (second > 0) {
      const margin = top.confirmations / Math.max(1, top.confirmations + second);
      confidence = Math.min(confidence, 0.68 + margin * 0.25);
    }

    candidates.push({
      value: top.category,
      confidence,
      source: 'learned-rule',
      term,
      confirmations: top.confirmations,
      competingConfirmations: second
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a,b) =>
    b.confidence - a.confidence ||
    b.confirmations - a.confirmations ||
    b.term.length - a.term.length
  );
  return candidates[0];
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
  const learnedRules = Array.isArray(options.learnedRules) ? options.learnedRules : [];
  const warnings = [];

  const unsupported = detectUnsupportedIntent(raw);
  if (unsupported) {
    return {
      intent: 'unsupported',
      parserVersion: 'rules-learning-history-v3',
      draft: null,
      confidence: {},
      needsReview: true,
      warnings: [{ code: 'UNSUPPORTED_INTENT', field: null, message: unsupported }],
      source: { parser: 'rules-learning-history-v3' }
    };
  }

  const value = parseValue(raw);
  const date = parseDate(raw, todayKey);
  const payment = parsePayment(raw);
  const learnedCategory = classifyByLearnedRules(raw, learnedRules);
  let category = learnedCategory || classifyByRules(raw);
  if (!learnedCategory && category.confidence < 0.9) {
    const historyCategory = classifyByHistory(raw, history);
    if (historyCategory && historyCategory.confidence > category.confidence) category = historyCategory;
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

  const needsReview = Object.values(confidence).some(score => score < 0.7) ||
    !draft.valor ||
    warnings.some(w => ['MULTIPLE_VALUES','VALUE_MISSING'].includes(w.code));

  return {
    intent: 'expense',
    parserVersion: 'rules-learning-history-v3',
    draft,
    confidence,
    needsReview,
    warnings,
    source: {
      parser: 'rules-learning-history-v3',
      categoria: category.source,
      categoriaTermo: category.term || null,
      categoriaConfirmacoes: category.confirmations || 0,
      pagamento: payment.source,
      data: date.source
    }
  };
}

export const SMART_ENTRY_ALLOWED_CATEGORIES = ALLOWED_CATEGORIES;
export const SMART_ENTRY_ALLOWED_PAYMENTS = ALLOWED_PAYMENTS;
