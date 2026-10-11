# Auditoria visual da prévia — 11/10/2026

Prévia avaliada: https://paulohaps.github.io/gastos-casa/pr-preview/pr-16-afa373d/#carteiras

## Escopo e método

Acessei os arquivos efetivamente publicados na prévia, com Chromium/Playwright. O login foi observado sem simulação; como a prévia exige autenticação, as telas internas foram avaliadas com respostas de API interceptadas e dados de demonstração. Nenhuma conta real, chave de IA ou informação financeira do usuário foi acessada; não houve gravação no servidor.

Foram registradas 51 capturas: seis telas principais em larguras de 320, 390, 1366 e 1920 px, três subabas da Casa, conversa demonstrativa, três modais do Cofre, login e cinco cenários de vazio/erro. A data do navegador foi fixada em setembro para tornar os cenários reproduzíveis. O período exibido não representa um defeito de calendário.

A CDN de ícones foi permitida na avaliação principal e bloqueada em capturas separadas para verificar a degradação. Não houve erro JavaScript de página ou overflow horizontal do documento nos cenários principais. Isso não comprova ausência de todos os bugs: teclado de iPhone físico, leitores de tela e chamadas reais a Gemini/DeepSeek não foram avaliados nesta rodada.

Evidências: [medições](/workspace/artifacts/visual-audit-20261011/measurements.json), [sondagens geométricas](/workspace/artifacts/visual-audit-20261011/probes.json) e [estados de vazio/erro](/workspace/artifacts/visual-audit-20261011/states.json).

## Diagnóstico

A direção clara, com cartões brancos e verde-petróleo, já dá unidade ao produto. O principal problema é a composição: cabeçalhos repetidos, resumos altos e muitos blocos em sequência atrasam o acesso às ações úteis. Casa ainda tem uma linguagem mais densa que Cofre e Ajustes. O Assistente tem uma falha concreta na apresentação inicial, e os estados de erro precisam comunicar melhor o que está indisponível.

Prioridades deste relatório: **P1** = falha de apresentação ou identificação de estado/ação; **P2** = consolidação de layout e usabilidade. São prioridades desta auditoria visual, não uma afirmação de que a auditoria técnica anterior deixou de ser executada.

## Melhorias por aba

| Aba | O que manter | O que aprimorar primeiro | Evidência |
|---|---|---|---|
| Início | Resumos separados de Casa e espaço pessoal; superfícies com fundo | Cabeçalho menor, resumo do mês mais direto e últimos movimentos antes da chamada extensa ao Assistente | [Celular](/workspace/artifacts/visual-audit-20261011/resumo-390.png) |
| Casa — Visão geral | Distinção entre gastos, divisão e acertos | Reduzir cartões esticados; colocar gráficos e detalhes em aprofundamento; unificar avisos repetidos | [Celular](/workspace/artifacts/visual-audit-20261011/casa-390.png) |
| Casa — Despesas | Ações com nomes acessíveis e histórico identificável | Aumentar alvos de edição; tornar ações reconhecíveis sem CDN; manter os valores fáceis de comparar | [Celular com ícones](/workspace/artifacts/visual-audit-20261011/casa-acoes-online-390.png) |
| Casa — Acertos | Separação entre despesas e pagamentos | Dar destaque a quem paga quanto a quem; padronizar ações e informações secundárias | [Celular](/workspace/artifacts/visual-audit-20261011/casa-acertos-390.png) |
| Casa — Planejamento | Recorrências e limites por categoria no mesmo destino | Evitar formulário completo seguido de cartões repetindo cada categoria; editar um limite por vez | [Celular](/workspace/artifacts/visual-audit-20261011/casa-planejamento-390.png) |
| Cofre | Limite restante, gastos recentes e análises recolhidas | Resumo compacto, reserva e disponibilidade juntas, melhor uso de colunas no desktop | [Celular](/workspace/artifacts/visual-audit-20261011/carteiras-390.png) · [Desktop](/workspace/artifacts/visual-audit-20261011/carteiras-1920.png) |
| Assistente | Conversa dedicada, sugestões e revisão antes de salvar | Corrigir boas-vindas cortadas; eliminar duplicação de período; explicar melhor a ação “Nova” | [Primeira tela](/workspace/artifacts/visual-audit-20261011/assistente-primeira-tela-390.png) · [Conversa](/workspace/artifacts/visual-audit-20261011/assistente-conversa-390.png) |
| Ajustes | Cartões de conexão, usuários e regras; métricas recolhidas | Alinhar campos no desktop e mostrar falha de conexão perto do título, sem afirmar ausência de chave | [Desktop](/workspace/artifacts/visual-audit-20261011/ajustes-1366.png) · [Erro](/workspace/artifacts/visual-audit-20261011/ajustes-erro-390.png) |
| Novo gasto | Texto, voz/foto e confirmação do resultado interpretado | Um título; escolha clara entre descrição e preenchimento manual; trocar “Smart” por linguagem simples | [Celular](/workspace/artifacts/visual-audit-20261011/lancar-390.png) |

