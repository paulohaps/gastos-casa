# Gastos Casa — refinamento de Product Design

Referência anterior: `d90052a`, Fase 2. Escopo: composição do frontend existente, sem reconstrução da aplicação, dependências novas, endpoints novos ou alteração do domínio financeiro. A paleta Dark/Light e a fonte Inter foram mantidas: o trabalho muda hierarquia, densidade, navegação e comportamento responsivo.

## Diagnóstico e arquitetura visual

A dashboard repetia quatro cards de métricas e oito cards de análise, todos fechados, com bordas, preenchimentos e espaçamento semelhantes. Descrições, ícones e três atalhos competiam com o total. O gráfico de quatro barras tinha pouco contexto de escala. No celular, essa composição simplesmente empilhava as mesmas caixas. Assistente reservava uma superfície fechada para uma conversa vazia; Ajustes abria quatro grupos de formulários sem uma navegação por assunto.

A nova composição tem quatro níveis: total do período, demais indicadores, análise/histórico e planejamento secundário. Desktop usa profundidade horizontal; mobile prioriza leitura e registro, com controles progressivos explícitos. A dashboard não tem os 12 contornos fechados anteriores: as separações seguem relações de informação, com divisores, não caixas repetidas.

| Área | Decisão implementada |
| --- | --- |
| Métricas | Faixa horizontal aberta, total maior, números tabulares e menor peso nos valores secundários. Sem ícones decorativos, gradiente ou preenchimentos verdes. Uma explicação comum conserva a semântica financeira. |
| Análise | Evolução ocupa a maior largura. Categorias são complementares, com o drill-down original. SVG próprio com escala monetária, grade discreta, valores e navegação por mês. Pontos não são ligados através de falhas de consulta. |
| Movimentações | Tabela HTML com cabeçalhos, data, categoria, pagador/destino e valor alinhado à direita no desktop. No mobile, descrição e metadados são condensados em lista, sem perder o valor, data ou proprietário. |
| Planejamento | Orçamento, referência do Cofre, pagamentos e radar passam a seções secundárias. Categorias, orçamento e pagamentos têm expansão explícita no celular; continuam abertos inicialmente no desktop. |
| Filtros | Faixa compacta desktop. Bottom sheet nativo em portal na raiz do documento no mobile, com rascunho, Aplicar/Limpar, cancelamento por ESC, retorno de foco e liberação do scroll ao mudar de viewport. Busca continua junto do histórico. |
| Navegação | Header mais curto, sidebar sem CTA verde duplicado e navegação ativa neutra. Nova despesa permanece destacada em Início/Casa; nas demais áreas tem prioridade secundária. FAB e conteúdo reservam espaço para a navegação inferior. |
| Assistente | Conversa na superfície do aplicativo, sem card externo. Contexto compacto, sugestões por escopo/intervalo, compositor junto das sugestões no estado vazio e persistente durante a conversa. Histórico navega pelas perguntas salvas do contexto atual. |
| Respostas | Títulos/listas preservados; suporte a tabelas textuais, com scroll interno quando necessário. React renderiza strings, nunca HTML do modelo. Indicadores/gráficos calculados existentes continuam usando o contrato real de análise. |
| Ajustes | Um cabeçalho, navegação interna desktop e seletor de assunto no mobile. Integrações, conta, participantes, aparência, catálogo, privacidade e automação separados por assunto. Integração IA extraída para componente próprio. |
| Cofre e Casa | Cabeçalhos abertos, menos caixas internas, saldos com maior contraste tipográfico, abas mais compactas, listas/divisores e acertos com ações de prioridade diferente. Formulários e ações existentes continuam acessíveis. |

## Integridade, estados e contratos

- Valores pagos continuam rotulados como pagos. Não foram transformados em responsabilidades. Saldo líquido não confirmado permanece indisponível; explicação acessível em “Sobre os indicadores”. Pagamentos não são somados às despesas.
- Consultas, filtros, cancelamento, centavos, permissões e histórico da Fase 2 foram preservados. O Cofre de outro proprietário não é consultado.
- O aviso mensal compartilhado mantém os IDs `monthStatus`/`monthRetry` e a mensagem real da API. Em falha de rede, existe um único aviso persistente; loading/empty da dashboard têm apresentação própria. O erro da dashboard permanece para falhas de integridade. O estado de erro tem papel de alerta, sem permanecer simultaneamente em carregamento.
- A atualização do nome da conta acompanha a sessão restaurada por um evento de identidade, sem ler tokens ou duplicar persistência de dados pessoais. A limpeza da sessão mantém seu contrato existente.
- Catálogos são somente leitura a partir das opções existentes. Não foi simulada edição de categorias/métodos, perfil, preferências de servidor ou novos níveis de privacidade.
- “Histórico” no chat é o índice da conversa atual, por destino/período. Não foi inventado um endpoint para listar todas as conversas de todos os contextos. Os controles existentes continuam permitindo consultar os históricos autorizados por mês/intervalo.
- A preferência de tema usa o armazenamento já existente; nenhum valor financeiro é salvo no localStorage ou no cache público do service worker.

## Arquitetura do código

`Overview` compõe filtros, disponibilidade e métricas; `DashboardPanels` organiza análise, tabela e planejamento. `MetricCard` vira um componente de leitura sem ícones/tons sem uso. `ChartCard` suporta seções progressivas acessíveis. `useMediaQuery` cuida da mudança de viewport. O controller mantém consultas e estado fora do JSX.

