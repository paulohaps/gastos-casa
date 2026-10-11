# Rodada 2 — Navegação em quatro áreas

Branch: `feature/round-2-navigation`

Base: `refactor/round-1-foundation-v2`

## Objetivo

Transformar a experiência de página longa em quatro áreas claras, preservando os módulos e contratos existentes.

## Navegação

### Resumo
Exibe:
- visão geral;
- totais;
- acerto entre participantes;
- comparativo;
- orçamento resumido;
- insights;
- radar financeiro;
- gráfico de participação.

### Lançar
Exibe:
- Smart Entry;
- voz;
- interpretação;
- confirmação;
- formulário manual.

### Movimentações
Exibe:
- histórico;
- busca;
- filtros;
- edição;
- exclusão;
- atualização do mês.

### Mais
Exibe:
- recorrentes;
- orçamento detalhado quando aberto;
- usuários;
- métricas do Smart Entry;
- regras aprendidas;
- configurações.

## Compatibilidade

Hashes antigos continuam sendo interpretados:
- `#visao-geral` → Resumo;
- `#lancamentos` → Lançar;
- `#recorrentes` → Mais;
- `#configuracoes` → Mais;
- `#orcamentoPanel` → Mais.

## Implementação

Novo módulo:
- `js/modules/navigation.js`

A navegação não recria componentes. Ela organiza os elementos existentes em views e controla visibilidade, estado ativo e histórico da URL.

## Regras

1. Uma área não deve depender de recarregar a página.
2. A troca de área não deve refazer login nem sessão.
3. A troca de área não deve apagar dados de formulário.
4. Links antigos devem continuar funcionando.
5. O botão "Definir metas" deve levar para Mais antes de abrir orçamento.
6. A barra móvel deve possuir quatro destinos.
7. Movimentações deve utilizar largura total.
8. O comportamento de PWA deve permanecer estável.

## Critérios de aceite

- Resumo não mostra formulário de lançamento.
- Lançar não mostra histórico.
- Movimentações não mostra formulário.
- Mais concentra automações/configurações.
- Desktop e mobile possuem os mesmos quatro destinos.
- Estado ativo é visualmente identificável.
- Hash acompanha a área atual.
- Back/forward do navegador continua funcional.
- Inputs móveis permanecem sem zoom indesejado.
- Smart Entry, voz, filtros e CRUD não sofrem alteração de regra.

## Próxima rodada

Smart Entry 2.0 multimodal:
- contrato normalizado de entrada;
- voz e texto convergentes;
- confiança por campo;
- descrição aprimorada;
- preparação para câmera/scanner.
