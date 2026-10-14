# Gastos Casa 2.0 — Fase 1: estrutura, contratos e viabilidade

Referência auditada: commit `c77780a`, branch `feature/personal-wallets-efficient-insights`. Escopo: leitura do frontend/backend/migrações versionadas, consultas HTTP públicas sem autenticação e testes locais. Esta fase não altera interface, dados, banco, backend ou produção.

## 1. Conclusão

A base pode sustentar o dashboard premium sem trocar de stack ou backend. Cadastro, histórico, orçamento por categoria, recorrentes, acertos, Cofre e chatbot já têm implementação. A interface é híbrida: React/TypeScript nas áreas migradas e HTML/JavaScript nas áreas financeiras compartilhadas. O principal trabalho é reorganizar componentes e fontes de estado, consolidar cálculos em centavos e evoluir os contratos que hoje assumem divisão 50/50 e apenas Dinheiro/Vale.

O brief atual passa a ser a referência de design: Dark Mode padrão com a paleta especificada. A paleta branca/azul-marinho da revisão anterior não é a direção desta fase futura.

## 2. Stack e limites de responsabilidade

- React 19.2, TypeScript estrito, Vite 7.3; sem Tailwind, shadcn, Recharts ou Motion instalados.
- `src/app/App.tsx`: uma raiz React; features montadas via portais. `legacy-bridge.ts` isola interfaces com módulos existentes, mas ainda depende de IDs/objetos globais.
- `src/features/overview`, `wallets`, `assistant`, `settings`: componentes e controllers/hooks separados em boa parte. O controller do Cofre ainda controla formulários do DOM legado; migrar essa responsabilidade gradualmente.
- `js/app.js`: seleção e carregamento de mês, montagem dos módulos e estado financeiro compartilhado.
- `js/modules/*`: tabela/cadastro da Casa, orçamento, recorrentes, gráficos, radar e acertos.
- `js/api.js` + `js/core/http-client.js`: adaptação HTTP, autenticação, cancelamento e validação de respostas.
- `backend/routes/*` + `backend/services/*`: rotas existentes e lógica do servidor.
- Neon Auth → Function → Data API → Postgres/RLS. Não substituir esta integração para fazer o redesign.
- CSS atual: `app.css` para base/controles; `shell.css` para geometria/navegação; `experience.css` para telas financeiras; `chat.css` para conversa.

Recomendação: manter React, TypeScript, Vite e as fronteiras existentes. Usar tokens de tema, Inter local com fallback e `font-display: swap`, componentes acessíveis e animação CSS discreta. SVGs locais e `<dialog>` já resolvem ícones/foco sem biblioteca adicional. Avaliar Recharts somente na implementação dos gráficos históricos; preservar drill-down, alternativa textual e teclado, com carregamento sob demanda se adotado. Não adicionar todos os pacotes sugeridos por padrão.

## 3. Componentes: reutilizar, adaptar e reformular

| Área / componente atual | Decisão | Trabalho necessário |
|---|---|---|
| `AppShell`, `CommandMenu` | Reutilizar comportamento; adaptar visual/navegação | Dark Mode, novas áreas e FAB mobile; preservar foco, teclado e aliases históricos |
| `FeatureBoundary`, `Icon`, utilitários de diálogo e `AppUI` | Reutilizar | Tokens de tema e composição bottom sheet responsiva; manter foco/busy/confirm/retry |
| `Overview.tsx` e controller | Reformular a composição e os seletores | Indicadores com semântica correta, evolução mensal, disponibilidade por módulo e fonte comum de filtros |
| `Wallets`, `GoalEditor`, contratos/controller | Reutilizar domínio; adaptar apresentação | Cofre continua privado; limites atuais não podem ser apresentados como orçamento histórico comprovado |
| `Assistant`, `useAssistant`, `PeriodSelector`, `useChatViewport`, `MessageCard` | Reutilizar | Tema e hierarquia novos; manter streaming, saída, histórico, contexto de até 12 meses e privacidade |
| `Settings`, `Members`, `Rules`, `useConnection` | Reutilizar | Organização e tema; manter presets reais Gemini/DeepSeek e estado de chave não verificada |
| `js/modules/expenses.js` + formulário no `index.html` | Migrar por componente para React | Cadastro rápido, tabela/lista mobile, ordenação e filtro comum; reaproveitar serviços de gravação |
| `js/modules/settlements.js` + calculadores duplicados | Reutilizar fluxo/histórico; substituir cálculo e estado | Um núcleo em centavos compartilhado entre browser/servidor; estado seguro em falha e central dedicada |
| `budgets.js`, `recurring.js`, `behavior-engine.js`, `wallet-planner.js` | Reutilizar regras comprovadas | React na visualização, estado explícito e precisão dos totais; previsões identificadas como estimativas |
| `charts.js` | Reutilizar agrupamento/interação; adaptar renderização | Categorias/pessoas com detalhe real; nova série histórica sem inventar meses ou gastos |
| Scanner, voz, importação fiscal e lançamento interpretado | Preservar | Manter revisão antes de salvar e falhas recuperáveis; ficam como opções progressivas no cadastro |

