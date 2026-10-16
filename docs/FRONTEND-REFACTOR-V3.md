# Plano de reconstrução do frontend — V3

Data: 11/10/2026. Status: em execução; primeira entrega V3 integrada e evoluções do chat concluídas. Migração dos módulos legados permanece aberta.

Pedido: mudar completamente a interface, usando os achados de `VISUAL-AUDIT-20261011.md`. Este plano substitui a composição visual anterior; mantém os comportamentos financeiros, autenticação, privacidade e integração com o backend. A escolha já feita pelo usuário continua sendo **claro e elegante**, com navegação simples e Assistente como chatbot.

## Resultado esperado

Um aplicativo financeiro de leitura rápida: cada tela responde a uma pergunta, apresenta uma ação principal e deixa os detalhes acessíveis quando necessários. A transformação é de composição, componentes e arquitetura; não depende de trocar a cor dos cartões existentes.

O usuário deve conseguir entender o mês, registrar um gasto, encontrar um lançamento, conferir um acerto e conversar com a IA sem conhecer termos técnicos. Não chamar limite de orçamento de saldo bancário, nem reserva planejada de dinheiro transferido.

## 1. Nova direção visual

- Fundo neutro claro, superfícies brancas, texto grafite e uma cor de ação verde-petróleo. Cor de erro/alerta restrita aos respectivos estados.
- Cabeçalho compacto integrado à página: título e contexto, sem um cartão de introdução separado antes de outro cartão com o mesmo título.
- Superfícies com função: resumo financeiro, lista de movimentos, formulário ou análise. Eliminar cartões usados apenas para preencher espaço.
- Tipografia: corpo 16px, informação secundária relevante pelo menos 14px; títulos por volta de 22–28px; valores principais por volta de 28–36px, ajustados com `clamp()`. Não reduzir texto para caber mais conteúdo.
- Escala de espaçamento 4/8/12/16/24/32px. Raio e borda definidos por tokens; sombras discretas apenas quando indicarem sobreposição.
- Controles com área de interação de pelo menos 48px. Ícones SVG locais; ações importantes com rótulos visíveis.
- Celular com uma coluna e cinco destinos na barra inferior. Desktop com navegação lateral e composição em duas colunas onde houver relação entre resumo e movimentos. Largura de leitura limitada; não esticar formulários em telas ultralargas.
- Chat usa layout próprio: cabeçalho curto, contexto, conversa e compositor. A conversa ocupa o espaço disponível.

Tokens propostos para o primeiro protótipo: fundo `#F7F8FA`, superfície `#FFFFFF`, texto `#17212B`, secundário `#536170`, borda `#E1E6EC`, ação `#146C66`. Validar contraste nas combinações efetivamente usadas, inclusive foco e estados desabilitados.

## 2. Mapa de telas e conteúdo

| Área | Pergunta que responde | Primeira região da tela | Detalhes e ações |
|---|---|---|---|
| Início | Como está meu mês? | Resumo compacto da Casa e do Cofre selecionado | Últimos movimentos, uma orientação acionável e acesso ao Assistente |
| Casa | O que gastamos e precisamos acertar? | Total do mês e próximo acerto; período único | Visão geral, Despesas, Acertos e Planejamento com hierarquia comum |
| Cofre | Quanto posso usar sem comprometer meu plano? | Limite restante, reserva e disponível após reserva | Movimentos, meta, ajustar limite e simular gasto |
| Assistente | Como a IA pode me ajudar agora? | Conversa com contexto explícito | Sugestões no vazio; ações revisáveis nas respostas; histórico e exclusão nomeada |
| Ajustes | Como configuro minha conta e a casa? | Lista curta de seções | IA, usuários, regras e qualidade; cada editor aparece quando solicitado |

“Novo gasto” continua sendo ação, sem criar uma sexta aba. Quando o contexto já estiver definido, ele vem preenchido. Quando não estiver, perguntar Casa ou Cofre. Preservar os hashes antigos, como `#carteiras`, por mapeamento para as novas rotas.

