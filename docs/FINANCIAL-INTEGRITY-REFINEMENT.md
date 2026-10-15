# Integridade financeira e refinamento de uso

## Contrato da alteração de backend (antes da implementação)

Escopo localizado sobre `/expenses`, `/months` e `/settlements`; nenhuma migração/dado em produção será alterado nesta entrega.

- Núcleo único `js/core/settlements.js`, consumido pelo navegador e pelo backend. Valores entram como decimais exatos, são somados em centavos inteiros seguros. Total compartilhado dividido em duas parcelas: PH recebe `ceil(total/2)` centavos de responsabilidade e Fernando o restante. Assim o centavo indivisível é atribuído explicitamente a PH; a soma fecha e a ordem de leitura não muda o resultado. Registros originais não são regravados. Esta regra deve ser comunicada na central de acertos e validada antes da promoção.
- Migração aditiva `20261015_atomic_settlements.sql`: RPC `record_settlement` autenticada, com autorização explícita, `search_path` fixo, valores exatos, lock transacional e revalidação do saldo. INSERT/UPDATE diretos de acertos por authenticated deixam de ser permitidos; exclusão autorizada existente permanece e participa do mesmo lock. Alterações de gastos participam do lock por competência/método para serializar contra a leitura da RPC.
- Idempotência: ledger privado por usuário/chave armazena payload normalizado e resposta. Retry com mesma chave/corpo retorna o resultado confirmado, mesmo após exclusão do pagamento; reutilizar chave com corpo diferente retorna conflito. O cliente conserva a chave durante retry do mesmo payload. Nenhum segredo é persistido nesse ledger.
- O backend passa a usar exclusivamente a RPC para inserir. Ausência da migração gera indisponibilidade explícita, sem fallback para gravação insegura. Frontend pode funcionar com o contrato antigo enquanto a RPC não é publicada; proteção de concorrência só estará ativa no ambiente que receber migração + backend juntos.
- Leituras compartilhadas: paginação por `Content-Range`/offset, ordem determinística e validação do Array; erro explícito se não for possível comprovar completude. Sem assumir que página curta é completa quando o servidor informa limite menor.
- Despesas compartilhadas: validar valor, data real, texto, categoria/método e identidade na fronteira. Manter autoria pela sessão e regras atuais de atualização.

## Implantação

Validar SQL e concorrência em Postgres descartável com fixtures. Antes de produção, repetir em branch isolada do esquema real, conferir RLS/roles/RPC na Data API e versões antigas de cliente. Revisar diferenças de responsabilidade em competências ímpares; não alterar histórico automaticamente. Publicar migração e backend em conjunto, validar com duas sessões, só então promover frontend. Infraestrutura de produção, credenciais, Safari físico e chamada real a provedor continuam pendências distintas.

## Implementação entregue

- Núcleo exato compartilhado entre navegador/servidor; participantes sem regra e valores inválidos geram indisponibilidade, sem descartar dinheiro silenciosamente.
- Router de acertos usa somente a RPC. Uma função de capacidade protegida informa `cents-v1`; sem confirmação, o frontend mantém o histórico, apresenta indisponibilidade e não abre novo pagamento. Retry do mesmo corpo mantém a chave, mudanças no corpo criam outra operação.
- Ledger privado mantém a resposta mesmo após exclusão explícita de um pagamento: retry não recria registro apagado. Reutilização de chave para outro corpo é conflito.
- Paginação compartilhada acompanha limite real por Content-Range ou continua até página vazia; valida envelopes, total, ordem/offset e IDs repetidos. Limite operacional de 100 mil registros resulta em erro, nunca em sucesso parcial. Respostas confirmadas levam `complete: true`; clientes ainda recusam listas longas de servidores antigos sem essa confirmação.
- Fronteira de despesas valida valor, data real, descrição, categoria e método. Acertos com fontes indisponíveis limpam saldos/ações anteriores; comparação, orçamento e radar não confundem falha com ausência de dados.
- SQL testado em PostgreSQL 17 descartável com fixtures, sem rede/portas expostas. Cobertura real: duas quitações simultâneas, replay simultâneo, conflito de payload, replay após exclusão, autorização, acesso direto, RLS do ledger, frações, limite de saldo, competência ímpar e alteração de gasto concorrente. Histórico existente preservado pela migração.