## 4. Rotas e dados que realmente existem

### Rotas do frontend

`#resumo`, `#casa`, `#carteiras`, `#assistente`, `#ajustes`, `#lancar`. Casa contém `visao`, `despesas`, `acertos`, `planejamento`. Há aliases legados como `#visao-geral`, `#movimentacoes`, `#recorrentes` e `#orcamentopanel`. Novas áreas podem ser rotas de interface sobre os serviços atuais; manter aliases e períodos selecionados.

### Contratos HTTP atuais

| Recurso | Rotas existentes | Conteúdo e limite real |
|---|---|---|
| Sessão | `/login`, `/signup`, `/session`, `/logout` | Sessão validada pelo servidor; JWT para Data API |
| Casa | `GET /months`; `GET/POST /expenses` | POST com ações add/update/delete; despesas por data e nome do responsável |
| Acertos | `GET/POST /settlements` | Add/delete por competência; Dinheiro/Vale; pagador fixado pela sessão |
| Orçamento | `GET/POST /budgets` | Limite por mês/categoria; upsert das categorias suportadas |
| Recorrentes | `GET/POST /recurring` | Templates com vencimento; uso abre formulário para revisão |
| Participantes | `GET/POST /members` | Listagem e criação de membro; não há contrato de percentuais de divisão |
| Cofre privado | `/wallets`, `/wallets/expenses`, `/wallets/goal`, `/wallets/insights` | Carteiras e despesas por dono; meta/reserva e limite na carteira |
| Assistente / IA | `/assistant/chat`, `/assistant/conversation`, `/ai/settings` | Streaming, histórico privado, intervalos e presets/chaves criptografadas |
| Entrada inteligente | `/smart-entry/*`, `/receipts/inspect`, `/features` | Interpretação, regras, métricas e inspeção de comprovantes |

Não há contrato existente para participantes/parcelas por despesa, parcelamento, fechamento/bloqueio de competência ou catálogo configurável de métodos/categorias.

### Modelos versionados / consultados pelo código

- **`gastos`:** id, data, usuario, valor, descricao, categoria, forma_pagamento e timestamps. A auditoria usa os SELECTs e migrações de alteração; o CREATE TABLE original de `gastos` não está entre as migrações consultadas. Não inferir colunas adicionais.
- **`acertos`:** competência separada da data do pagamento, pagador, recebedor, método, valor, observação e criador. Transferências ficam fora de `gastos`, preservando o total de despesas.
- **`orcamentos`:** mes, categoria, valor_limite; limite histórico da Casa é mensal.
- **`gastos_recorrentes`:** descrição, valor, categoria, método, dia de vencimento, ativo e criador. Sem vínculo persistido entre template e gasto gerado.
- **`household_members`:** UUID de autenticação, nome, email, ativo. Os calculadores ainda usam nomes fixos apesar de haver criação de outros membros.
- **`personal_wallets`:** dono, nome, limite mensal atual e campos de uma meta/reserva. Não há versionamento mensal do limite pessoal.
- **`personal_expenses`:** dono, carteira, data, valor, descrição e categoria. Sem campo de método de pagamento, participantes ou parcelas.
- **IA/conversas:** configuração criptografada por dono e histórico privado por contexto/período.

Categorias suportadas nas constraints: Mercado, Contas, Aluguel, Ifood, Outros. Métodos compartilhados suportados: Dinheiro e Vale. Pix/cartão não são apenas novas opções de um select: constraints, validação, parser e cálculo precisam aceitar os novos valores.