### Início

Ordem: título/período → resumos Casa/Cofre → movimentos recentes → uma recomendação. Reduzir a chamada promocional ao Assistente a um acesso contextual. Não repetir toda a análise da Casa nesta tela.

### Casa

- Visão geral: total, divisão/acerto e uma indicação útil. Gráficos aparecem numa seção de análise, sem esticar os cartões de valores.
- Despesas: lista comparável, filtros claros, valor visível e menu de ações por lançamento. Editar, duplicar e excluir continuam disponíveis e nomeados.
- Acertos: destaque para quem paga, quem recebe e quanto; pagamentos registrados vêm abaixo.
- Planejamento: recorrências e limites por categoria, com edição pontual. Evitar renderizar todos os formulários de edição antes do resumo.
- Navegação interna no celular em grade 2×2 consistente; todos os nomes ficam visíveis. Implementar semântica de tabs e teclado se o componente funcionar como tablist.

### Cofre

Composição móvel: seletor de carteira/período → resumo compacto → últimos movimentos → meta → análises recolhidas. A reserva e o disponível após reserva aparecem junto do limite restante.

No desktop: resumo e meta numa coluna; movimentos na coluna principal; análises abaixo. Não reapresentar “Cofre pessoal” e nome de seção em vários cabeçalhos sucessivos.

“Registrar gasto” é a ação principal. “Ajustar limite” e “Posso gastar?” são secundárias. A simulação usa o motor atual e explicita premissas, sem sugerir garantia de saldo bancário.

### Assistente

- Um único seletor de período dentro do contexto do chat; sem seletor global redundante.
- Contexto Casa ou Cofre, com nome completo da carteira acessível mesmo se o controle precisar abreviar visualmente.
- Conversa vazia abre no topo, com título completo e até três sugestões.
- Histórico acompanha o fim somente quando apropriado; não interrompe leitura de mensagens anteriores.
- Compositor permanece acessível com teclado móvel, mensagens longas e safe areas.
- “Apagar conversa” é explícito e confirmado. Não usar “Nova” como nome de exclusão.
- Streaming, parar, tentar novamente e cartões de revisão continuam disponíveis. IA nunca salva despesas automaticamente.

### Ajustes

Tela inicial com quatro seções curtas. Conexão de IA abre editor com presets Gemini/DeepSeek e opção personalizada, sem expor chaves salvas. Usuários e regras mantêm listagem e ações próprias. Qualidade fica como detalhe secundário.

Estado de conexão distingue carregando, conectada, sem chave e falha ao consultar. Uma resposta 503 não pode aparecer como “Não conectada”. Campos têm altura e alinhamento comuns no desktop.

## 3. Formulários, modais e gráficos

### Novo gasto e scanner

Um fluxo compartilhado para Casa e Cofre, com adaptadores para diferenças reais de contrato:

1. Definir ou confirmar destino.
2. Escolher “Descrever gasto” ou “Preencher campos”. Voz e foto ficam junto da descrição.
3. Rever valor, data, categoria e demais campos necessários.
4. Confirmar salvamento e mostrar resultado.

Preservar OCR/QR, importação de comprovantes, regras aprendidas e caminhos manuais. Falha de CDN do scanner permite retry; não impede o lançamento manual.

### Diálogos

Um componente React baseado em `<dialog>`, com título, descrição opcional, conteúdo rolável e rodapé consistente. Desktop com largura limitada; celular com apresentação próxima de uma folha inferior quando houver espaço, sempre respeitando `visualViewport` e safe areas.

Preservar foco inicial, devolução de foco, bloqueio do fundo, confirmação de ações destrutivas e login não dispensável antes de autenticar. Adaptar o comportamento de teclado móvel já implementado, sem perder seus testes. Ações essenciais nunca ficam fora da área visível.

