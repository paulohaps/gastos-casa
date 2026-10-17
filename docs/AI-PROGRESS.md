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
