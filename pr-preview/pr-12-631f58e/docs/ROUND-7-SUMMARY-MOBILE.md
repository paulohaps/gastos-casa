# Rodada 7 — Polimento visual do Resumo e cabeçalho mobile

Branch: `design/round-7-summary-mobile`

Base: `main`

## Escopo corrigido

Esta rodada não altera mais a estrutura dos valores financeiros.

Após feedback visual, a reorganização de Total / Participantes / Acerto foi revertida porque piorou a leitura e afetou a composição dos valores.

A Rodada 7 fica limitada a:
- títulos mais consistentes;
- ação Atualizar mais discreta;
- seletor de mês sem corte no mobile;
- cabeçalho mobile mais responsivo;
- remoção da dependência de Poppins;
- preservação integral dos cards e valores já estáveis.

## Regra permanente

Mudança de estilo não deve alterar estrutura de informação estável sem necessidade funcional.

Quando o pedido for:
- melhorar título;
- ajustar botão;
- corrigir responsividade;

não reorganizar:
- valores;
- cards financeiros;
- ordem dos dados;
- estrutura semântica dos módulos.

## Títulos

Padrão:
- eyebrow pequeno;
- título forte;
- traço de acento discreto;
- mesma lógica visual entre Resumo, Lançar, Movimentações e Mais.

## Atualizar

O botão Atualizar vira ação compacta por ícone, com:
- borda discreta;
- sem texto no mobile;
- aria-label preservado;
- sem competir com o título.

## Cabeçalho mobile

O seletor de mês recebe prioridade de largura.

Critérios:
- mês/ano dentro da viewport;
- largura mínima suficiente;
- ações secundárias compactas;
- marca reduzida no mobile;
- sem truncar o valor selecionado.

## Layout financeiro

Mantido exatamente no padrão estável anterior:
- 4 cards;
- Total do mês;
- Paulo Henrique;
- Fernando Gustavo;
- Acerto de contas.

## PWA

- assets: `20260919-032`
- cache: `gastos-ape-v39`

## Testes

O smoke valida:
- 4 cards financeiros presentes;
- valores carregados;
- mês correto;
- seletor dentro da viewport;
- largura mínima do seletor;
- botão Atualizar compacto no mobile;
- demais fluxos de navegação e CRUD preservados.