### Análises com aprofundamento

Categoria → lançamentos correspondentes; pessoa → despesas atribuídas; mês → detalhe do período. Exibir total e período do filtro antes da lista. Ter uma alternativa em tabela/lista acessível e botão de voltar que restaura filtros.

Usar os dados autorizados existentes. Onde o backend não oferecer histórico suficiente, indicar a indisponibilidade; não inventar séries nem introduzir novas rotas no primeiro passo. Só acrescentar biblioteca de gráficos se uma necessidade demonstrada não for atendida pela solução atual ou SVG.

## 4. Arquitetura final

```text
src/
  app/
    App.tsx                 # Uma raiz React
    AppShell.tsx            # Navegação e composição
    routes.ts               # Rotas e compatibilidade dos hashes
    SessionProvider.tsx     # Ciclo da sessão
  features/
    overview/
    household/              # despesas, acertos, recorrências, limites, análises
    wallets/
    assistant/
    settings/
    expense-entry/          # revisão, formulário e adaptadores de destino
    scanner/
  shared/
    api/                    # cliente HTTP, erros, contratos e cancelamento
    finance/                # adaptadores dos motores únicos existentes
    ui/                     # componentes e estados compartilhados
    styles/                 # tokens, base e componentes
```

Componentes iniciais: `AppShell`, `PageHeader`, `PeriodPicker`, `Button`, `IconButton`, `Field`, `Dialog`, `ConfirmDialog`, `AsyncState`, `EmptyState`, `InlineError`, `MoneySummary`, `TransactionList`, `ActionMenu` e `AnalysisDetail`.

Estado remoto identificado por sessão, período, destino e carteira, com `AbortController` e descarte por geração. Estado de UI local ao componente responsável. Não introduzir um store global para cada campo de formulário.

Preservar os motores de `js/core` como implementação única durante a transição, usando imports/adaptadores. Conversão futura para TypeScript deve substituir o módulo anterior e manter os mesmos testes; não recriar fórmulas nos componentes.

O cliente HTTP unificado precisa preservar 401/403 → encerrar sessão; 5xx/rede/timeout → manter sessão e permitir retry. Validar fronteiras antes de renderizar ou calcular.

## 5. Sequência definitiva de execução

| Etapa | Entrega concreta | Substituição/remoção | Condição de avanço |
|---|---|---|---|
| 1. Design e fundação | Mockups celular/desktop; tokens, componentes e protótipo navegável de Início/Cofre/Chat | Estilos novos com escopo claro; protótipo separado da renderização vigente | Matriz responsiva da seção 9, estados realistas e boas-vindas completas |
| 2. Shell, sessão e navegação | Uma raiz React, cabeçalho contextual, rotas e provedor de sessão | Migração do shell no `index.html` e responsabilidade de `navigation.js` | Login/logout, links diretos, troca de contexto, Pages e PWA preservados |
| 3. Chat de vários meses e Ajustes | Primeiro contratos e agregação autorizada no backend; depois integração visual, streaming e correções V01/V02 | Substituir estilos/estruturas anteriores; preservar contexto mensal de clientes antigos | Intervalos, histórico, isolamento, presets, retry e privacidade passam |
| 4. Início e Cofre | Resumos compactos, disponibilidade clara e lista próxima | Substituir composição anterior, mantendo motores e contratos | Reserva/simulação/meta, meses e isolamento entre carteiras passam |
| 5. Casa | Quatro subáreas em React com análises por aprofundamento | Aposentar renderização correspondente de dashboard/expenses/settlements/budgets/recurring/radar/insights | Divisão, acertos, edição, recorrências e limites sem perda funcional |
| 6. Entrada, scanner e diálogos | Fluxo compartilhado de lançamento; todos os diálogos padronizados | Aposentar handlers inline, formulários estáticos e uso legado de `AppUI` | Manual/voz/foto/revisão, retry do scanner e teclado/modal passam |
| 7. Consolidação | Remover ponte, CSS e módulos sem consumidores; documentação final | Remover `legacy-bridge.ts` e orquestração legada somente após migrar todos os consumidores | Suite completa, lint, build, CI, PWA e revisão visual da nova prévia |

