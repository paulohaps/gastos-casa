import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../js/core/behavior-engine.js');

test('detecta total acima da média de três meses comparáveis', () => {
  const result = engine.analyze({
    currentMonth: '09/2026',
    currentDay: 19,
    isCurrentMonth: true,
    currentExpenses: [
      { id:'c1', data:'10/09/2026', descricao:'Mercado', valor:420, categoria:'Mercado', usuario:'Paulo Henrique', formaPagamento:'Dinheiro' }
    ],
    historyMonths: [
      { month:'08/2026', expenses:[{ data:'10/08/2026', descricao:'Mercado', valor:180, categoria:'Mercado' }] },
      { month:'07/2026', expenses:[{ data:'10/07/2026', descricao:'Mercado', valor:220, categoria:'Mercado' }] },
      { month:'06/2026', expenses:[{ data:'10/06/2026', descricao:'Mercado', valor:200, categoria:'Mercado' }] }
    ]
  });

  const signal = result.signals.find(item => item.type === 'above_average');
  assert.ok(signal);
  assert.equal(signal.metrics.current, 420);
  assert.equal(signal.metrics.baseline, 200);
  assert.equal(signal.metrics.deltaAmount, 220);
  assert.equal(signal.metrics.deltaPercent, 110);
  assert.equal(signal.confidence, 0.92);
});

test('não gera média com apenas um mês de base', () => {
  const result = engine.analyze({
    currentMonth:'09/2026',
    currentDay:19,
    isCurrentMonth:true,
    currentExpenses:[{ data:'10/09/2026', valor:500 }],
    historyMonths:[
      { month:'08/2026', expenses:[{ data:'10/08/2026', valor:100 }] }
    ]
  });
  assert.equal(result.signals.some(item => item.type === 'above_average'), false);
});

test('compara somente o mesmo período do mês atual', () => {
  const result = engine.analyze({
    currentMonth:'09/2026',
    currentDay:10,
    isCurrentMonth:true,
    currentExpenses:[{ data:'05/09/2026', valor:180 }],
    historyMonths:[
      { month:'08/2026', expenses:[
        { data:'05/08/2026', valor:100 },
        { data:'20/08/2026', valor:1000 }
      ]},
      { month:'07/2026', expenses:[
        { data:'05/07/2026', valor:100 },
        { data:'25/07/2026', valor:1000 }
      ]}
    ]
  });
  const signal = result.signals.find(item => item.type === 'above_average');
  assert.ok(signal);
  assert.equal(signal.metrics.baseline, 100);
});

test('detecta duplicidade apenas com coincidência forte', () => {
  const repeated = {
    data:'19/09/2026',
    descricao:'Supermercado Central',
    valor:87.50,
    usuario:'Paulo Henrique',
    formaPagamento:'Dinheiro',
    categoria:'Mercado'
  };
  const result = engine.analyze({
    currentMonth:'09/2026',
    isCurrentMonth:true,
    currentDay:19,
    currentExpenses:[
      { id:'a', ...repeated },
      { id:'b', ...repeated },
      { id:'c', ...repeated, usuario:'Fernando Gustavo' }
    ]
  });
  const duplicates = result.signals.filter(item => item.type === 'possible_duplicate');
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].metrics.count, 2);
  assert.deepEqual(duplicates[0].evidence.expenseIds, ['a','b']);
  assert.equal(duplicates[0].confidence, 0.98);
});

test('não marca como duplicado quando valor ou data mudam', () => {
  const result = engine.analyze({
    currentMonth:'09/2026',
    isCurrentMonth:true,
    currentDay:19,
    currentExpenses:[
      { id:'a', data:'18/09/2026', descricao:'Internet', valor:129.90, usuario:'Paulo Henrique', formaPagamento:'Dinheiro' },
      { id:'b', data:'19/09/2026', descricao:'Internet', valor:129.90, usuario:'Paulo Henrique', formaPagamento:'Dinheiro' },
      { id:'c', data:'18/09/2026', descricao:'Internet', valor:130.00, usuario:'Paulo Henrique', formaPagamento:'Dinheiro' }
    ]
  });
  assert.equal(result.signals.some(item => item.type === 'possible_duplicate'), false);
});

