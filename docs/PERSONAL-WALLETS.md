# Carteiras pessoais e recomendações econômicas

## Produto

A casa continua com lançamento inteligente, divisão e acertos em Dinheiro/Vale.
Em **Cofre pessoal**, cada membro autorizado cria carteiras privadas
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

`POST /wallets/insights` só é chamado ao clicar em **Aprofundar com IA**.
O servidor recarrega a carteira do dono e recalcula os sinais. Nunca aceita um
resumo financeiro arbitrário vindo do navegador.

A configuração individual fica em **Ajustes → Inteligência artificial**; Gemini e DeepSeek possuem modelos predefinidos, opção de modelo personalizado, teste de conexão e remoção. Veja `docs/AI-SETTINGS.md`. Opcionalmente, manter uma configuração geral no servidor, com credenciais fora do Git:

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

- 88 testes unitários (incluindo heurísticas, payload privado, cache, falhas e autorização).
- Fluxos de interface em 360, 390, 430, 768, 1366 e 1920 px.
- Migração aplicada somente na branch Neon `dev-personal-wallets-20261011`.
- `tests/wallets-rls.sql` executado nessa branch: dono lê/edita; outro membro não
  lê/edita nem insere em carteira alheia; não membro não lê carteiras.
- Backend de preview separado, com Auth/Data API apontando para a branch isolada.
- Preview expira em 18/10/2026; nenhuma mudança foi aplicada à produção.
- Testes de UI usam servidor mockado; cadastro/login com senha real e chamada de
  IA real ficam para validação do dono/configuração do fornecedor.

O Chromium headless empacotado desta sessão falha ao renderizar texto. A validação visual local usa o Chromium do sistema (`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`), que renderiza corretamente. O helper tenta preenchimento nativo e usa eventos DOM somente se o valor não for inserido. GitHub Actions também executa os fluxos.

Para deploy, empacotar a partir da raiz do repositório: o backend importa
`js/core/wallet-planner.js`. Bundling de `backend/index.mjs` com esbuild resolve
essa dependência num único `index.mjs`. Testar o bundle antes do upload.

Publicação final: aprovar o preview; aplicar a migração no banco correto;
publicar backend compatível; só então publicar o PWA. A regra de aprovação visual
vem de `docs/PROJECT-STATE.md`, seção “Mudança visual sem preview validável”.


## Cofre simples e meta privada — 2026-10-11

A tela principal apresenta limite restante, referência diária, registrar gasto e os últimos cinco lançamentos. “Ver todos” expande a lista sem perder edição/exclusão. Projeção, gráficos e dicas ficam em detalhes recolhidos. `src/features/wallets` separa controlador tipado, contratos e componente; `js/modules/wallets.js` foi removido. Os diálogos compartilhados existentes continuam integrados pelo controlador, sem uma segunda implementação dos motores financeiros.

Cada carteira pode ter uma meta: nome, valor alvo, prazo e reserva para um mês específico. Persistência nas colunas `goal_*` de `personal_wallets`, reutilizando sua RLS por dono. `POST /wallets/goal` verifica autenticação, propriedade, centavos, calendário, prazo >= mês e reserva <= valor alvo. `goal: null` remove a meta após confirmação na interface. Esta primeira versão mantém uma meta por carteira.

A reserva protege orçamento: `livre = max(0, limite - gastos - reserva)`, diária = livre / dias restantes. Não registra aporte bancário, poupança ou movimentação. A reserva não se repete automaticamente em meses seguintes. Sem limite ou fora do mês atual, não inventa referência diária. Se o limite restante for insuficiente para a reserva, há aviso com a diferença. Contas futuras não registradas não entram nesse cálculo.

Migração `db/migrations/20261011_wallet_goals.sql` aplicada somente em `br-broad-unit-acfw9voz`, banco `gastos_casa`, projeto `frosty-star-45149603`. `tests/wallet-goals-rls.sql` passou, com fixtures revertidas; dono lê/edita, outro membro não lê/edita e reserva inválida é bloqueada no banco. Backend de preview `br-lucky-firefly-a50tfkjv`, deployment 10. Produção não recebeu a migração ou deploy.

Cobertura adicional: cálculo de reserva, isolamento/validação da rota, contexto autorizado do chat, persistência após reload, erro 503 com recuperação, confirmação da remoção, respostas atrasadas, totais incoerentes e atalhos sem escrita automática. `tests/modal-bounds.spec.mjs` agora inclui o diálogo da meta com teclado móvel simulado. Uma checagem em iPhone físico permanece necessária para validar o comportamento real de Safari/teclado.