Os P1 da auditoria têm prioridade sobre o refinamento das áreas seguintes. V03 começa na fundação com ícones locais; a remoção completa da dependência acontece ao substituir os últimos consumidores legados. Não tratar correção parcial como concluída.

Cada etapa troca a implementação anterior da área: nenhum fluxo pode ter dois renderizadores ou dois conjuntos de handlers ativos. A ponte pode existir temporariamente, com responsáveis e consumidores explícitos, mas precisa desaparecer na conclusão.

## 6. Verificação e critérios de conclusão

Base registrada: 159 testes unitários e 70 de navegador passaram na entrega anterior; isso é referência histórica, não resultado desta rodada de planejamento.

Após cada etapa funcional: executar os testes unitários e os testes de navegador dos fluxos afetados; corrigir falhas antes de seguir. Nos marcos de integração e na entrega: `npm test`, `npm run lint` e `npm run build`.

Novas regressões a cobrir:

- Boas-vindas vazias totalmente visíveis em 320/390px; retomada e streaming não quebram rolagem.
- Falha 503 em Ajustes mostra estado desconhecido e retry perto do título; tokens preservados.
- Ações reconhecíveis com CDN bloqueada; alvos de toque padronizados.
- Seletor de provedor/modelo alinhado em 1366/1920px.
- Contexto de mês/carteira único, cancelamento e resposta fora de ordem descartada.
- Meta/reserva e disponível após reserva coerentes nas três superfícies: Cofre, simulador e chat.
- Navegação por hashes antigos, voltar do detalhamento e isolamento de sessão.
- Todos os modais com foco, teclado, safe areas e resize; teste em iPhone físico explicitamente registrado, sem confundir simulação com dispositivo real.
- Estados carregando/vazio/sucesso/erro em cada área, sem dados antigos sob um período novo.
- Build relativo da prévia, atualização/offline do PWA e ausência de handlers duplicados.

Concluído significa cinco áreas na linguagem visual nova, todos os fluxos preservados, Casa e formulários migrados, uma raiz React, CSS antigo e ponte removidos, e verificações aprovadas. Ausência de bugs em qualquer situação não é uma garantia demonstrável; os fluxos e limites validados devem estar documentados.

## 7. Escopo e publicação

Primeira execução visual focada no frontend. A ampliação para leitura de vários meses inclui alterações no backend e nos contratos de conversa, conforme a extensão abaixo; avaliar migração de banco após inspecionar as restrições existentes. Não trocar o provedor de IA. Não incluir nesta refatoração Open Finance, sincronização bancária, pagamentos ou novos produtos de IA. Melhorar utilidade com clareza do orçamento, movimentos rastreáveis, análises detalháveis e ações assistidas já suportadas.

Trabalhar em ambiente/branch de desenvolvimento e publicar prévia isolada para avaliação. Atualizar versão de assets/cache quando necessário. Produção segue a regra de `PROJECT-STATE.md`, após uma entrega concreta e revisão visual.

Próxima entrega de implementação: fundação visual e protótipo navegável de Início, Cofre e Assistente — os três pontos que definem o novo aplicativo — com correções P1 iniciadas e comparação de capturas. Este documento não executa nem publica a reconstrução.


## 8. Identidade 3D, mockups e chat de vários meses

Parte integrante da reconstrução, conforme a direção mais recente do usuário: linguagem moderna com efeitos 3D, mockups e chat capaz de ler vários meses. Ainda é planejamento, não funcionalidade publicada.

### Aparência e movimento