`AiConnection` contém o formulário/estado de IA já existente; `Settings` organiza a página. `ConversationHistory` recebe mensagens e uma ação de navegação; não consulta outra fonte. `response-format.mjs` contém o parser textual puro e tipado por declaração. O checker de contratos agora percorre os componentes TSX, preservando os IDs obrigatórios após a extração do formulário.

CSS foi alterado nas folhas que já possuem os componentes. `settings.css` passa a possuir a composição específica de Ajustes. As regras antigas correspondentes foram retiradas, sem uma folha global de correções sobre o layout anterior. Não há nova biblioteca de animação/gráfico ou pacote de UI.

## Validação

- Base de 303 testes mantida; expectativas visuais de superfície, orientação pelo título e localização da definição financeira foram atualizadas para a composição solicitada, mantendo a verificação funcional. As listas de diálogos incluem o novo bottom sheet, isolado da visibilidade da dashboard por portal: os testes originais de viewport/foco/rolagem passam a examiná-lo também.
- Cinco novos testes unitários do parser: precisão textual, streaming incompleto, HTML/URLs como texto, pipes escapados e estrutura de listas/títulos.
- Nove novos testes de navegador: bottom sheet em 320/390 px, tabela/hierarquia, expansão/drill-down mobile, falhas intermediárias no gráfico, configurações por assunto/tema persistido, histórico/tabela segura no chat, resize com diálogo aberto e erro mensal único com retry.
- Suíte completa local aprovada: 177/177 unitários + 140/140 de navegador = 317, sem falhas. Lint, TypeScript, build e PWA/offline aprovados. A revisão final do PR também passa pela CI.
- Capturas antes/depois: seis áreas × quatro larguras (320/390/768/1440) × dois temas. Capturas adicionais cobrem loading, empty, erro, resposta tabular, histórico e filtros abertos.
- Comparador independente (96 imagens incorporadas; não depende de links externos): `/workspace/artifacts/product-design/compare.html`. Capturas usam fixtures sintéticas determinísticas, claramente distintas dos dados de produção. A aplicação continua conectada às APIs reais, sem dados fictícios adicionados ao produto.
- Contraste da navegação e ação principal, teclado, foco, diálogos, viewport/teclado móvel, privacidade, streaming, erros de sessão/rede e PWA/offline continuam cobertos pela suíte. Animações respeitam movimento reduzido.

## Comparação de composição

Com as mesmas fixtures e o mesmo viewport, a dashboard em 1440 px passou de 2373 para 1938 px de altura; em 390 px, de 3953 para 2230 px. A redução não é critério isolado: campos e dados permanecem acessíveis e os detalhes progressivos têm rótulos explícitos. Ajustes ganhou seções de conta, aparência, catálogo e privacidade e, por isso, aumentou a altura total no mobile; a navegação por assunto evita depender da leitura de todos os formulários.

## Limites e próximos passos

O refinamento não resolve os bloqueadores de backend da auditoria financeira: meio centavo no motor legado, concorrência/idempotência na quitação, paginação compartilhada e divergência de infraestrutura. Não foram executadas migrações nem modificados registros. Produção continua bloqueada por essas dependências.

A validação automatizada usa Chromium e APIs simuladas. Login público da prévia pode ser conferido sem credenciais; dados autenticados reais, Safari/iPhone físico e chamadas pagas Gemini/DeepSeek exigem validação específica. Não há declaração de produção pronta com base em capturas.

Próxima etapa: evoluir o cadastro/tabela legados por componente, sem mudar contratos silenciosamente; resolver as garantias financeiras no servidor antes de expandir divisão e quitação.

## Arquivos desta rodada

- `css/app.css`
- `css/chat.css`
- `css/dashboard.css`
- `css/experience.css`
- `css/settings.css`
- `css/shell.css`
- `docs/PRODUCT-DESIGN-REFINEMENT.md`
- `docs/PROJECT-STATE.md`
- `index.html`
- `js/api.js`
- `js/app.js`
- `js/core/response-format.d.mts`
- `js/core/response-format.mjs`
- `js/modules/navigation.js`
- `js/ui.js`
- `scripts/check-frontend.mjs`
- `src/app/AppShell.tsx`
- `src/features/assistant/Assistant.tsx`
- `src/features/assistant/ConversationHistory.tsx`
- `src/features/assistant/MessageCard.tsx`
- `src/features/assistant/ResponseText.tsx`
- `src/features/overview/Overview.tsx`
- `src/features/overview/components/BalanceSummary.tsx`
- `src/features/overview/components/DashboardMetrics.tsx`
- `src/features/overview/components/DashboardPanels.tsx`
- `src/features/overview/components/FilterBar.tsx`
- `src/features/overview/components/MonthlyTrend.tsx`
- `src/features/overview/components/TransactionList.tsx`
- `src/features/overview/controller.ts`
- `src/features/overview/types.ts`
- `src/features/settings/AiConnection.tsx`
- `src/features/settings/Settings.tsx`
- `src/features/settings/contracts.ts`
- `src/shared/ui/ChartCard.tsx`
- `src/shared/ui/MetricCard.tsx`
- `src/shared/ui/QuickExpenseButton.tsx`
- `src/shared/ui/States.tsx`
- `src/shared/ui/useMediaQuery.ts`
- `sw.js`
- `tests/modal-bounds.spec.mjs`
- `tests/premium-dashboard.spec.mjs`
- `tests/product-design.spec.mjs`
- `tests/response-format.test.mjs`
- `tests/visual-smoke.spec.mjs`
