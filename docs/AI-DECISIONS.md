# Decisões recuperadas — 17/10/2026

1. Preservar arquitetura React/TypeScript/Vite e módulos legados. Reutilizar allRows, cálculo de centavos e fluxo mensal cancelável.
2. Reconstrução a partir da conversa exige novo teste; hashes/contagens perdidos não validam esta branch. Push em cada marco para evitar nova perda.
3. Lista parcial/valor inválido falha explicitamente; não vira saldo zero. Datas de formulário usam calendário local, comparações usam períodos coerentes.
4. Cadastro utiliza ledger por dono/chave e transação única. Não deduplicar por descrição/valor; entradas iguais podem ser legítimas. Replay devolve confirmação original mesmo após edição/exclusão explícita.
5. Tentativa incerta conserva chave em memória, inclusive em reset auxiliar. Mudança silenciosa bloqueada; novo lançamento exige ação explícita. Reload ainda perde a associação e exige conferir histórico.
6. Efeitos auxiliares não invalidam commit financeiro e não repetem em replay. Entrega exatamente uma vez requer outbox, fora desta etapa.
7. O papel hospedado do clone tem BYPASSRLS; o proprietário da nova RPC deve ser dedicado, sem LOGIN/SUPERUSER/BYPASSRLS, com SELECT/INSERT sujeitos a políticas específicas. Não conceder o papel a authenticated. Não alterar o proprietário administrativo existente.
8. O schema auth é gerenciado por cloud_admin; não ampliar seus grants. Wrapper SECURITY DEFINER expense_actor_id executa somente SELECT auth.uid(), com search_path fixo e EXECUTE restrito, sem ler tabelas financeiras. O corpo financeiro e ledger permanecem no papel restrito.
9. Ensaio somente em br-dry-sea-ac9sj8ie e Function gc20releasecheck, sem provedor IA nem dados reais. Endpoints permitidos fixados no script; recursos sintéticos rastreados e removidos.
10. Candidato recuperado 2026-10-17.3 / assets 20261017-002 / cache v81. Manifesto permanece pending-promotion até promoção coordenada; o deployment de ensaio não é deployment de produção.

Referência oficial consultada nesta retomada: https://neon.com/docs/compute/functions/deploy.md (pacote, entrada index.mjs e environment JSON). Nenhuma dependência nova no aplicativo.

11. Preservar contrato de cadastro dos frontends arquivados: quando a chave está ausente, servidor gera UUID e usa a mesma RPC, com idempotent=false. Chave inválida continua recusada; requisições com chave repetida conservam garantia transacional. Legado recebe orientação de conferir histórico em erro; nenhuma tentativa faz fallback para INSERT.

## Workspace — 18/10/2026

- Pedido explícito de evolução visual define esta rodada; backlog financeiro de persistência após reload não é alterado por estética.
- Reutilizar filtros/controller, modal manager, núcleo de centavos, gráficos, rotas e endpoints; inspector somente consulta dados autorizados. Sem nova biblioteca nem migração.
- Invalidar detalhes por período/filtro/fontes relevantes; preservar consulta da Casa diante de carregamentos pessoais irrelevantes. Foco, Escape e viewport pertencem ao gerenciador comum.
- Encaminhar ao assistente contexto e pergunta, nunca disparar chamada ao modelo automaticamente. Confirmar substituição de rascunho e invalidar confirmação após navegação/sessão.
- Atualizar expectativas visuais intencionalmente alteradas sem remover regressões financeiras, de privacidade ou interação. Capturas sintéticas rotuladas; produção preservada para revisão da experiência no PR #19.

## Composição operacional — 18/10/2026

Separar tarefas, histórico e análise em abas locais acessíveis, sem mudar rotas ou filtros globais. Não remover gráficos para encurtar o início. Reutilizar os cálculos e permissões existentes. Manter apenas uma ação principal de cadastro no início mobile, em fluxo; outras áreas preservam seu atalho existente. Paginação local de 25 itens opera sobre a seleção autorizada já carregada, sem inventar contrato de servidor.

## App orientado a gastos e heurísticas — 18/10/2026

1. Preservar arquitetura/rotas e distinguir dado confirmado de dado indisponível. Simplificação de erro não remove a proteção contra dívida falsa nem libera pagamentos sem capacidade atômica.
2. Um aviso persistente por módulo afetado, com retry quando fizer sentido. Não convidar a repetir consulta de rota ausente como se fosse falha de rede.
3. Heurísticas puras e compartilhadas entre leitura visual e contexto do modelo; sem biblioteca extra, decisão de fraude ou criação automática. Análise de categoria ordenada uma vez, com mediana excluindo a própria observação, evitando ordenação por lançamento.
4. Não usar Function clonada sem comprovar isolamento de seus destinos externos. O clone exploratório foi desativado; produção não alterada. Atualizar prévia é pendência operacional explícita.
5. Captura futura exige fonte autorizada e inbox privada transacional. Texto de notificação/comprovante não é confirmação bancária nem autorização para compartilhar.
