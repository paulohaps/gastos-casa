# Rodada 8 — Behavior Engine V1

Branch: `feature/round-8-behavior-engine`

Base: `main`

## Objetivo

Criar uma camada determinística de inteligência financeira que identifica comportamentos relevantes sem depender de IA e sem alterar a interface nesta rodada.

O motor recebe dados já carregados pelo app e devolve sinais estruturados.

## Arquitetura

Arquivo:
`js/core/behavior-engine.js`

Contrato principal:
`GastosBehaviorEngine.analyze(context)`

Saída:
```json
{
  "version": "behavior-v1",
  "signals": [],
  "summary": {
    "total": 0,
    "byType": {},
    "highestSeverity": null
  },
  "context": {
    "currentMonth": "09/2026",
    "baselineMonths": ["08/2026", "07/2026", "06/2026"],
    "periodDay": 19
  }
}
```

O resultado atual fica disponível em:
- `window.GastosBehavior.getResult()`
- `window.GastosBehavior.getSignals()`

## Histórico utilizado

O app passa a carregar:
- mês selecionado;
- mês anterior;
- dois meses adicionais de baseline.

Total máximo:
- mês atual + 3 meses históricos.

As consultas adicionais são usadas somente pelo Behavior Engine.

Se um mês histórico falhar:
- o restante do app continua funcionando;
- o motor usa as amostras disponíveis;
- detectores que exigem mais base simplesmente não disparam.

## Detectores V1

### 1. Acima da média

Tipo:
`above_average`

Escopo:
`month_total`

Regras:
- exige pelo menos 2 meses históricos;
- no mês atual compara somente o mesmo período dos meses anteriores;
- diferença mínima: R$ 50;
- crescimento mínimo: 30%.

Se houver 3 meses de baseline:
- confiança 0,92.

Com 2 meses:
- confiança 0,82.

Se não houver base suficiente:
- nenhum alerta.

### 2. Possível duplicidade

Tipo:
`possible_duplicate`

Exige coincidência forte entre lançamentos:
- descrição normalizada;
- valor;
- mesma data;
- mesmo usuário;
- mesma forma de pagamento.

Confiança:
- 0,98.

Não considera apenas descrição parecida suficiente para gerar duplicidade.

### 3. Recorrente ausente

Tipo:
`missing_recurring`

Regras:
- somente no mês atual;
- recorrente precisa estar ativo;
- vencimento deve ter passado;
- vencimento do próprio dia ainda não é considerado ausente;
- descrição precisa não ter correspondência nos gastos lançados.

Se atraso >= 7 dias:
- severidade alta.

Caso contrário:
- severidade média.

Confiança:
- 0,95.

### 4. Categoria em crescimento

Tipo:
`category_growth`

Comparação:
- mês atual contra mês anterior;
- quando mês atual está em andamento, compara o mesmo período.

Filtros mínimos:
- baseline da categoria >= R$ 30;
- aumento absoluto >= R$ 40;
- aumento percentual >= 30%.

No máximo:
- 2 categorias com maior alta por análise.

## Contrato de sinal

Exemplo:

```json
{
  "id": "category_growth:mercado:09 2026",
  "type": "category_growth",
  "scope": "category",
  "severity": "medium",
  "confidence": 0.9,
  "period": {
    "currentMonth": "09/2026",
    "baselineMonths": ["08/2026"]
  },
  "entity": {
    "category": "Mercado"
  },
  "metrics": {
    "current": 420,
    "baseline": 250,
    "deltaAmount": 170,
    "deltaPercent": 68
  },
  "evidence": {
    "periodDay": 19
  }
}
```

## Ordenação

Sinais são ordenados por:
1. severidade;
2. confiança;
3. ID estável.

A UI futura não precisa recalcular prioridade.

## Princípios

1. Behavior Engine não grava despesas.
2. Behavior Engine não altera dados.
3. Behavior Engine não usa IA.
4. Ausência de base não vira hipótese.
5. Pequenas variações são ignoradas.
6. Dados históricos parciais reduzem cobertura, não aumentam inferência.
7. O motor não conhece HTML nem componentes visuais.
8. A UI futura deve consumir os sinais, não duplicar as regras.

## Fora desta rodada

- novos cards;
- textos gerados por IA;
- assistente financeiro;
- histórico de preços por item;
- classificação de severidade personalizada pelo usuário;
- notificações push.

## Testes

Testes unitários cobrem:
- média com 3 meses;
- baseline insuficiente;
- comparação pelo mesmo período;
- duplicidade forte;
- não duplicidade por data/valor diferente;
- recorrente vencido;
- recorrente com vencimento hoje;
- mês histórico sem alerta de recorrente;
- crescimento de categoria;
- filtro de variação irrelevante;
- contrato e ordenação.

## PWA

- versão: `20260919-034`
- cache: `gastos-ape-v41`

## Próxima rodada

Rodada 9 — Insights UI:
- consumir sinais do Behavior Engine;
- mostrar somente 2 a 4 sinais relevantes;
- textos curtos e explicáveis;
- drilldown para evidências;
- sem recalcular regras no frontend visual.