- Cartão principal do Cofre com profundidade em camadas, luz suave e gradiente discreto. Valor, rótulos e botões permanecem legíveis e estáveis.
- Símbolo do Assistente com volume, usado na apresentação vazia e em detalhes de identidade; mensagens não precisam de ornamentação repetida.
- Elevação curta de cartões interativos no desktop e feedback de pressionamento no toque. Nenhuma ação depende de hover, inclinação ou animação.
- Transições de aproximadamente 160–240 ms com `transform` e `opacity`, sem loops decorativos permanentes. Respeitar `prefers-reduced-motion`; efeitos de inclinação ficam desativados em toque.
- Compor inicialmente com CSS e SVG locais, sem adicionar uma engine 3D apenas para decoração. Se houver uma ilustração raster, otimizar tamanho e manter informação essencial em HTML.
- Gráficos financeiros continuam planos e comparáveis: profundidade decorativa não deve distorcer barras, escalas ou proporções.

### Entrega de mockups

Antes da migração de todas as áreas, produzir composições de Início, Cofre e Assistente em celular de 390px e desktop de 1440px. Mostrar a identidade 3D, navegação, contexto de período, disponibilidade após reserva e uma resposta do chat com comparação mensal.

Mockups estáticos servem para avaliar composição. O protótipo navegável precisa comprovar legibilidade, navegação, scroll, estados e comportamento em 320px. As imagens podem apresentar dados demonstrativos, claramente identificados; não constituem prova de integração financeira ou de IA.

### Chat moderno

Compositor arredondado com envio nomeado, estado de resposta, parar e retry. Mensagens com hierarquia clara, listas/tabelas legíveis e cartões de resultado: resumo do intervalo, tendência mensal, categorias e acesso aos lançamentos. O estado inicial tem sugestões como:

- “Compare meus últimos três meses.”
- “Qual categoria mais aumentou de janeiro a junho?”
- “Quanto gastei em mercado neste ano?”

No desktop, histórico/contextos podem aparecer em painel lateral; no celular, numa gaveta acessível. Contexto atual permanece explícito. Preservar histórico privado, revisão de lançamentos e exclusão confirmada.

### Período de análise

Controles: **Este mês**, **3 meses**, **6 meses**, **12 meses** e **Personalizado**, com início/fim. Limite inicial de até 12 meses por análise, validado no servidor; comunicar o limite no seletor. Datas em português e intervalo sempre visível acima da resposta.

Perguntas com meses explícitos podem propor o intervalo correspondente num chip acionável; o sistema valida e torna a mudança visível antes de apresentar números. Não deixar o modelo ampliar o escopo silenciosamente. Perguntas sem período usam o intervalo selecionado.

Casa e Cofre continuam separados. O intervalo não autoriza acesso a outra carteira ou a informações pessoais de outro usuário. Meses sem lançamentos recebem indicação “sem lançamentos”; falha de consulta não vira total zero. Se faltar informação para afirmar que o período está completo, indicar a limitação.

### Contratos e backend

**Estado atual confirmado:** `Context` contém um único `month` em `src/features/assistant/contracts.ts`. `backend/services/assistant.mjs` consulta esse mês e o anterior. `backend/services/conversations.mjs` usa mês na chave do histórico. Portanto, leitura livre de vários meses exige trabalho de backend, não apenas um seletor novo.

Evolução proposta:

