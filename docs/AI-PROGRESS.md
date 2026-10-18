# Recuperação e validação — 17/10/2026

O ambiente anterior foi substituído antes do push dos commits locais. Os hashes antigos citados na conversa não estão no remoto e não são referência desta implementação. Base recuperada: `731df88`. Branch nova: `recover/financial-reliability-20261017`.

As correções estão sendo reconstruídas a partir dos registros da conversa, com nova revisão e nova execução dos testes. Contagens anteriores não comprovam esta branch.

Escopo: leitura completa/centavos do Cofre, navegação mensal do chat, datas civis locais, comparação coerente, proteção/feedback do formulário e operação transacional idempotente de cadastro. Migração aditiva; nenhum dado histórico deve ser reescrito. `release/production.json` permanece bloqueado até ensaio hospedado.

Próximas etapas: regressões novas, lint/tipos/build, suíte integral, PostgreSQL local e ensaio Auth/JWT/Data API/RLS em `br-dry-sea-ac9sj8ie`. Nunca usar endpoints de produção nos testes de escrita. Preservar branch remota a cada marco. Resultados serão registrados somente após execução.

## Recuperação preservada e ensaio hospedado

- Commits de recuperação enviados ao remoto: 4884750 e 7efbf6f. A branch remota é a fonte desta entrega; hashes locais antigos não foram recuperados.
- Lint/TypeScript/build aprovados e 226 unitários aprovados na execução atual. Sete cenários novos de navegador passaram inicialmente; execução completa (incluindo oitavo cenário de comparação) em andamento. PostgreSQL descartável: 12 grupos aprovados, inclusive quatro novos para RPC/ledger/RLS/rollback.
- Ensaio nativo executado duas vezes após preparação final: Auth/JWT reais, sessões, isolamento de membro externo (lista vazia por RLS), concorrência de cadastro mesma chave, conflito de payload, ledger privado, centavos e replay após exclusão, carteira privada com 1001 registros/total R$10,01/restante R$89,99, acesso da outra conta negado e versão 2026-10-17.2.
- Preparação revelou proprietário BYPASSRLS e schema auth gerenciado. Novo papel restrito e wrapper de identidade foram necessários e versionados; nenhuma configuração correspondente de produção alterada. Uma chamada inicial retornou 403 durante preparação; teste direto e duas execuções completas posteriores passaram. Não se atribui causa definitiva sem evidência.
- Correções de teste: mock do Cofre precisava do serviço de configuração; leitor não membro recebe 200/lista vazia por RLS, não 403; limpeza usa contrato existente da carteira (`id`). Não alterar API para satisfazer suposições do teste.
- Recursos financeiros sintéticos removidos após cada execução aprovada. Ledger conserva confirmação original por projeto; contas/compute/Function de ensaio serão desativados ao fechar a rodada. Scripts novos não contêm credenciais.
- Artefatos locais: /workspace/artifacts/recovered-validation/{unit.log,lint.log,build.log,database.log,browser.log,native.log,native-repeat.log,native-report.json,backend.zip}. Evidência resumida será preservada no repositório.


## Revisão de compatibilidade e fechamento do ensaio

- Candidato final de backend 2026-10-17.3, ensaiado no deployment temporário 3. Cadastro antigo sem chave continua funcionando pela mesma RPC com chave gerada no servidor e idempotent=false; o frontend novo usa chave própria e mantém proteção de replay. Erros legados orientam conferir histórico, sem incentivar repetição cega. Transporte nunca faz fallback para INSERT. Duas regressões unitárias adicionais cobrem esse contrato.
- Ensaio final passou seis grupos, incluindo legado. Pacote nativo SHA-256 `740a22a15e0c777ce51db06f2ea4f6c19f34834cbda2b393bbf6844daedb3a27`. O empacotador versionado `scripts/package-backend.py` produz ZIP determinístico; identidade de fonte foi comparada com o ZIP realmente ensaiado e coincidiu. Hashes/evidência em `validation/RECOVERED-NATIVE-20261017.json`.
- A verificação global encontrou um gasto sintético da primeira chamada falha, antes do rastreamento de IDs. Foi removido por ID exato no clone; SQL posterior confirmou zero gastos compartilhados/pessoais e carteiras sintéticas restantes. O script registra IDs antes de validar respostas concorrentes, evitando repetir essa falha de limpeza. Ledger de confirmações é mantido por definição; membros de teste permanecem inativos. As três contas Auth sintéticas foram excluídas e as sessões encerradas; Function temporária removida e compute confirmado idle. Credenciais locais temporárias removidas.
- Segunda revisão da reconstrução: uma substituição ampla cortava futuros também no risco de orçamento. Regressão nova mostrou "Nenhuma categoria atingiu 70%" apesar de R$600 de R$700 já registrados. Corrigido para 86% no orçamento; comparativo continua 0,0% no corte equivalente de R$100/R$100. Teste falhou antes e execução integral final está sendo concluída após a correção. Nenhum lançamento ou total mensal foi removido.
- Manifesto passa a pending-promotion: validação hospedada concluída, produção ainda não promovida. Não confundir deployment temporário 3 com o deployment 26 ativo de produção.