## P1 — Falhas confirmadas

### V01 — Boas-vindas do Assistente cortadas

**Evidência:** em 390 px, a região de mensagens começa em y=319,19, mas o título está em y=264,19. O conteúdo vazio já tem `scrollTop=165`. Em 320 px, `scrollTop=266`, também cortando o título. A primeira tela começa no fragmento “pense no próximo passo.”

**Origem:** [Assistant.tsx](/workspace/gastos-casa/src/features/assistant/Assistant.tsx:129) rola até o fim ao atualizar a conversa, incluindo a conversa vazia. Os espaços de `.chat-welcome` em `css/chat.css` agravam a falta de altura.

**Ajuste:** manter o topo quando não houver mensagens; acompanhar o fim apenas para histórico/mensagens quando o usuário estiver acompanhando a conversa. Compactar a apresentação inicial em telas pequenas sem reduzir a legibilidade.

**Aceite:** em 320 e 390 px, título e orientação inicial aparecem completos na conversa vazia. Retomar histórico e receber resposta progressiva continuam funcionando; ler mensagens antigas não força retorno ao fim.

### V02 — Erro em Ajustes apresentado como ausência de conexão

**Evidência:** com resposta 503, o cartão mostra “Não conectada”, valores padrão de provedor/modelo e um formulário desabilitado. A mensagem acionável fica depois do formulário, abaixo da primeira tela.

**Origem:** [Settings.tsx](/workspace/gastos-casa/src/features/settings/Settings.tsx:36) decide o badge somente por `ai.saved?.hasKey`, sem distinguir carregamento, erro e resposta válida. `useConnection.ts` limpa metadados durante a nova consulta.

**Ajuste:** em erro, mostrar “Não foi possível verificar a conexão” e “Tentar novamente” junto ao cabeçalho. Exibir dados da configuração apenas quando conhecidos. Carregamento, erro e ausência comprovada de chave devem ter apresentações diferentes.

**Aceite:** falha 503 não é apresentada como chave inexistente. O usuário encontra retry na primeira área do cartão. A observação é sobre comunicação visual; não foi constatada exclusão de chave ou sessão.

### V03 — Ações perdem identificação visual quando a CDN falha

**Evidência:** com CDN disponível os ícones aparecem. Com a requisição bloqueada, ações dependentes de Font Awesome na Casa ficam em branco ou perdem sua indicação, incluindo botões de recorrências/pagamentos.

**Origem:** link externo de Font Awesome no `index.html` e ícones `i.fa-solid` em `js/modules/expenses.js`, `recurring.js` e `settlements.js`.

**Ajuste:** usar SVGs locais e rótulos visíveis ou um menu de ações com nomes claros. Preservar os nomes acessíveis existentes.

**Aceite:** bloquear a CDN não torna nenhuma ação indecifrável. Validar visualmente e por teclado. [Comparação com CDN indisponível](/workspace/artifacts/visual-audit-20261011/casa-despesas-390-cdn-indisponivel.png).

## P2 — Composição e usabilidade

### V04 — Cabeçalhos e ações repetidos