## 5. Achados de confiabilidade e semântica

### P1 — Centavos não garantidos no motor de acerto

`backend/settlements/calculator.mjs:18` divide o total decimal por dois; `js/core/settlements.js` repete essa regra. `isSettled` usa tolerância de 0,005. Fixture sintética isolada: gasto de R$ 0,01 de PH gera débito de R$ 0,005 para Fernando. Um pagamento de R$ 0,01 inverte a dívida para PH, mantendo meio centavo. Formatar a tela com duas casas não corrige o domínio.

Correção planejada: parsing monetário validado em centavos inteiros, núcleo único e alocação determinística do centavo residual. Não arredondar cada responsabilidade independentemente. A soma das parcelas deve ser exatamente o total. Definir a regra do residual explicitamente e comparar períodos antigos sem reescrever registros.

### P1 — Quitação concorrente pode ultrapassar o saldo

`backend/routes/settlements.mjs:83` consulta/calcula/valida e depois faz POST em `acertos`, sem operação atômica ou idempotência. Fixture isolada com saldo restante de R$ 65: dois pedidos simultâneos de R$ 65 recebem HTTP 200 e inserem R$ 130.

Correção planejada: chave de idempotência e operação transacional com bloqueio/revalidação do saldo na fronteira de gravação. Um lock em memória da Function ou botão desabilitado não resolve múltiplas abas/processos. Essa é uma necessidade demonstrada de evolução localizada no backend/persistência, não troca de backend.

### P1 — Dados incompletos de módulos não podem virar saldos oficiais

`js/app.js:227` usa listas vazias quando falham consultas auxiliares e calcula acertos/comparação antes de publicar avisos. `AppUI.setModuleError` mostra mensagem/retry, mas não impede sozinho o uso dos números derivados. Na nova dashboard, disponibilidade de gastos, pagamentos, orçamento e base anterior deve ser independente. Acerto indisponível deve bloquear pagamento e exibir erro; comparação sem consulta concluída não é “Sem base”; orçamento com falha não é “Sem meta”.

### P1 — Histórico sem garantia explícita de completude

`GET /months`, `GET /expenses` e a consulta de acertos não paginam explicitamente na Data API. Isso cria risco de omitir registros/meses quando a resposta atingir o limite configurado; não foi demonstrada perda real em produção nesta auditoria. Cofre e preparação do assistente já paginam e falham de forma explícita em excesso. Aplicar o mesmo princípio às leituras compartilhadas antes de anunciar “histórico completo”.

### P1 — Validação de despesa compartilhada é mais fraca que a pessoal

`backend/routes/expenses.mjs:52` transforma valor com `Number` e encaminha data/descrição sem validação equivalente à de `wallets.mjs`. Consolidar validação server-side de valor em centavos, data real, descrição, categoria/método e identidade. Não depender apenas do formulário nem assumir constraints não versionadas.

### P2 — Valores pagos não são responsabilidades

`js/modules/dashboard.js:70` soma pagamentos registrados por pessoa. Esses indicadores podem ser reaproveitados como **“Pago por PH/Fernando”**, mas não renomeados para **“Responsabilidade”**. Atualmente a responsabilidade compartilhada é inferida em 50/50; pessoal usa o proprietário. Não há distribuição por despesa no banco.

### P2 — Filtros atualizam apenas a tabela

`js/modules/expenses.js:86` filtra lista, contagem e total da lista. Dashboard, gráficos, orçamento e acertos mantêm seus próprios dados. Um estado de filtros com seletores comuns deve alimentar cada indicador relacionado e o drill-down. Acerto oficial do mês precisa ter escopo visível e usar todos os dados necessários; subtotal filtrado não deve ser tratado como dívida oficial sem reavaliar as responsabilidades correspondentes.

### P2 — Identidade, recorrência e orçamento histórico

