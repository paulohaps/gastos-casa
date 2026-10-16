# Gastos Casa 2.0 — Fase 2: frontend premium

## Entrega e arquitetura

Implementação sobre React/TypeScript/Vite existentes, orientada por `FINANCE-20-PHASE-1-AUDIT.md`. Nenhuma dependência JavaScript adicionada. Inter variável local, com licença OFL distribuída, fallback e `font-display: swap`; o build publica uma única cópia do arquivo de fonte. Portais, URLs/hash, APIs, autenticação, Cofre, histórico, orçamento, scanner, voz e chatbot existentes permanecem integrados.

Não foi alterado backend, banco, segredo ou dado histórico. Esta entrega é uma prévia revisável na branch do PR16; não representa liberação de produção.

## Design system e navegação

- `css/theme.css` é a fonte dos tokens. Dark Mode padrão: background #0B1120, surface #151E30, elevated #1C293D, financeiro #16C784, analítico #8B7CF6, atenção #F5B942, despesas #EF646B, texto #F8FAFC e secundário #9CAAC1.
- Troca de paleta aplica primeiro um guard temporário de transições para não interpolar texto/fundo entre temas; interações normais retomam suas animações na próxima pintura.
- Light Mode tem tokens próprios e contraste apropriado. A preferência é local ao navegador, lida antes da primeira pintura, salva e sincronizada entre abas. A troca de tema continua funcionando se o armazenamento local falhar; nesse caso a preferência não é persistida. Tema não contém dados financeiros e não exige persistência de backend.
- Botões verdes usam texto escuro no tema escuro; contraste é medido contra a superfície efetiva. A fonte Inter não depende de Google Fonts/CDN em execução.
- Sidebar recolhível e preferência persistida; os nomes acessíveis permanecem disponíveis com os rótulos visuais recolhidos. Menu de ações Ctrl/Cmd+K preservado; busca sem ação correspondente pode abrir uma pesquisa das despesas do período.
- Header preserva seletor de mês, perfil/sessão e compartilhamento. “Nova despesa” é a ação comum de entrada; em mobile Início/Casa vira um único botão flutuante, acima da navegação, com espaço reservado no fim da página. Assistente conserva composição própria e saída Início, sem sobrepor FAB ao compositor. Sua geometria fixa não recebe animação de translação; o campo aguarda a leitura inicial do histórico antes de permitir edição, preservando o rascunho em falha e a segurança de contexto.
- Filtros ficam recolhidos por padrão em telas pequenas. Modais existentes mantêm foco, teclado, confirmação, geometria de visualViewport e comportamento de gravação; a reformulação interna dos formulários fica na Fase 3.
- As folhas existentes, inclusive a borda do login, foram editadas para usar tokens; regras antigas do Início foram retiradas de `experience.css`, com a nova composição em `dashboard.css`. Não foi adicionada uma camada global de correções de cores sobre os componentes anteriores.

## Dashboard e semântica financeira

Componentes principais: `MetricCard`, `ChartCard`, `FilterBar`, `TransactionList`, `ExpenseDistribution`, `MonthlyTrend`, `BalanceSummary`, `BudgetProgress`, `EmptyState`, `ErrorState`, `LoadingSkeleton` e `QuickExpenseButton`. `DashboardMetrics` e `DashboardPanels` separam grupos visuais; `useDashboardSelection` reúne seletores, e o controller mantém as consultas fora do JSX.

Os quatro indicadores usam as informações que o contrato realmente suporta:

1. **Total de gastos:** soma exata dos registros da seleção, em centavos. Se o Cofre é necessário mas sua consulta falha/está pendente, não publica um total combinado parcial.
2. **Pago por mim na Casa / meus gastos pessoais:** nomenclatura explícita para o valor disponível. Responsabilidade compartilhada permanece indicada como indisponível; não há inferência 50/50 nem renomeação de valor pago como responsabilidade.
3. **Pago pela outra pessoa na Casa:** apenas nomes/valores retornados pela consulta compartilhada autorizada; não consulta nem estima o Cofre de Fernando. Responsabilidade de divisão por pessoa não está confirmada.
4. **Saldo líquido de acertos:** indisponível até existir uma base confiável no servidor. Os pagamentos registrados podem ser consultados separadamente, sem somá-los às despesas. Nenhum novo botão de quitação foi criado na dashboard. Valor malformado com fração de centavo também é indisponível na lista de transações, sem arredondamento silencioso.

A evolução usa o mês selecionado e três meses anteriores, com seleção para navegar ao período. Valores são totais registrados; o mês em andamento pode estar incompleto. Consulta que falhou, valor inválido ou datas fora do período resultam em ponto indisponível, nunca em zero inventado. Zero é usado somente quando uma consulta concluída traz uma lista vazia válida. Os gráficos de categoria abrem o drill-down existente com registros reais e acesso por teclado.