No celular, o cabeçalho global ocupa aproximadamente 125 px; algumas telas acrescentam cerca de 168 px de introdução. “Novo gasto” aparece em múltiplos locais no desktop. Assistente tem período global e período próprio, com formatos diferentes; o nome da carteira também pode ficar truncado no seletor.

**Ajuste:** cabeçalho contextual curto, um controle de período responsável pelo contexto visível e uma ação principal por área. No chat, separar rótulo de contexto e nome da carteira. Não esconder controles necessários atrás de ícones sem nome.

**Aceite:** a primeira tela revela informação útil e ação principal, sem repetir título/período. A troca de contexto continua sincronizada com os dados.

### V05 — Casa longa e com hierarquia pouco seletiva

Na largura de 390 px, a Visão geral mede **3222 px**, e Planejamento **2109 px**. Cartões de métricas acompanham a altura do cartão de acerto e deixam áreas vazias. Avisos de recorrência aparecem tanto nos sinais quanto no radar. As subabas quebram em duas linhas, deixando Planejamento isolado.

**Ajuste:** resumo curto de total e acerto, participantes em detalhes, gráficos como aprofundamento e aviso único com próxima ação. Organizar subabas em uma grade 2×2 consistente no celular ou alternativa que preserve todos os nomes. Em Planejamento, mostrar limites como lista e abrir edição por categoria; chamar essa área de “Limites por categoria”, diferenciando da meta pessoal.

**Arquivos:** `index.html`, `js/modules/dashboard.js`, `settlements.js`, `radar.js`, `insights.js` e regras `.metric-grid`/`.house-tabs` em `css/app.css`.

**Aceite:** total, próximo acerto e acesso às despesas são encontrados sem atravessar gráficos. Um mesmo problema de recorrência não gera dois avisos equivalentes. Nenhum nome de subaba fica cortado.

### V06 — Cofre ainda demora a chegar aos movimentos

A tela mede **2740 px** no celular com os dados demonstrativos. No desktop, grandes cartões ocupam a largura inteira em uma sequência vertical; o resumo poderia dividir espaço com movimentos. O valor protegido pela meta fica distante do limite restante.

**Ajuste:** resumir limite, gasto e referência diária; aproximar a meta do resumo; colocar movimentos cedo. No desktop, testar resumo/meta numa coluna e movimentos na outra, preservando largura de leitura.

**Clareza financeira:** R$ 836,10 é o limite restante; R$ 250,00 estão protegidos pela meta; R$ 586,10 ficam livres no orçamento. A referência diária de R$ 65,12 considera a reserva. Os cálculos estão coerentes; a oportunidade é mostrar essa relação perto do valor principal. Nenhum desses números deve ser chamado de saldo bancário.

**Arquivos:** `src/features/wallets/Wallets.tsx`, `controller.ts` e estilos do Cofre. Preservar o motor financeiro único.

**Aceite:** o usuário distingue limite restante e disponibilidade após reserva sem procurar outro cartão. Gastos recentes ficam próximos ao resumo, e análises continuam opcionais.

### V07 — Ações pequenas e textos secundários muito reduzidos

Botões duplicar/editar/apagar da Casa medem **34×34 px**, separados por 3 px. Estão dentro da tela, mas são pouco confortáveis para toque. O rodapé do chat usa 11 px para explicar retenção e exclusão.

**Ajuste:** adotar os 48 px de área de toque previstos no projeto, com espaçamento suficiente. Ações secundárias podem ir para menu com rótulos. Usar texto maior para instruções necessárias ao uso, sem ampliar todos os títulos.

**Precisão:** 34 px não caracteriza, por si só, violação do mínimo de 24 px da WCAG 2.5.8 AA. A recomendação atende ao padrão do projeto e ao público com pouca familiaridade tecnológica.

### V08 — Campos de Ajustes desalinhados no desktop

Em 1366 px, o seletor de provedor mede **62,20 px** e o de modelo **48 px**, com diferença de **14,19 px** na posição vertical. No celular ambos medem 48 px. A distribuição do texto auxiliar estica os campos de maneira diferente.

