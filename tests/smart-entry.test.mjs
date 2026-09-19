import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSmartEntry } from '../backend/smart-entry/parser.mjs';

const todayKey = '2026-09-19';

test('interpreta valor, mercado, hoje e cartão', () => {
  const r = parseSmartEntry('Paguei 87,50 no mercado hoje no cartão', { todayKey });
  assert.equal(r.intent, 'expense');
  assert.equal(r.draft.valor, 87.5);
  assert.equal(r.draft.categoria, 'Mercado');
  assert.equal(r.draft.formaPagamento, 'Dinheiro');
  assert.equal(r.draft.data, '2026-09-19');
  assert.ok(r.confidence.valor >= 0.9);
});

test('interpreta ontem e vale', () => {
  const r = parseSmartEntry('iFood 65 ontem no vale', { todayKey });
  assert.equal(r.draft.valor, 65);
  assert.equal(r.draft.categoria, 'Ifood');
  assert.equal(r.draft.formaPagamento, 'Vale');
  assert.equal(r.draft.data, '2026-09-18');
});

test('usa histórico para categoria quando não há regra direta', () => {
  const history = [
    { descricao: 'Posto Trevo', categoria: 'Contas' },
    { descricao: 'Posto Trevo', categoria: 'Contas' },
    { descricao: 'Posto Trevo', categoria: 'Contas' }
  ];
  const r = parseSmartEntry('Posto Trevo 120', { todayKey, history });
  assert.equal(r.draft.categoria, 'Contas');
  assert.match(r.source.categoria, /history/);
});

test('não transforma consulta em gasto', () => {
  const r = parseSmartEntry('Quanto eu gastei no mercado?', { todayKey });
  assert.equal(r.intent, 'unsupported');
  assert.equal(r.draft, null);
});

test('não inventa valor quando há múltiplos candidatos', () => {
  const r = parseSmartEntry('mercado 150 e farmácia 35', { todayKey });
  assert.equal(r.draft.valor, null);
  assert.equal(r.needsReview, true);
  assert.ok(r.warnings.some(w => w.code === 'MULTIPLE_VALUES'));
});

test('dia do mês não é confundido com valor', () => {
  const r = parseSmartEntry('internet dia 10 129,90', { todayKey });
  assert.equal(r.draft.valor, 129.9);
  assert.equal(r.draft.data, '2026-09-10');
  assert.equal(r.draft.categoria, 'Contas');
});

test('forma de pagamento ausente gera aviso mas mantém fallback', () => {
  const r = parseSmartEntry('aluguel 900', { todayKey });
  assert.equal(r.draft.formaPagamento, 'Dinheiro');
  assert.ok(r.warnings.some(w => w.code === 'PAYMENT_DEFAULTED'));
});


test('reconhece valor com símbolo de moeda', () => {
  const r = parseSmartEntry('R$ 50 mercado hoje', { todayKey });
  assert.equal(r.draft.valor, 50);
  assert.equal(r.draft.categoria, 'Mercado');
});

test('reconhece valor falado com reais e centavos', () => {
  const r = parseSmartEntry('gastei 87 e 50 no mercado hoje', { todayKey });
  assert.equal(r.draft.valor, 87.5);
});

test('marca revisão quando forma de pagamento foi assumida', () => {
  const r = parseSmartEntry('mercado 50 hoje', { todayKey });
  assert.equal(r.needsReview, true);
});


test('regra aprendida tem prioridade sobre heurística e histórico', () => {
  const learnedRules = [
    { termo_normalizado:'posto trevo', categoria:'Contas', confirmacoes:3, manual:false, ativo:true }
  ];
  const history = [
    { descricao:'Posto Trevo', categoria:'Outros' },
    { descricao:'Posto Trevo', categoria:'Outros' }
  ];
  const r = parseSmartEntry('Posto Trevo 120 hoje', { todayKey, history, learnedRules });
  assert.equal(r.draft.categoria, 'Contas');
  assert.equal(r.source.categoria, 'learned-rule');
  assert.ok(r.confidence.categoria >= 0.9);
});

test('uma confirmação aprendida ainda exige revisão', () => {
  const learnedRules = [
    { termo_normalizado:'cantinho', categoria:'Ifood', confirmacoes:1, manual:false, ativo:true }
  ];
  const r = parseSmartEntry('Cantinho 98 hoje no vale', { todayKey, learnedRules });
  assert.equal(r.draft.categoria, 'Ifood');
  assert.equal(r.source.categoria, 'learned-rule');
  assert.equal(r.needsReview, true);
  assert.ok(r.confidence.categoria < 0.7);
});

test('regra manual vence evidência aprendida concorrente', () => {
  const learnedRules = [
    { termo_normalizado:'posto trevo', categoria:'Mercado', confirmacoes:8, manual:false, ativo:true },
    { termo_normalizado:'posto trevo', categoria:'Contas', confirmacoes:0, manual:true, ativo:true }
  ];
  const r = parseSmartEntry('Posto Trevo 180 no pix', { todayKey, learnedRules });
  assert.equal(r.draft.categoria, 'Contas');
  assert.equal(r.source.categoria, 'manual-rule');
  assert.equal(r.confidence.categoria, 0.99);
});

test('empate de aprendizado não cria preferência arbitrária', () => {
  const learnedRules = [
    { termo_normalizado:'loja central', categoria:'Mercado', confirmacoes:2, manual:false, ativo:true },
    { termo_normalizado:'loja central', categoria:'Outros', confirmacoes:2, manual:false, ativo:true }
  ];
  const r = parseSmartEntry('Loja Central 75 hoje', { todayKey, learnedRules });
  assert.notEqual(r.source.categoria, 'learned-rule');
});


test('padroniza descrição genérica de mercado', () => {
  const r = parseSmartEntry('Paguei 87,50 no mercado hoje no PIX', { todayKey });
  assert.equal(r.draft.descricao, 'Mercado');
  assert.match(r.source.descricao, /template/);
});

test('gera descrição com finalidade e estabelecimento', () => {
  const r = parseSmartEntry('Paguei 220 de gasolina no Posto Trevo hoje no cartão', { todayKey });
  assert.equal(r.draft.descricao, 'Combustível • Posto Trevo');
  assert.equal(r.draft.categoria, 'Outros');
});

test('normaliza conta de internet sem repetir a fala inteira', () => {
  const r = parseSmartEntry('Paguei 129,90 de internet hoje no pix', { todayKey });
  assert.equal(r.draft.descricao, 'Internet');
  assert.equal(r.draft.categoria, 'Contas');
});

test('usa descrição histórica confirmada como padrão', () => {
  const history = [
    { descricao: 'Supermercado Central', categoria: 'Mercado' },
    { descricao: 'Supermercado Central', categoria: 'Mercado' }
  ];
  const r = parseSmartEntry('Comprei 95 no Supermercado Central hoje', { todayKey, history });
  assert.equal(r.draft.descricao, 'Supermercado Central');
  assert.equal(r.source.descricao, 'history-description');
});

test('padroniza farmácia com estabelecimento', () => {
  const r = parseSmartEntry('Gastei 45 na Farmácia São Paulo ontem no cartão', { todayKey });
  assert.equal(r.draft.descricao, 'Farmácia São Paulo');
});

test('parser expõe versão v3 após padronização de descrição', () => {
  const r = parseSmartEntry('mercado 50 hoje no pix', { todayKey });
  assert.equal(r.parserVersion, 'rules-learning-history-v3');
  assert.equal(r.source.parser, 'rules-learning-history-v3');
});