Há histórico recente, comparação entre a Casa e o **Cofre selecionado do usuário atual**, orçamento por categoria, referência mensal do limite pessoal e radar. Limite pessoal é rotulado como referência atual e não como saldo bancário ou limite histórico aprovado. Radar incompleto permanece indisponível; sob filtros, sua contagem do mês completo não é reapresentada como contagem da seleção.

## Filtros e estados

`createFilterStore` guarda categoria, pagador da Casa, tipo, método e texto. O histórico compartilhado reutiliza os filtros compatíveis em ambos os sentidos, via a ponte existente; histórico/limite pessoal abertos pela dashboard usam a carteira e o mês da seleção, em vez de herdar um período antigo do Cofre. Os acertos legados conservam o mês completo, sem reinterpretar dívida por categoria. O mês é a seleção já existente do app; trocar mês invalida fontes e filtros para evitar misturar contextos. Os seletores puros alimentam total, pagos por pessoa, distribuição, evolução, transações e consumo do orçamento.

- “Pagador da Casa” usa o campo `usuario`, não um participante de divisão inventado.
- Método/pagador da Casa excluem gastos pessoais, que não possuem tais campos. Selecionar Meu cofre limpa/desabilita esses controles.
- Tipo Casa/Pessoal/ambos aplica-se aos componentes compatíveis. Comparativo indica quando um escopo está fora da seleção.
- Orçamento é consumo da seleção sobre o limite mensal da Casa; não divide o limite por pessoa nem chama subtotal filtrado de dinheiro disponível.
- Pagamentos de acerto não têm categorias de despesa. Sob categoria/busca, o componente informa que não há correspondência de contrato; método e pagador, quando disponíveis, filtram os registros de pagamento.
- Fonte de orçamento/pagamentos/Cofre tem erro explícito e retry. Falha não vira “Sem meta”, carteira vazia ou saldo quitado.
- As leituras usam AbortController, descartam resposta de contexto antigo e são invalidadas ao trocar sessão. As séries privadas consultam apenas a carteira autorizada selecionada, sem IDs de outros proprietários.

## Integridade e dependências de backend antes de qualquer execução

Esta seção registra a evolução necessária **antes** de mudanças de backend. Nenhum dos itens abaixo foi aplicado nesta fase.

### 1. Operação atômica e idempotente de acerto — bloqueador de produção

O endpoint existente consulta o saldo e insere depois, permitindo duas quitações concorrentes. A garantia precisa estar na fronteira transacional do banco/servidor:

- Chave de operação idempotente por usuário, validação de payload e resultado reproduzível ao repetir a mesma operação; chave reutilizada com conteúdo diferente deve ser conflito.
- Bloqueio/revalidação por competência, casa e método dentro da mesma transação da inserção. Validar e gravar usando centavos/decimal exato.
- Rever grants/RLS e caminho Data API para impedir bypass da garantia ao gravar diretamente na tabela.
- Implantação compatível com clientes existentes, sem apagar/backfill automático de acertos antigos. Preparar migração revisável, recuperação, testes isolados e sequência de rollout antes de produção.
- Lock de botão, lock em memória da Function ou debounce de frontend não são a solução financeira.

### 2. Divisão e responsabilidade

O modelo atual não registra parcelas por participante e o motor duplica uma divisão 50/50 com frações. A evolução deve separar pagador/criador/participantes com IDs, registrar parcelas e regra de divisão em centavos e definir a alocação do centavo residual. A soma das parcelas precisa fechar exatamente. Comparar os resultados históricos antes de adotar a regra; não reescrever responsabilidade de meses passados silenciosamente.

### 3. Paginação / completude

`/months`, `/expenses` e a leitura de `/settlements` precisam percorrer páginas e falhar explicitamente quando não puderem confirmar a leitura completa, seguindo o padrão já usado pelo Cofre/Assistente. Um metadata de completude precisa ser um contrato real do servidor, não um campo fictício colocado pelo cliente.

O novo frontend rejeita a publicação de indicadores quando uma resposta de Casa atinge 1.000 registros e rejeita períodos inconsistentes. Essa defesa **não certifica** a completude do endpoint atual: outros limites de Data API ou uma resposta incompleta abaixo desse tamanho ainda exigem correção no servidor. Não anunciar histórico completo nem promover produção com base apenas nesse guard.

### 4. Infraestrutura e demais contratos

A divergência produção/prévia está registrada na auditoria: rotas de Cofre/configuração IA/histórico de conversa ausentes em produção. Revalidar backend, tabelas/RLS e configuração de criptografia durante preparação do rollout. Novo pagador, Pix/cartão, parcelas, fechamento e limite pessoal histórico continuam dependências de contrato/modelo da Fase 3/4; não foram simulados por formulário ou localStorage.

