# Visual System V1 — Gastos Casa

## Problema identificado

A interface acumulou estilos em várias rodadas:
- excesso de cards;
- excesso de cantos arredondados;
- pílulas e badges em muitos lugares;
- hierarquia de informação pouco clara;
- componentes com linguagens visuais diferentes;
- aparência de dashboard genérico.

## Direção visual

O sistema passa a seguir cinco regras:

1. Menos contêineres.
   Sempre preferir uma superfície contínua com divisores a vários cards isolados.

2. Raio menor.
   Cards principais: 10–12px.
   Controles: 7–8px.
   Badges: 6px.
   Evitar cápsulas salvo quando semanticamente necessário.

3. Hierarquia por tipografia e espaço.
   Não usar fundo colorido ou borda arredondada para criar destaque quando título, peso e espaçamento resolvem.

4. Navegação móvel como tab bar.
   Sem “pílula ativa”. O item ativo é indicado por cor e um traço superior discreto.

5. Tipografia nativa.
   Usar a pilha do sistema operacional para aparência mais natural e menos genérica.

## Estrutura

Arquivo canônico:
`css/design-system-v1.css`

Ele é carregado após `css/style.css` e define o sistema visual oficial enquanto o CSS legado é limpo gradualmente.

## Resumo

- métricas agrupadas em uma única superfície;
- separação por divisores;
- menos cartões independentes;
- menos fundos coloridos;
- valor e título recebem prioridade.

## Lançar

- Smart Entry integrado ao formulário;
- menos aparência de “widget dentro de widget”;
- prévia organizada por linhas e divisores;
- ações compactas e consistentes.

## Movimentações

- histórico permanece como uma superfície única;
- filtros discretos;
- ações compactas;
- menos badges visuais.

## Mais

- configurações tratadas como seções;
- cards internos reduzidos;
- divisores claros entre grupos;
- métricas com estrutura consistente.

## Mobile

- tab bar fixa na base;
- sem caixa flutuante arredondada;
- safe-area preservada;
- altura menor;
- quatro destinos com peso visual equivalente.

## Não alterar nesta rodada

- contratos do backend;
- regras financeiras;
- Smart Entry;
- Scanner;
- CRUD;
- autenticação;
- navegação funcional.

## Critério de aceite

A interface deve parecer um único produto, não uma coleção de componentes adicionados em momentos diferentes.


## Regra permanente — ícones decorativos

Não usar ícone dentro de quadrado/círculo arredondado apenas por estética.

Esse padrão:
- adiciona volume visual sem função;
- cria aparência genérica de dashboard/IA;
- compete com título e conteúdo;
- fragmenta a hierarquia.

Contêiner de ícone só é permitido quando existir função semântica clara:
- botão clicável;
- navegação;
- status;
- categoria identificável;
- ação primária.

Em títulos, métricas e blocos informativos, preferir:
- ícone simples, sem fundo;
- ou nenhum ícone.


## Regra permanente — polimento sem reestruturação

Quando o problema apontado for visual — título, botão, espaçamento ou responsividade — preservar a estrutura de informação que já está estável.

Melhorias de estilo devem ser aplicadas primeiro por:
- tipografia;
- hierarquia;
- espaçamento;
- alinhamento;
- geometria dos controles.

Não reorganizar valores, cards financeiros ou ordem de leitura sem uma necessidade funcional clara.