## Promoção futura e limites

Antes de promover: CI/revisão da branch exata; backup novo sem compute; preparar role/políticas e aplicar somente migrações novas na ordem 00/requests com executor correto; publicar backend do pacote validado preservando as variáveis/chave existentes (nunca copiar a chave aleatória do ensaio); verificar versão/permissões; registrar deployment de produção no manifesto e só então promover frontend pelo workflow com arquivo de rollback. Rollback padrão troca frontend e conserva backend/ledger/histórico; compatibilidade com cadastro antigo foi exercitada no clone.

Safari/iPhone físico e chamada real a Gemini/DeepSeek não executados. Associação local de envio incerto ainda se perde no reload, e novas chaves/INSERTs diretos não são deduplicados. Projeções são heurísticas; demais agregadores legados e vínculo de recorrência permanecem no backlog. Nenhuma dependência nova ou migração destrutiva.

## Arquivos desta recuperação

- `backend/README.md`
- `backend/index.mjs`
- `backend/routes/expenses.mjs`
- `backend/routes/wallets.mjs`
- `backend/services/expense-operation.mjs`
- `css/app.css`
- `db/migrations/20261017_00_expense_rpc_owner.sql`
- `db/migrations/20261017_expense_requests.sql`
- `docs/AI-AUDIT.md`
- `docs/AI-BACKLOG.md`
- `docs/AI-DECISIONS.md`
- `docs/AI-PROGRESS.md`
- `docs/PROJECT-STATE.md`
- `docs/validation/RECOVERED-NATIVE-20261017.json`
- `index.html`
- `js/app.js`
- `js/core/behavior-engine.js`
- `js/core/calendar.d.mts`
- `js/core/calendar.js`
- `js/core/calendar.mjs`
- `js/modules/dashboard.js`
- `js/modules/expenses.js`
- `js/modules/radar.js`
- `js/modules/recurring.js`
- `js/modules/settlements.js`
- `release/production.json`
- `scripts/package-backend.py`
- `scripts/test-financial-db.py`
- `scripts/test-recovered-native.mjs`
- `src/app/legacy-bridge.ts`
- `src/features/wallets/contracts.ts`
- `src/features/wallets/controller.ts`
- `sw.js`
- `tests/recovered-finance.test.mjs`
- `tests/recovered-workflows.spec.mjs`


## Resultado final — execução concluída

| Verificação | Resultado observado |
|---|---|
| npm run lint (TypeScript/Prettier/contratos/sintaxe) | Aprovado |
| npm run test:unit | 228 aprovados, zero falhas |
| npm run build | Aprovado |
| Playwright integral final, Chromium, 3 workers | 178 aprovados em 4,2 minutos, zero falhas |
| npm run test:db, PostgreSQL 17 descartável | 12 grupos aprovados |
| Ensaio hospedado final, backend 2026-10-17.3 | 6 grupos aprovados; Auth/JWT/Data API/RLS reais, concorrência, legado e carteira de 1001 registros |
| Pacote reproduzido versus pacote nativo | Identidade de fonte idêntica |
| git diff --check | Aprovado |

A suíte final de navegador passou após a correção do orçamento; a falha reproduzida antes dessa correção permanece registrada em budget-before.log. Backend final foi coberto pelos unitários e pelo ensaio nativo; sem mudança de código de runtime após esses resultados, exceto o ajuste de frontend expressamente revalidado pela suíte completa. Credenciais não fazem parte de commits ou artefatos públicos.

Commits funcionais preservados remotamente: 4884750 (reconstrução), 7efbf6f (regressões/papel nativo), 8a899d0 (compatibilidade de legado e script hospedado), 1807983 (orçamento mensal). O commit de fechamento acrescenta somente empacotamento/documentação/evidência e gate pending-promotion. Nenhuma promoção automática foi habilitada, nenhum backend de produção foi atualizado e nenhuma migração foi aplicada à produção.

## Promoção autorizada — infraestrutura confirmada em 17/10/2026

Backup novo sem compute `br-green-meadow-acy0qmvw`; duas migrações novas aplicadas atomicamente com papel restrito. Assinaturas de quatro tabelas financeiras intactas. Backend deployment 28, versão pública 2026-10-17.3 e gate de proteção/CORS aprovados, variáveis/chave preservadas. Lint/tipos/build e 228 unitários reexecutados e aprovados. Frontend aguarda CI exata e workflow de produção no PR #18; rollback previsto prod-731df889b83f. Registro: `PRODUCTION-RELEASE-20261017.md`.

## Publicação e validação final concluídas

Frontend público `prod-b84274b994c5`, backend 2026-10-17.3/deployment 28, rollback frontend `prod-731df889b83f`. CI exata main, promoção e Pages aprovados. Quinze arquivos públicos com hashes corretos e login aprovado em quatro larguras, sem erros JS/overflow e com foco/ESC corretos. Nenhuma escrita financeira de teste em produção. Evidência: `validation/PRODUCTION-20261017.json`; relatório atualizado `PRODUCTION-RELEASE-20261017.md`. Fechamento versionado em branch operacional separada para não gerar novo deploy de documentação. Próxima prioridade: recuperação segura da tentativa incerta após reload.

