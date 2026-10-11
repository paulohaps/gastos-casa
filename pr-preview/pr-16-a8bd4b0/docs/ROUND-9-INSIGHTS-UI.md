# Rodada 9 — Insights UI

Branch: `feature/round-9-insights-ui`

Base: `feature/round-8-behavior-engine`

## Objetivo

Transformar os sinais estruturados do Behavior Engine em uma leitura simples no Resumo, sem duplicar regras de negócio.

A UI:
- não recalcula thresholds;
- não gera sinais;
- não usa IA;
- apenas apresenta os sinais já produzidos pelo motor.

## Estrutura

Novo módulo:
`js/modules/insights.js`

Integração:
- `GastosInsights.init()`
- `GastosInsights.render()`
- `GastosInsights.shareText()`

O Dashboard passa a delegar o bloco de Insights para esse módulo.

## Limite visual

No máximo 4 sinais por vez.

Motivo:
- evitar poluição visual;
- priorizar o que é mais relevante;
- manter o Resumo compacto;
- respeitar a ordenação já feita pelo Behavior Engine.

## Tipos apresentados

### Acima da média
Exemplo:
- título: Gastos acima da média recente
- texto: valor atual, diferença em reais e percentual
- detalhes: média usada, número de meses, período e confiança

### Possível duplicidade
Exemplo:
- título: Possível lançamento duplicado
- texto: descrição, quantidade e valor
- detalhes: data, responsável, pagamento e confiança

### Recorrente ausente
Exemplo:
- título: Internet ainda não apareceu
- texto: vencimento e valor esperado
- detalhes: atraso, categoria, situação e confiança

### Categoria em crescimento
Exemplo:
- título: Mercado cresceu neste mês
- texto: atual x base, diferença e percentual
- detalhes: categoria, mês-base, período e confiança

## Drilldown

Cada sinal possui:
- resumo visível;
- ação “Ver detalhes”;
- área expansível com a evidência usada pelo motor.

O drilldown não faz nova consulta e não recalcula nada.

## Estado sem sinais

Quando não há sinal relevante:
- título: Nada fora do padrão relevante
- texto: o motor não encontrou variações fortes com a base disponível.

Não usar mensagens alarmistas.

## Direção visual

- reutiliza o card de Insights já existente;
- não cria novos cards no Resumo;
- não usa ícone decorativo em tile;
- severidade usa apenas um marcador pequeno e semântico;
- detalhes aparecem por divisor e tipografia, não por card dentro de card.

## Compartilhamento

Os três primeiros sinais podem entrar no texto gerado pelo botão Compartilhar.

## PWA

- versão: `20260919-035`
- cache: `gastos-ape-v42`

## Testes

O smoke visual valida:
- bloco de insights visível;
- quantidade de sinais;
- conteúdo de um sinal real;
- contador;
- abertura do drilldown;
- atributo `aria-expanded`;
- evidência de confiança;
- fechamento do drilldown;
- ausência de regressão de overflow/navegação.

## Regra permanente

A UI nunca deve reproduzir as regras do Behavior Engine.

Se um novo detector for criado:
1. detector entra no motor;
2. o motor entrega um sinal estruturado;
3. a UI apenas cria a tradução visual/textual desse novo tipo.