## Refinamento de interface

- Chat: contexto e mês na primeira linha; intervalo e histórico na segunda em mobile. Testes medem colisão interna em 320/390/768/1440 px, incluindo seleção de intervalo e abertura de histórico.
- Cadastro: valor/descrição primeiro na ordem visual e de Tab. Data, pagamento, responsável da sessão e categoria continuam disponíveis antes de salvar. Texto/voz/scanner permanecem em disclosure nativo com opção explícita. Resultado de captura abre a prévia automaticamente.
- Ajustes: conta/preferências primeiro; integrações e automação em disclosures identificados. Navegação interna e atalhos do chat/busca abrem a seção correta e preservam os formulários React.
- Gráfico: alvos HTML de 44px sobre os pontos, com nome, seleção e teclado; mesma ação dos rótulos e do seletor global. Eixo mantém escala tipográfica de 12px na renderização do SVG conforme largura, com notação compacta para valores grandes. Meses sem consulta não viram zero.
- Legendas da dashboard passam a 12px; textos de Ajustes a 13px. Summaries progressivos mantêm área de toque de 48px também no tablet. Sem biblioteca adicional, troca de paleta ou reconstrução das telas.

## Limites de publicação

**Nenhuma migração ou deploy de backend remoto foi executado nesta rodada.** O contrato seguro está implementado e testado localmente, mas ainda depende da validação numa branch do esquema real e promoção coordenada de migração/backend. Até lá, a prévia pode mostrar acertos indisponíveis para gravação, de forma intencional. A existência de um GET 401 protegido não comprova a configuração da RPC ou uma operação autenticada.

As pendências antigas de produção (rotas 404, esquema, criptografia/configuração) permanecem registradas no relatório de prontidão e precisam de revisão no ambiente correto. Não substituir segredos nem copiar chaves da prévia para produção. Safari/iPhone físico, provedor real e teste com usuários continuam pendentes. Reverter uma versão não autoriza restaurar escrita insegura ou apagar o ledger/histórico.


## Validação e evidências da entrega

- 197 testes unitários aprovados, incluindo contratos, paginação, dinheiro exato e ausência de fallback inseguro.
- 158 cenários de navegador verificados: 157 passaram na rodada completa; a nova medição de toque no tablet precisou aguardar o término do carregamento e passou no reteste. Verificações existentes de privacidade, sessão, scanner, formulários, modais, teclado, PWA e integrações foram mantidas. A CI da revisão final deve confirmar a suíte integral.
- `npm run lint`, TypeScript e build aprovados. `npm run test:db` passou com os seis grupos de regressão real em Postgres descartável; não modifica banco externo.
- 48 capturas finais das seis áreas × quatro larguras × Dark/Light, sem overflow horizontal, erro JavaScript ou alvo abaixo de 32px no rastreio heurístico. Isso não substitui uma auditoria WCAG completa ou teste com usuários.
- Comparação independente com cinco pares antes/depois: `/workspace/artifacts/report-refinements/compare.html`; auditoria geométrica em `after/inspection.json`. Fixtures sintéticas, sem dados financeiros reais. Na mesma fixture mobile, Ajustes passou de 2520px para 1649px de altura inicial e o cadastro de 1445px para 1135px. A navegação fixa aparece no primeiro viewport da captura longa e permanece rolável na aplicação.
- Assets `20261015-003`, service worker fonte `v76`. A prévia do PR16 é a superfície de revisão; não houve merge/promoção para produção.

## Arquivos alterados