- Names fixos no motor divergem da lista configurável de membros. Usar UUIDs de participantes no futuro e resolver nomes legados sem descartar autores não reconhecidos.
- Inserção de despesa da Casa fixa `usuario` na sessão; trigger torna o responsável imutável. Selecionar livremente quem pagou exige contrato/autorizações, não alteração isolada do formulário.
- “Recorrente lançado” é inferido por semelhança da descrição (`recurring.js:16`). É heurística, não vínculo contábil nem prevenção confiável de duplicidade.
- Alterar o limite atual da carteira muda a referência aplicada a consultas antigas. Não apresentar isso como limite histórico aprovado; versionamento mensal precisa de persistência adicional.
- O projeto fornece despesas, acertos e limites; não há modelo de receitas/contas bancárias. “Orçamento disponível” e “A receber/pagar” devem ter rótulos próprios, sem sugerir saldo bancário.

## 6. Funcionalidades por viabilidade

| Pedido | Pode usar a base atual | Dependência real |
|---|---|---|
| Dark Mode, Inter, sidebar/header/FAB/bottom sheets | Sim, frontend | Tokens, componentes e preferência de tema local; preferência sincronizada por conta exigiria contrato adicional |
| Total, pagos por pessoa, acerto 50/50, orçamento da Casa e variação | Sim, após estados/cálculos confiáveis | Responsabilidade customizada depende de parcelas persistidas; base anterior concluída para variação |
| Histórico mensal, busca, filtros, ordenação e CSV | Sim, frontend/serviços atuais | Garantir consultas completas; exportar só dados autorizados e neutralizar fórmulas de planilha |
| Evolução e intervalos, maiores gastos, categorias/pessoas | Sim, leituras existentes | Serviço de período com cancelamento, cache por sessão/escopo e sem perda por paginação; rota agregada é otimização posterior, não pré-requisito inventado |
| Pessoal versus compartilhado | Parcial | Somar apenas os dados privados do usuário atual; dados pessoais de Fernando não são acessíveis a PH |
| Projeção / comportamento | Sim | Reaproveitar heurísticas; exibir como estimativa e não gerar previsão com base insuficiente ou mês encerrado |
| Limites por categoria e progresso | Sim | `/budgets` já persiste por mês; tratar falha e ausência de configuração separadamente |
| Meta/reserva pessoal | Sim no contrato versionado | Reserva é orçamento protegido, não poupança comprovada; metas conjuntas ou múltiplas metas exigem modelo adicional |
| Divisão igual/percentual/fixa por despesa | Não está persistida | Participantes/UUIDs, modo de divisão, parcelas em centavos e snapshot por gasto; compatibilidade legada e RLS |
| Escolher outro pagador | Não no contrato atual de inserção | Separar criador do pagador, autorizações e cálculo; preservar autoria e regras antigas |
| Pix/cartão/outros e categorias configuráveis | Não integralmente | Constraints, catálogos/validação, parser e cálculos; métodos pessoais também precisam de campo persistido |
| Parcelamento | Não | Série/grupo, número de parcelas, competência e total em centavos; operação atômica/idempotente |
| Recorrência automática confiável | Apenas templates/manualmente | Vínculo template–lançamento, unicidade por competência e execução autorizada no servidor |
| Fechamento persistente e bloqueio histórico | Não | Estado de período, snapshot/revisão, auditoria e regras de reabertura autorizada |
| Acertos sem duplicidade | Estrutura separada existe | Operação atômica/idempotente e centavos; ajustes não alteram soma de `gastos` |
| Configuração de privacidade | Isolamento já existe | Preferência visual local pode ser frontend; novos compartilhamentos precisam de RLS/contrato explícito |
| Assistente financeiro | Já existe | Manter integração real/presets, sem novo provedor ou backend; não é necessário reconstruí-lo como funcionalidade futura |

Filtros por método não se aplicam integralmente aos gastos pessoais atuais: a ausência desse campo deve ser explicitada, sem atribuir “Dinheiro” por conveniência. Nenhuma função dependente de backend deve usar persistência simulada ou aparecer como concluída apenas por existir um formulário.

## 7. Organização proposta para as próximas fases

Desktop: Dashboard, Transações, Divisão de gastos, Analytics, Orçamentos, Cofre, Assistente e Configurações, agrupados por uso. Mobile: Início, Transações, Acertos, Cofre e Mais; Analytics, Orçamentos, Assistente e Configurações acessíveis em Mais. FAB nomeado “Nova despesa”, com alvo de toque e espaço reservado, sem cobrir a navegação ou o compositor do chat.