## Workspace interativo — 18/10/2026

Implementados contexto Casa/Pessoal e atalhos, superfícies definidas, resumo de saldos sem repetição nas métricas, indicadores clicáveis e inspector adaptativo. Dados de responsabilidade, despesas pagas e transferências permanecem separados; métodos não são compensados. Chat recebe pergunta/contexto do acerto sem enviar e protege rascunho existente. Backend/dados/produção intactos.

Detectados e corrigidos durante validação: atalhos locais concorrendo com seleção da navegação móvel, regra de grid compartilhada com seção legada causando 3 px de overflow em 320 px e marcação de parágrafo dentro de botão. Expectativas visuais de raio/cor/quantidade de métricas atualizadas para o novo design, mantendo verificações financeiras e funcionais.

Resultados: lint/TypeScript/build; 228 unitários + 188 cenários na suíte integral, aprovados. Após ajuste semântico, 46 cenários afetados aprovados. CI 39089267903 do código 3968f70: 228/188/12 grupos PostgreSQL aprovados. Sessenta capturas sintéticas antes/depois, com 30 combinações finais sem overflow/erro JS. Artefatos selecionados e evidência versionados; relatório INTERACTIVE-WORKSPACE-20261018.md. PR #19 em draft para revisão visual; nenhuma promoção de produção. Dispositivo Safari físico e provedores reais seguem não validados.

## Início operacional — 18/10/2026 (revisão da prévia)

A primeira composição foi rejeitada pelo usuário. A revisão substitui o relatório único por Agora, Movimentações e Análises. Saldo, próximas ações e indicadores precedem histórico; busca/paginação de 25 itens e consulta de cada despesa tornam os dados acionáveis. Ação principal mobile em fluxo evita sobrepor valores. Reutiliza controller, filtros, centavos, permissões, rotas e assistente existentes; sem backend, migração, dado histórico ou segredo alterado.

Validação local do código 21c7ff9: lint/TypeScript/build aprovados, 228 unitários e 196 cenários Chromium aprovados integralmente (oito novos). A execução final de navegador usou quatro workers. Falhas intermediárias de seletores/navegação foram corrigidas preservando as asserções, e a suíte inteira foi repetida. Comparação: 72 capturas, 42 combinações finais sem overflow/erro JS; início 32,5% menor no mobile e 40,8% no desktop na mesma fixture sintética. Nenhuma medida substitui teste com usuários reais.

Relatório: OPERATIONAL-HOME-20261018.md; evidência: validation/OPERATIONAL-HOME-20261018.json. PR #19 atualizado, sem merge/deploy de produção. CI do código atual: etapa validate aprovada, navegador ainda em andamento ao registrar; não é declarada conclusão dessa CI. Safari/iPhone físico e provedores reais permanecem pendentes. Próxima prioridade de produto: validar a prévia com o usuário e Safari físico. Backlog financeiro anterior preservado.

## App de gastos e heurísticas — 18/10/2026 (prévia)

Código 1e99294 em feature/spending-first-app, também enviado ao PR #19. Gastos precedem acertos; atalhos compactos, aviso localizado e causas distintas de indisponibilidade. Ausência de rota 404/501 indica atualização pendente; nenhuma dívida desconhecida é mostrada como zero. Leitura do mês acompanha filtros e converte as datas da Casa para ISO.

Motor explicável de concentração, valores atípicos e recorrências implementado no contexto do assistente; sem nova dependência, migração ou chamada real a provedor. Sua ativação no chat hospedado depende de publicar backend após ensaio isolado validado. Futuro fluxo de captura, inbox privada, conciliação e critérios em PAYMENT-AUTOMATION-ROADMAP.md.

Validação final local: lint/TypeScript/build, 236 unitários e 203 testes Chromium aprovados. CI exata 39092963207 também aprovada: 236 unitários, 203 cenários e 12 grupos PostgreSQL. Oito unitários e sete cenários novos. Rodada intermediária teve dois testes com reload afetados por recriação de dist durante outro build; repetida integralmente com build estável, sem relaxar as asserções. Capturas: 84 antes/depois, 42 combinações finais sem overflow horizontal ou erro JavaScript. Fixtures sintéticas; Safari físico/provedores reais pendentes.

Health público confirmou prévia 2026-09-19.10, produção 2026-10-17.3. Não foram consultados pagamentos usando sessão real. Clone exploratório da Function não comprovou isolamento do banco financeiro; Function herdada removida e compute confirmado idle. Não conectado ao frontend. Backend da prévia permanece antigo até preparar infraestrutura correta; nenhuma alteração de produção ou histórico. Relatório: SPENDING-FIRST-20261018.md; evidência: validation/SPENDING-FIRST-20261018.json. Próxima prioridade: ambiente de prévia compatível e isolado antes de disponibilizar o chat aprimorado e validar integrações reais.