- `.github/workflows/validate.yml`
- `backend/README.md`
- `backend/index.mjs`
- `backend/data/rows.mjs`
- `backend/data/validation.mjs`
- `backend/routes/expenses.mjs`
- `backend/routes/settlements.mjs`
- `backend/settlements/calculator.mjs`
- `css/app.css`
- `css/chat.css`
- `css/dashboard.css`
- `css/settings.css`
- `db/migrations/20261015_atomic_settlements.sql`
- `docs/FINANCIAL-INTEGRITY-REFINEMENT.md`
- `docs/PRODUCTION-READINESS-20261012.md`
- `docs/PROJECT-STATE.md`
- `index.html`
- `js/api.js`
- `js/app.js`
- `js/core/settlements.js`
- `js/modules/budgets.js`
- `js/modules/dashboard.js`
- `js/modules/navigation.js`
- `js/modules/radar.js`
- `js/modules/recurring.js`
- `js/modules/settlements.js`
- `js/modules/smart-entry.js`
- `package.json`
- `scripts/test-financial-db.py`
- `src/app/CommandMenu.tsx`
- `src/features/assistant/Assistant.tsx`
- `src/features/overview/components/DashboardPanels.tsx`
- `src/features/overview/components/MonthlyTrend.tsx`
- `src/features/overview/controller.ts`
- `src/features/settings/Settings.tsx`
- `sw.js`
- `tests/assistant.spec.mjs`
- `tests/financial-boundaries.test.mjs`
- `tests/financial-dashboard.test.mjs`
- `tests/helpers/mock-backend.mjs`
- `tests/report-refinements.spec.mjs`
- `tests/settings-experience.spec.mjs`
- `tests/settlements-route.test.mjs`
- `tests/usability-readiness.spec.mjs`
- `tests/v3-experience.spec.mjs`
- `tests/visual-smoke.spec.mjs`


### Ajuste da inicialização na CI

A primeira execução remota identificou que `pg_isready` pelo socket podia aceitar o servidor temporário usado pela imagem Postgres durante a instalação. O teste descartável agora aguarda TCP em loopback no servidor definitivo, sem publicar portas. Duas inicializações frias consecutivas passaram localmente após a correção. O health do backend preparado passa a identificar a versão `2026-10-15.1`; isso não significa que ela foi publicada em qualquer ambiente remoto.

## Continuação — compatibilidade com a estrutura real

Consultas remotas somente de leitura confirmaram colunas, tipos exatos (`numeric(12,2)`), restrições, índices, políticas RLS, grants e triggers das três tabelas compartilhadas afetadas. Nenhuma linha de `gastos`, `acertos` ou `household_members` foi consultada ou copiada; nenhuma alteração remota foi executada. Não foi criada branch remota: a CLI não estava disponível e o conector oferecia apenas branches com cópia de dados, sem modo schema-only.

`tests/fixtures/financial-schema.sql` versiona o subconjunto estrutural necessário, obtido desses metadados. O teste descartável agora utiliza os campos obrigatórios reais, as políticas de produção e os triggers de identidade; a migração é executada como `gastos_casa_owner`, sem SUPERUSER/BYPASSRLS, proprietário das tabelas compartilhadas. A regressão anterior usava tabelas mínimas e superusuário para preparar a migração.

Os oito grupos de testes Postgres passaram, incluindo dois grupos novos: autorização da função de capacidade/proprietário da RPC sem superprivilégios; RLS da despesa e preservação dos dois triggers de identidade. A CI continua executando esse teste sem conexão com o banco real.

**Limite explícito:** a extensão nativa `pg_session_jwt` fornece `auth.uid()` em produção; o container usa uma função substituta que lê uma identidade sintética de sessão. Esta validação é de compatibilidade estrutural e integridade, não um teste ponta a ponta de JWT/Data API. Nenhum frontend ou backend de execução foi alterado nesta continuação. Permanecem pendentes a validação autenticada na infraestrutura real, a promoção coordenada e a verificação física de Safari/iPhone. Não há autorização nova para publicar em produção.