test('detecta recorrente vencido ainda não lançado', () => {
  const result = engine.analyze({
    currentMonth:'09/2026',
    isCurrentMonth:true,
    currentDay:19,
    currentExpenses:[
      { data:'05/09/2026', descricao:'Aluguel', valor:900 }
    ],
    recurring:[
      { id:'r1', descricao:'Internet Claro', valor:129.90, categoria:'Contas', dia_vencimento:10, ativo:true },
      { id:'r2', descricao:'Aluguel', valor:900, categoria:'Aluguel', dia_vencimento:5, ativo:true }
    ]
  });
  const missing = result.signals.filter(item => item.type === 'missing_recurring');
  assert.equal(missing.length, 1);
  assert.equal(missing[0].entity.description, 'Internet Claro');
  assert.equal(missing[0].metrics.overdueDays, 9);
  assert.equal(missing[0].severity, 'high');
});

test('recorrente com vencimento hoje ainda não é tratado como ausente', () => {
  const result = engine.analyze({
    currentMonth:'09/2026',
    isCurrentMonth:true,
    currentDay:19,
    recurring:[
      { id:'r1', descricao:'Internet', valor:100, dia_vencimento:19, ativo:true }
    ]
  });
  assert.equal(result.signals.some(item => item.type === 'missing_recurring'), false);
});

test('não gera recorrente ausente ao analisar mês histórico', () => {
  const result = engine.analyze({
    currentMonth:'08/2026',
    isCurrentMonth:false,
    currentDay:31,
    recurring:[
      { id:'r1', descricao:'Internet', valor:100, dia_vencimento:10, ativo:true }
    ]
  });
  assert.equal(result.signals.some(item => item.type === 'missing_recurring'), false);
});

test('detecta categoria em crescimento contra mês anterior', () => {
  const result = engine.analyze({
    currentMonth:'09/2026',
    currentDay:19,
    isCurrentMonth:true,
    currentExpenses:[
      { data:'05/09/2026', categoria:'Mercado', valor:300 },
      { data:'12/09/2026', categoria:'Mercado', valor:120 }
    ],
    historyMonths:[
      { month:'08/2026', expenses:[
        { data:'05/08/2026', categoria:'Mercado', valor:150 },
        { data:'12/08/2026', categoria:'Mercado', valor:100 }
      ]}
    ]
  });
  const signal = result.signals.find(item => item.type === 'category_growth');
  assert.ok(signal);
  assert.equal(signal.entity.category, 'Mercado');
  assert.equal(signal.metrics.current, 420);
  assert.equal(signal.metrics.baseline, 250);
  assert.equal(signal.metrics.deltaAmount, 170);
  assert.equal(signal.metrics.deltaPercent, 68);
});

test('ignora crescimento irrelevante em valor absoluto', () => {
  const result = engine.analyze({
    currentMonth:'09/2026',
    currentDay:19,
    isCurrentMonth:true,
    currentExpenses:[{ data:'05/09/2026', categoria:'Outros', valor:55 }],
    historyMonths:[
      { month:'08/2026', expenses:[{ data:'05/08/2026', categoria:'Outros', valor:35 }] }
    ]
  });
  assert.equal(result.signals.some(item => item.type === 'category_growth'), false);
});

test('contrato retorna resumo, versão e ordenação por severidade', () => {
  const result = engine.analyze({
    currentMonth:'09/2026',
    currentDay:20,
    isCurrentMonth:true,
    currentExpenses:[
      { id:'a', data:'10/09/2026', descricao:'Mercado', valor:500, categoria:'Mercado', usuario:'Paulo Henrique', formaPagamento:'Dinheiro' },
      { id:'b', data:'10/09/2026', descricao:'Mercado', valor:500, categoria:'Mercado', usuario:'Paulo Henrique', formaPagamento:'Dinheiro' }
    ],
    historyMonths:[
      { month:'08/2026', expenses:[{ data:'10/08/2026', categoria:'Mercado', valor:200 }] },
      { month:'07/2026', expenses:[{ data:'10/07/2026', categoria:'Mercado', valor:200 }] }
    ],
    recurring:[
      { id:'r1', descricao:'Internet', valor:120, dia_vencimento:5, ativo:true }
    ]
  });

  assert.equal(result.version, 'behavior-v1');
  assert.equal(result.summary.total, result.signals.length);
  assert.equal(result.signals[0].severity, 'high');
  assert.ok(result.summary.byType.above_average >= 1);
  assert.ok(Array.isArray(result.context.baselineMonths));
});