1. Modelar um período tipado discriminado: mês único ou intervalo inclusivo de meses. Normalizar a entrada antiga com `month` para preservar clientes de prévias anteriores.
2. Validar ordem, formato, intervalo máximo e autorização antes de consultar. Manter paginação e limites de registros; se um limite impedir leitura completa, não fornecer um total parcial como completo.
3. Consultar o intervalo autorizado e calcular totais mensais, categorias, total do intervalo e variações no servidor, usando centavos e os motores existentes. Enviar ao provedor principalmente agregados e apenas detalhes limitados necessários à pergunta.
4. Diferenciar análise histórica de orçamento atual. O limite mensal atual de uma carteira não comprova qual era o limite em meses anteriores; reservas de metas só se aplicam ao mês definido. Não multiplicar limite/reserva atual pelo número de meses para fabricar histórico.
5. Identificar conversas por usuário, destino/carteira e período normalizado. Inspecionar esquema e constraints antes de definir necessidade de migração. Preservar acesso e compatibilidade dos históricos de mês único.
6. Streaming deve informar período e cobertura de dados. Cancelar ao trocar sessão, carteira ou intervalo; respostas atrasadas não substituem a nova seleção.
7. Links de aprofundamento abrem despesas filtradas no período correto. Ações de criar gasto ou simular compra precisam de um mês específico, confirmado/preenchido na revisão, mesmo quando a análise estiver num intervalo.

Arquivos afetados: contratos/hook/componente do Assistente, `src/shared/api/conversation.ts`, cliente API, `backend/routes/assistant.mjs`, `backend/services/assistant.mjs`, `backend/services/conversations.mjs`, testes e eventualmente schema após inspeção. Gemini e DeepSeek continuam usando o adaptador de streaming existente.

### Integração com as etapas e aceite

- Na etapa 1: mockups e protótipo com profundidade, período múltiplo demonstrativo e resposta estruturada. Não apresentar a demonstração como consulta real.
- Na etapa 3: implementar contratos/backend de intervalo e integrar o chat com dados autorizados; aplicar mudanças apenas ao ambiente isolado de prévia.
- Nas etapas 4/5: integrar aprofundamento com Cofre/Casa e filtros de movimentos.
- Na etapa 7: remover compatibilidades internas aposentadas, mantendo a compatibilidade externa necessária às prévias antigas.

Novos testes: dezembro→janeiro, mês inicial/final inclusivos, faixa inválida/invertida/acima do limite, meses sem lançamentos, falha em parte da consulta, paginação, arredondamento, carteira de outro dono, chaves de histórico distintas por intervalo e manutenção do histórico mensal. Cobrir troca rápida de intervalo e cancelamento durante streaming, detalhamento com filtro correto e reserva restrita ao mês da meta. Validar redução de movimento, teclado e desempenho com os efeitos ativos.

Aceite funcional: “Compare meus últimos três meses” retorna números correspondentes ao intervalo visível, calculados pelo servidor e rastreáveis aos lançamentos; não mistura Casa com Cofre nem dados de outras carteiras. Aceite visual: efeitos dão profundidade sem cortar conteúdo, comprometer contraste, deslocar campos ou impedir uso com movimento reduzido.


## 9. Contrato de responsividade e acabamento

Esta seção torna verificável o pedido de um aplicativo supermoderno e responsivo. Os breakpoints são um ponto inicial; ajustar conforme o conteúdo, mantendo os critérios de aceite.

| Faixa inicial | Navegação e composição | Comportamento específico |
|---|---|---|
| 320–767px | Barra inferior, uma coluna, cabeçalho curto | Listas em cartões compactos; nomes completos acessíveis; modais limitados à área visual; contexto do chat pode quebrar linha |
| 768–1023px | Barra inferior; duas colunas somente onde couberem confortavelmente | Cartões em grade sem esticar alturas; campos com largura adequada; diálogo central limitado |
| 1024–1439px | Navegação lateral; resumo e movimentos em colunas | Chat com histórico opcional; formulários mantêm largura de leitura |
| 1440px ou mais | Navegação lateral; conteúdo central com largura máxima proposta de 1280px | Usar espaço para relações entre blocos; evitar cartões e linhas de texto excessivamente largos |

Implementação: CSS Grid/Flexbox com `minmax(0, 1fr)`, limites de largura e `clamp()`; unidades relativas para espaço/tipografia. `100dvh` com fallback onde o chat depender da altura da tela; a altura visual/teclado continua observada nos diálogos e no compositor quando necessário. Evitar duplo scroll no corpo e na conversa. Safe areas entram no espaço reservado à navegação e ações fixas.

