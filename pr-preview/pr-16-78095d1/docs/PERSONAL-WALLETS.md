# Carteiras pessoais e recomendações econômicas

## Produto

A casa continua com lançamento inteligente, divisão e acertos em Dinheiro/Vale.
Em **Mais → Carteiras pessoais**, cada membro autorizado cria carteiras privadas
para dia a dia, lazer ou viagens. Pode criar, renomear, ajustar limite mensal,
selecionar o mês e criar/editar/excluir gastos. Uma carteira só pode ser excluída
quando está vazia. O limite é um orçamento, não um saldo de conta bancária.

As despesas pessoais não alteram o total da casa, as dívidas ou os acertos.
A combinação de privacidade individual e colaboração é a direção de produto;
não há afirmação de exclusividade no mercado sem pesquisa competitiva.

## Heurísticas antes de IA

O servidor calcula os números; a interface apenas os apresenta:

- disponível = máximo entre zero e limite menos gastos do mês;
- referência diária = disponível dividido pelos dias restantes, incluindo hoje;
- limite excedido: alerta com diferença efetiva;
- ritmo alto: a partir do 7º dia, consumo do limite supera a fração do mês em
  mais de 15 pontos percentuais; contas fixas podem explicar esse comportamento;
- delivery: ao menos 3 compras e R$ 100; cenário de redução de 20%, sem prometer
  economia nem confundir economia com valor a receber.

Mês histórico ou futuro não recebe limite diário. Sem limite, não se inventa
saldo disponível. O histórico inclui só a carteira e competência selecionadas.

## IA opcional

`POST /wallets/insights` só é chamado ao clicar em **Explicar recomendações com IA**.
O servidor recarrega a carteira do dono e recalcula os sinais. Nunca aceita um
resumo financeiro arbitrário vindo do navegador.

Configurar no servidor, mantendo credenciais fora do Git:

- `INSIGHTS_AI_BASE_URL`: URL HTTPS de API compatível com Chat Completions,
  incluindo `/v1` quando exigido pelo fornecedor;
- `INSIGHTS_AI_API_KEY`: segredo do fornecedor;
- `INSIGHTS_AI_MODEL`: modelo disponível nessa API.

Sem configuração, sem sinais ou com falha/timeout, as heurísticas continuam
funcionando. A IA explica, nunca grava gastos ou modifica cálculos.

O prompt envia apenas números, mês, categorias permitidas e até três sinais.
Não envia descrições, nomes, IDs, recibos ou histórico bruto. A saída é limitada
a 180 tokens. O retorno informa uso real quando o fornecedor oferece métricas.
Não há promessa de percentual de redução de tokens sem medição em produção.

Cache de seis horas por usuário/carteira/modelo/resumo; mudanças nos números
invalidam a chave. Chamadas idênticas simultâneas são agrupadas. Há intervalo de
60 segundos por usuário para novos resumos e até 500 entradas em memória.
Cache e intervalo são **por processo**, não constituem teto financeiro global em
múltiplas instâncias. Antes de ativar IA em escala, configurar limites do
fornecedor e/ou orçamento persistente. Reiniciar o processo perde esse cache.

## Segurança e banco

Migração: `db/migrations/20261011_personal_wallets.sql`.
Tabelas `personal_wallets` e `personal_expenses`, separadas de `gastos`.
RLS exige dono autenticado e membro ativo. O backend fixa `owner_id` pela sessão
validada; filtros explícitos também restringem leituras e mutações.
FK composta `(wallet_id, owner_id)` impede inserir em carteira de outro dono.
Campos de identidade não são editáveis pelas rotas.

Rotas: `GET/POST /wallets`, `GET/POST /wallets/expenses`, `POST /wallets/insights`.
Valores, datas, UUIDs, categorias e competência são validados. Consultas mensais
são paginadas em blocos de mil; acima de dez mil itens, retornam erro em vez de
mostrar uma soma incompleta.

## Validação e publicação

- 82 testes unitários (incluindo heurísticas, payload privado, cache, falhas e autorização).
- Fluxos de interface em 360, 390, 430, 768, 1366 e 1920 px.
- Migração aplicada somente na branch Neon `dev-personal-wallets-20261011`.
- `tests/wallets-rls.sql` executado nessa branch: dono lê/edita; outro membro não
  lê/edita nem insere em carteira alheia; não membro não lê carteiras.
- Backend de preview separado, com Auth/Data API apontando para a branch isolada.
- Preview expira em 18/10/2026; nenhuma mudança foi aplicada à produção.
- Testes de UI usam servidor mockado; cadastro/login com senha real e chamada de
  IA real ficam para validação do dono/configuração do fornecedor.

O ambiente Chromium desta sessão não insere texto por teclado e não renderiza
texto nas capturas; o helper de teste tenta preenchimento nativo e usa eventos
DOM somente se o valor não for inserido. O teste em GitHub Actions e o preview
navegável são as referências para revisão visual.

Para deploy, empacotar a partir da raiz do repositório: o backend importa
`js/core/wallet-planner.js`. Bundling de `backend/index.mjs` com esbuild resolve
essa dependência num único `index.mjs`. Testar o bundle antes do upload.

Publicação final: aprovar o preview; aplicar a migração no banco correto;
publicar backend compatível; só então publicar o PWA. A regra de aprovação visual
vem de `docs/PROJECT-STATE.md`, seção “Mudança visual sem preview validável”.