## Validação e evidências

- `financial-dashboard.test.mjs`: seis casos adicionais para centavos, escopo/método ausente, despesas separadas de pagamentos, período correto e reprodução isolada de dois bloqueadores legados.
- Os testes de meio centavo e dupla quitação são **caracterizações do defeito não corrigido**, não certificados de comportamento financeiro correto. Assertam o resultado observado do código legado e precisam ser convertidos para asserts de segurança quando o servidor/motor forem corrigidos.
- `premium-dashboard.spec.mjs`: tema/fonte/persistência, navegação recolhida, filtros consistentes, privacidade, falha/retry, indisponibilidade por fonte e defesa de paginação; dashboard/FAB em 320/390/768/1440/1920 px nos dois temas; sincronização de filtros com o histórico da Casa, período pessoal e disponibilidade do primeiro envio no chat.
- Todos os 274 cenários existentes mantidos. Expectativas visuais foram atualizadas para Inter, Nova despesa e a paleta do compositor; contraste usa a superfície real do tema, mantendo mínimo de 4,5:1. Medições dos campos de IA aguardam a fonte e ocorrem no mesmo quadro, mantendo os asserts geométricos originais.
- Capturas em `/workspace/artifacts/phase2-premium/`: seis áreas, quatro larguras e dois temas, com fixtures sintéticas de testes, nunca apresentadas como dados reais da aplicação.
- Suíte ampliada: 172 testes unitários e 131 de navegador (303 cenários, incluindo os 274 existentes). A verificação direcionada final de preferência/contraste aprovou os três cenários nos dois temas. Suíte completa local aprovada: 172/172 unitários e 131/131 de navegador, sem falhas. Lint, TypeScript e build aprovados. A CI do PR valida novamente a revisão publicada.

A validação de navegador utiliza Chromium automatizado e APIs simuladas com fixtures sintéticas. Não certifica Safari/iPhone físico, chamadas pagas aos provedores ou integrações autenticadas de produção. Os diálogos existentes continuam cobertos pela suíte de limites/foco.

## Próximos passos — Fase 3

Migrar formulário/tabela da Casa por componente para React, preservando contratos e revisão antes de salvar. Priorizar valor/descrição e detalhes progressivos, filtros/ordenação do histórico e feedback de gravação. Separar identidade do pagador de autoria somente após definir a autorização real. Preparar a correção atômica/idempotente e o núcleo único de divisão antes de disponibilizar novos fluxos financeiros em produção.

## Arquivos alterados nesta entrega

- `css/app.css`
- `css/chat.css`
- `css/dashboard.css`
- `css/experience.css`
- `css/shell.css`
- `css/theme.css`
- `docs/FINANCE-20-PHASE-1-AUDIT.md`
- `docs/FINANCE-20-PHASE-2-DELIVERY.md`
- `docs/PROJECT-STATE.md`
- `fonts/Inter-LICENSE.txt`
- `fonts/InterVariable.woff2`
- `icons/app-192.png`
- `icons/app-512.png`
- `icons/app.svg`
- `index.html`
- `js/app.js`
- `js/core/financial-selection.d.mts`
- `js/core/financial-selection.mjs`
- `js/core/theme.js`
- `js/modules/expenses.js`
- `manifest.json`
- `src/app/AppShell.tsx`
- `src/app/CommandMenu.tsx`
- `src/app/usePreferences.ts`
- `src/features/assistant/Assistant.tsx`
- `src/features/assistant/useAssistant.ts`
- `src/features/overview/Overview.tsx`
- `src/features/overview/components/BalanceSummary.tsx`
- `src/features/overview/components/BudgetProgress.tsx`
- `src/features/overview/components/DashboardMetrics.tsx`
- `src/features/overview/components/DashboardPanels.tsx`
- `src/features/overview/components/ExpenseDistribution.tsx`
- `src/features/overview/components/FilterBar.tsx`
- `src/features/overview/components/MonthlyTrend.tsx`
- `src/features/overview/components/TransactionList.tsx`
- `src/features/overview/controller.ts`
- `src/features/overview/filters.ts`
- `src/features/overview/types.ts`
- `src/features/overview/useDashboardSelection.ts`
- `src/shared/ui/ChartCard.tsx`
- `src/shared/ui/MetricCard.tsx`
- `src/shared/ui/QuickExpenseButton.tsx`
- `src/shared/ui/States.tsx`
- `sw.js`
- `tests/build-pwa.spec.mjs`
- `tests/financial-dashboard.test.mjs`
- `tests/premium-dashboard.spec.mjs`
- `tests/v3-experience.spec.mjs`
- `tests/visual-smoke.spec.mjs`
- `vite.config.mjs`