### Matriz obrigatória

- Celulares: 320×568, 390×844 e 430×932; paisagem 844×390.
- Tablet: 768×1024 e 1024×768.
- Desktop: 1366×768, 1440×900 e 1920×1080.
- Zoom/texto ampliado: verificar reflow a 200% e largura efetiva de 320px; listas, campos e navegação não podem perder funcionalidades.
- Teclado móvel: simulação automatizada e registro separado da verificação em iPhone físico.
- Conteúdo extremo: nomes de carteira longos, valores altos, muitas categorias, erro longo, conversa longa e nenhuma despesa.

Não basta medir overflow do documento: verificar limites de componentes, campos, menus, rodapé dos modais e elementos focados. Tabelas de análise podem ter rolagem local explícita, mas devem oferecer leitura alternativa e preservar o contexto das colunas.

### Metas de composição

No Cofre em 390×844, com um resumo de dados habitual, o cabeçalho, os valores essenciais e “Registrar gasto” devem estar visíveis; o título da lista de movimentos deve aparecer na primeira tela. No Início, mostrar os dois resumos e acesso aos movimentos sem uma chamada promocional ocupar o espaço principal. Essas metas não obrigam altura fixa nem corte quando houver texto ampliado, alerta importante ou conteúdo longo.

No chat vazio em 320×568, o título e a orientação devem estar acessíveis desde o topo e o compositor utilizável; sugestões podem rolar. O teclado não pode encobrir o botão de envio. Em conversa longa, rolagem e seguir a resposta funcionam sem saltos indevidos.

### Acessibilidade e efeitos

Contraste AA: pelo menos 4,5:1 para texto normal e 3:1 para texto grande e componentes relevantes. Foco visível, ordem de tabulação, rótulos, erros associados aos campos e anúncio dos estados. Não anunciar cada fragmento do streaming de forma que torne a leitura pelo leitor de tela impraticável.

Efeitos 3D são progressivos: aplicação totalmente utilizável com movimento reduzido, sem hover e sem ilustrações carregadas. Nada essencial fica apenas em cor, profundidade ou movimento. Nenhum efeito desloca o valor financeiro ou a área clicável sob o ponteiro.

### Performance verificável

Medir antes/depois sob o mesmo perfil móvel, usando o build da prévia. Metas de laboratório: LCP até 2,5s e CLS até 0,1 nos fluxos iniciais; resultados de laboratório não equivalem a métricas reais de todos os usuários. Observar tarefas longas e resposta de interação; não afirmar INP real sem dados de campo.

Carregar scanner/OCR e análises pesadas sob demanda; reservar dimensões de imagens; usar assets otimizados e locais. Não acrescentar uma biblioteca 3D pesada para efeitos de cartão. Documentar variação do bundle e investigar regressão material antes da publicação.

### Pacote de entrega de cada marco

1. Código da área substituída e remoções correspondentes, sem renderização duplicada.
2. Capturas equivalentes em celular/tablet/desktop, com dados e estado identificados.
3. Fluxos funcionais, acessibilidade e falhas cobertos pelos testes pertinentes.
4. Resultados dos comandos executados, limitações e estado de migração atualizados na documentação.
5. Prévia isolada e instruções curtas para conferir a mudança; produção mantém o processo vigente.

A primeira entrega deve demonstrar a nova linguagem visual de verdade: mockups e um protótipo navegável com profundidade, responsividade e chat estruturado. A entrega final exige aplicação integrada e leitura multimensal real, não apenas imagens ou dados simulados.


## Marco implementado em 11/10/2026

Fundação visual, shell React compartilhado, Início/Cofre/Assistente integrados e análise multimensal entregues na PR16. Evidências, validação e fronteiras ainda legadas estão em [FRONTEND-V3-DELIVERY.md](FRONTEND-V3-DELIVERY.md). As demais etapas arquiteturais permanecem abertas.