Camadas: componentes recebem props/estado; hooks/controllers carregam dados; serviços preservam APIs existentes; seletores puros calculam indicadores; núcleo monetário compartilhado representa centavos. Cache apenas de dados autorizados com chaves de usuário/escopo/período, invalidação ao gravar e limpeza ao trocar sessão. Não colocar valores pessoais no cache público do service worker.

### Fase 2 — Design system e dashboard

Implementar tokens Dark Mode exatos do brief: #0B1120 / #151E30 / #1C293D; financeiro #16C784; analítico #8B7CF6; atenção #F5B942; despesas #EF646B; texto #F8FAFC / #9CAAC1. Botão verde usa texto escuro para manter contraste. Fazer uma composição concreta desktop/mobile antes de expandir o visual às demais telas. Dashboard usa somente métricas suportadas, com carregando/vazio/sucesso/erro por fonte. Correção monetária e indisponibilidade são requisitos para publicar os novos saldos.

### Fase 3 — Cadastro e transações

Valor/descrição primeiro; escolher Casa/Cofre no mesmo fluxo; detalhes progressivos. Preservar envio ao endpoint correspondente e privacidade. Mostrar pagador atual conforme autorização até que o contrato ampliado exista. Tabela desktop/lista mobile com fonte filtrada única, busca, ordenação, confirmação e atualização após gravação confirmada. Não permitir múltiplos envios enquanto grava, mas não confundir isso com idempotência de servidor.

### Fase 4 — Divisão e central

Primeiro unificar centavos e validar o comportamento legado. Depois preparar evolução mínima e compatível do modelo por despesa/participante e operação atômica de acerto. Comparar resultados históricos antes de qualquer adoção/backfill; não apagar registros. Fechamento persistido exige estado/auditoria própria. Registrar revisão e impacto de qualquer regra que altere saldos anteriores.

### Fase 5 — Analytics, orçamento e previsões

Serviço de períodos com leituras completas e cancelamento; filtros alimentam série, total, drill-down e comparação. Reusar orçamento mensal e radar. Separar previsões de valores registrados; meses ausentes não são zeros quando a consulta falhou. Limite pessoal histórico exige contrato adicional, não extrapolar o atual.

### Fase 6 — Refinamento e produção

Testes de centavos residuais, percentual/fixo, nomes/IDs legados, conciliação, idempotência e concorrência; acerto fora da despesa; filtro/indicadores; históricos longos; 503 e troca rápida de mês; privacy/RLS entre usuários; tema/contraste/teclado/bottom sheets; dispositivos e PWA. Promover somente artefatos compatíveis e dependências verificadas. Esta auditoria não autoriza sozinha uma publicação em produção.

## 8. Ambientes verificados sem acesso a dados financeiros

| Consulta sem autenticação | Produção | Prévia |
|---|---|---|
| `/health` | 200, 2026-09-19.10 | 200, 2026-10-11.2 |
| `/expenses` e `/settlements` com mês | 401 | 401 |
| `/wallets` | 404 | 401 |
| `/ai/settings` | 404 | 401 |
| `/assistant/conversation` | 404 | 401 |

401 comprova rota protegida registrada, não integração autenticada com banco/provedor. 404 em produção confirma divergência de versão. Não inspecionei o catálogo atual do banco nem segredos; as diferenças de tabelas/configuração registradas em `PRODUCTION-READINESS-20261012.md` precisam ser revalidadas quando a promoção for preparada.

## 9. Evidências e baseline

- Probes financeiros: `/workspace/artifacts/finance-20-audit/financial-probes.jsonl`. Fixtures sintéticas isoladas sem requisições a banco/servidor real.
- Rotas públicas: `/workspace/artifacts/finance-20-audit/public-routes.json`. Apenas status/versão.
- Baseline executado nesta auditoria: `npm run lint` aprovado (TypeScript estrito, Prettier, contratos e sintaxe); `npm test` aprovado com 166 testes unitários e 108 testes de navegador, total de 274. O build de produção integra a suíte de navegador e passou. Logs locais: `/tmp/finance-20-audit-lint.log` e `/tmp/finance-20-audit-tests.log`. Os testes existentes não cobrem os dois probes de centavos/concorrência; aprovação da suíte não invalida esses achados.