**Ajuste:** alinhar itens da grade ao início, padronizar altura de controles e reservar o texto auxiliar sem esticar o seletor. Revisar `.form-grid`, `.field` e o cartão de conexão.

**Aceite:** em 1366 e 1920 px, os seletores têm a mesma altura e linha de início; descrição longa não altera a altura do controle.

### V09 — Vocabulário e apresentação dos formulários

- Início mostra “1 pontos de atenção na casa”: corrigir singular/plural em `src/features/overview/Overview.tsx`.
- “Nova” no chat apaga a conversa mediante confirmação. Explicitar “Apagar conversa” no destino adequado; preservar a confirmação existente. Não foi observada exclusão silenciosa.
- Novo gasto repete título e apresenta descrição inteligente e formulário manual em sequência. Usar uma escolha explícita entre “Descrever gasto” e “Preencher campos”, com a opção manual sempre acessível.
- Trocar “Smart” por uma descrição em português que explique texto, voz ou foto.
- Períodos aparecem como `2026-09`, `09/2026` e campo nativo com mês em inglês no ambiente de teste. Padronizar o texto de contexto em português; campos nativos podem variar conforme navegador/sistema.

**Aceite:** cada tela tem um título principal, nomes claros de ação e período compreensível. O fluxo de revisão antes de salvar permanece obrigatório.

### V10 — Estados de erro visualmente diferentes entre telas

Casa mostra erro acima do cabeçalho; Cofre apresenta painel persistente e toast para a mesma falha; Ajustes posiciona retry depois de um formulário longo. No vazio da Casa, muitos espaços de gráficos continuam ocupando a página.

**Ajuste:** compartilhar apresentação de carregamento, vazio e erro: título, orientação curta e ação local. Evitar toast redundante para falha já explicada na tela. Recolher gráficos sem dados, preservando informações úteis de recorrência/acertos.

**Aceite:** erro é persistente e retry está próximo da região indisponível. Não reaparecem dados de outro mês. Vazio oferece uma ação adequada sem parecer carregamento ou erro.

Evidências: [Cofre vazio](/workspace/artifacts/visual-audit-20261011/cofre-vazio-390.png), [Cofre erro](/workspace/artifacts/visual-audit-20261011/cofre-erro-390.png), [Casa vazia](/workspace/artifacts/visual-audit-20261011/casa-vazia-390.png), [Casa erro](/workspace/artifacts/visual-audit-20261011/casa-erro-390.png).

## Modais e login

Os três modais do Cofre avaliados — meta, gasto pessoal e simulação — ficaram dentro da tela em 390 px. O login também permaneceu contido. Não foi reproduzido um modal fora do limite nesta rodada; a interação com teclado físico móvel continua pendente.

Melhorias: padronizar apresentação de período e moeda, diminuir explicações repetidas e manter instruções financeiras essenciais. A remoção da meta deve continuar secundária e confirmada. A reserva precisa continuar identificada como planejamento do orçamento, sem sugerir transferência ou poupança real.

Capturas: [Meta](/workspace/artifacts/visual-audit-20261011/modal-meta-390.png), [Gasto pessoal](/workspace/artifacts/visual-audit-20261011/modal-gasto-pessoal-390.png), [Simulação](/workspace/artifacts/visual-audit-20261011/modal-simulacao-390.png), [Login](/workspace/artifacts/visual-audit-20261011/login-390.png).

## Ordem sugerida de execução

1. Corrigir V01–V03 com testes de regressão para conversa vazia, erro 503 em Ajustes e CDN indisponível.
2. Consolidar cabeçalho e controles, corrigir alinhamento dos campos e ampliar alvos de toque.
3. Reorganizar Casa e Cofre: primeira tela enxuta, movimentos cedo, análises por aprofundamento.
4. Uniformizar linguagem, formulários, modais e estados vazios/erro.
5. Comparar capturas em 320/390/1366/1920 px; validar teclado e rolagem em iPhone físico; executar suíte completa, lint e build antes de publicar nova prévia.

Esta rodada produz diagnóstico e evidências. Nenhum ajuste de código, deploy ou alteração de produção foi realizado.
