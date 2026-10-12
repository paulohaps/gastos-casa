# PROJECT STATE — Gastos Casa

Este arquivo é a referência operacional contínua do projeto.

Antes de qualquer nova rodada, alteração visual, refatoração ou correção, ler este documento junto com os documentos da rodada atual.

---

## 1. Estado atual

### Arquitetura
- Frontend estático/PWA.
- Backend separado.
- Uma raiz React para shell, Início, Cofre, Assistente e Ajustes; portais mantêm os pontos de montagem do shell.
- Casa, scanner e orquestração de sessão/despesas ainda usam módulos legados, com ponte explícita.
- `app.js` atua principalmente como orquestrador.
- Utilitários compartilhados em `js/core/utils.js`.
- Funcionalidades específicas em `js/modules/`.

### Navegação atual
Experiência V3 integrada: Início, Casa, Cofre pessoal, Assistente e Ajustes.
Casa possui Visão geral, Despesas, Acertos e Planejamento.
Novo gasto é uma ação com escolha entre casa e carteira pessoal.
A configuração individual de IA fica em Ajustes.

Branch atual: `feature/personal-wallets-efficient-insights` (PR #16 em preview).

---

## 2. Regra obrigatória antes de alterar

Antes de modificar CSS, JS, navegação, PWA ou layout:

1. Ler este arquivo.
2. Ler o documento da rodada atual.
3. Inspecionar as regras existentes antes de sobrescrever propriedades.
4. Verificar herança/cascata CSS.
5. Evitar adicionar regra nova sem conferir regras anteriores do mesmo seletor.
6. Atualizar versão de assets e cache PWA quando houver mudança visível.
7. Validar mobile, especialmente iPhone.
8. Não assumir que uma regra nova substituiu completamente uma regra antiga.

---

## 3. Erros e aprendizados

### 2026-09-19 — Barra inferior móvel deslocada e parcialmente cortada

#### Sintoma
No preview da Rodada 2, a barra inferior móvel:
- ficou deslocada para a esquerda;
- mostrou apenas parte dos itens;
- aparentou largura menor do que o esperado;
- continuou mais alta do que o refinamento pretendia.

#### Causa raiz
A nova regra de layout passou a usar:
- `left: 10px`
- `right: 10px`
- `width: auto`

Porém a regra anterior ainda permanecia ativa com:
- `left: 50%`
- `transform: translateX(-50%)`
- `height: 64px`

A nova regra sobrescreveu `left`, mas não sobrescreveu explicitamente:
- `transform`
- `height`

Resultado:
- o elemento continuou transladado em -50%;
- a barra foi empurrada para fora da tela;
- a altura antiga permaneceu ativa.

#### Correção aplicada
A regra nova passou a declarar explicitamente:

`transform: none;`
`height: auto;`

Também foram refinados:
- altura mínima;
- padding;
- espaçamento;
- posição inferior;
- comportamento para telas menores.

#### Regra permanente
Sempre que um componente existente mudar de estratégia de posicionamento/layout:

- revisar todas as propriedades herdadas do seletor original;
- não alterar somente `left/right/width`;
- verificar também `transform`, `height`, `position`, `display`, `margin`, `inset` e media queries anteriores.

#### Validação obrigatória
Para barra inferior/mobile:
- conferir os 4 itens visíveis;
- conferir centralização;
- conferir safe-area;
- conferir que não cobre cards;
- testar largura <= 390 px;
- testar largura entre 390 e 680 px;
- testar modo PWA instalado e navegador normal.


### 2026-09-19 — Smoke visual desatualizado após navegação em quatro áreas

#### Sintoma
O Validate Gastos passou em sintaxe, unitários, backend e contrato frontend, mas falhou no job visual porque esperava Smart Entry, regras aprendidas e histórico visíveis simultaneamente.

#### Causa raiz
O teste visual ainda refletia a arquitetura de página única anterior à Rodada 2.

#### Correção
O smoke passou a navegar explicitamente:
- Resumo;
- Lançar;
- Mais;
- Movimentações.

#### Regra permanente
Todo teste visual deve respeitar a navegação real do produto. Quando uma rodada altera arquitetura de telas, revisar os testes de visibilidade antes de considerar a rodada concluída.

#### Validação
Os checks devem confirmar cada área no estado em que o usuário realmente a acessa.

---

### 2026-09-19 — Scanner abriu o elemento interno em vez do backdrop

#### Sintoma
Na revisão de código da Rodada 4, o scanner não apareceria apesar de o método `open()` ser chamado.

#### Causa raiz
A classe `hidden` estava aplicada em `#smartScannerBackdrop`, mas o JavaScript removia `hidden` de `#smartScannerDialog`.

#### Correção
O módulo passou a controlar explicitamente o backdrop em abertura e fechamento.

#### Regra permanente
Em componentes modais, identificar qual elemento controla visibilidade antes de manipular classes. Backdrop e painel interno não devem ser tratados como o mesmo estado.

#### Validação
Abrir scanner deve tornar o backdrop visível; fechar deve ocultá-lo e interromper a câmera.

---

### 2026-09-19 — Ações preenchiam componentes ocultos após divisão por páginas

#### Sintoma
Ao clicar em Editar ou Duplicar em Movimentações, os dados eram carregados no formulário, mas nada aparecia para o usuário. O mesmo padrão existia em “Lançar agora” de Recorrentes.

#### Causa raiz
Esses fluxos foram escritos quando o sistema era uma página única. Após a Rodada 2, o formulário manual passou para a view Lançar, mas as ações continuaram apenas preenchendo campos e executando scroll.

#### Correção
Foi criada a função `GastosNavigation.showAndReveal()` para:
- navegar para a view correta;
- aguardar a renderização da view;
- revelar e rolar até o destino;
- controlar foco com segurança em desktop.

Fluxos corrigidos:
- Movimentações → Editar gasto → Lançar;
- Movimentações → Duplicar gasto → Lançar;
- Mais → Recorrentes → Lançar agora → Lançar.

#### Regra permanente
Toda ação entre views diferentes deve navegar explicitamente para a view de destino antes de scroll, foco ou preenchimento visual.

#### Validação
O smoke visual deve testar os fluxos cruzados de navegação em mobile, tablet e desktop.

Documento:
`docs/NAVIGATION-REGRESSION-AUDIT.md`

---

### 2026-09-19 — Interface perdeu unidade visual ao crescer por camadas

#### Sintoma
O sistema passou a transmitir aparência de interface montada por partes:
- muitos cards independentes;
- excesso de cantos arredondados;
- pílulas e badges em excesso;
- componentes com hierarquias diferentes;
- pouca distinção entre informação principal e secundária.

#### Causa raiz
Cada rodada acrescentou refinamentos visuais locais sobre o CSS anterior, sem um sistema visual canônico único.

#### Correção
Foi criado `css/design-system-v1.css` como camada visual oficial, com:
- tipografia nativa;
- raios menores;
- métricas agrupadas;
- menos fundos coloridos;
- menos pílulas;
- tab bar móvel sem item em formato de cápsula;
- hierarquia baseada em tipografia, espaço e divisores.

#### Regra permanente
Nova interface deve obedecer ao Visual System V1 antes de criar um estilo novo.

Documento:
`docs/VISUAL-SYSTEM-V1.md`

---

### 2026-09-19 — Ícone decorativo em bloco arredondado sem função

#### Sintoma
Ícones apareciam dentro de quadrados arredondados grandes, isolados ao lado de títulos e métricas.

#### Problema visual
Esse padrão adicionava um elemento sem função real, criava aparência genérica de dashboard e competia com a informação principal.

#### Correção
O Visual System V1 removeu fundo, contêiner e raio dos ícones puramente decorativos.

#### Regra permanente
Não criar tile, círculo ou quadrado arredondado apenas para abrigar ícone decorativo. Contêiner de ícone só é permitido quando houver função semântica clara, como ação, navegação, status ou categoria.

#### Validação
Revisar novas telas procurando ícones com fundo/caixa sem função. Se a remoção do contêiner não prejudicar entendimento ou interação, o contêiner não deve existir.

---



### 2026-09-19 — Mudança visual extrapolou o pedido e piorou os valores

#### Sintoma
Ao tentar melhorar títulos e organização do Resumo, a Rodada 7 alterou a estrutura dos valores financeiros e deixou a composição pior.

#### Causa raiz
A solução tratou um pedido de polimento visual como oportunidade para reestruturar também a informação financeira.

#### Correção
A estrutura dos valores foi restaurada exatamente ao padrão estável anterior.

A Rodada 7 ficou restrita a:
- títulos;
- botão Atualizar;
- seletor de mês;
- responsividade do cabeçalho.

#### Regra permanente
Pedido de melhoria visual não autoriza mudança estrutural de dados estáveis.

Antes de alterar layout de valores, confirmar que o problema realmente está na estrutura dos dados e não apenas em tipografia, espaçamento ou controles.

---
### 2026-09-19 — Conteúdo do Resumo vazava para outras abas

#### Sintoma
Ao abrir Movimentações, Lançar ou Mais, o bloco financeiro do Resumo continuava visível.

#### Causa raiz
A navegação identificava a seção financeira pelo nome da classe `.metric-grid`. Na primeira tentativa da Rodada 7, o layout foi renomeado para `.summary-overview`, mas esse novo seletor não foi registrado como pertencente à view Resumo.

#### Correção
- seções do Resumo passaram a declarar explicitamente `data-app-section="resumo"` no HTML;
- o módulo de navegação reconhece tanto `.metric-grid` quanto `.summary-overview` como proteção adicional;
- o smoke visual verifica que Resumo fica oculto em Lançar, Movimentações e Mais.

#### Regra permanente
Pertencimento a uma view não deve depender exclusivamente do nome de uma classe visual. Classes de layout podem mudar sem alterar a navegação.

#### Validação
Ao trocar de aba, todos os blocos de `data-app-section="resumo"` precisam estar ocultos fora do Resumo.

---

### 2026-09-19 — Preview antigo reaparecia por cache do navegador

#### Sintoma
Mesmo após corrigir a branch, o navegador ainda exibia uma versão anterior do PR preview.

#### Causa raiz
A URL do preview era sempre a mesma (`pr-preview/pr-N/`). Em mobile, o navegador podia reutilizar o HTML antigo mesmo com novos assets versionados.

#### Correção
O workflow de preview passou a publicar também uma URL imutável por commit:
`pr-preview/pr-N-SHA/`.

#### Regra permanente
Para validação visual de uma correção recente, preferir a URL versionada por commit. A URL estável continua disponível, mas pode sofrer cache do navegador.

---


### 2026-09-19 — Mudança visual sem preview validável antes de produção

#### Sintoma
O usuário não tinha como validar visualmente uma rodada antes da publicação no PWA oficial.

#### Causa raiz
O processo considerava testes automatizados suficientes e tratava o preview como etapa auxiliar, apesar de mudanças visuais exigirem validação humana.

#### Correção
O fluxo de release visual passa a ser obrigatório:
1. implementar;
2. validar automaticamente;
3. publicar preview navegável;
4. confirmar que o link abre;
5. usuário valida visualmente;
6. somente depois publicar em produção.

#### Regra permanente
Nenhuma mudança visual deve ser mesclada/publicada no PWA oficial antes de existir um preview navegável e validado pelo usuário.

#### Validação
Antes de qualquer merge visual, conferir:
- pasta de preview existe na gh-pages;
- GitHub Pages concluiu o deploy;
- link foi entregue ao usuário;
- usuário aprovou visualmente.

---

## 4. Histórico de rodadas

### Rodada 1 — Foundation / Modularização
Objetivo:
- consolidar arquitetura;
- reduzir duplicação;
- centralizar utilitários;
- preparar base para novas funcionalidades.

Documento:
`docs/ROUND-1-FOUNDATION.md`

### Rodada 2 — Navegação
Objetivo:
- separar a experiência em Resumo / Lançar / Movimentações / Mais;
- reduzir a página longa;
- preservar regras de negócio existentes.

Documento:
`docs/ROUND-2-NAVIGATION.md`

### Rodada 3 — Smart Entry 2.0 / Contrato V4
Objetivo:
- unificar texto e voz no mesmo contrato;
- separar estabelecimento da descrição;
- expor confiança geral e por campo;
- preparar o mesmo pipeline para câmera, QR e cupom.

Branch:
`feature/round-3-smart-entry-v2`

Documento:
`docs/ROUND-3-SMART-ENTRY-V2.md`

Regra permanente:
- câmera/QR/cupom não devem criar um pipeline paralelo;
- toda nova entrada deve convergir para o contrato Smart Entry V4 antes da confirmação.

### Rodada 4 — Scanner Inteligente V1
Objetivo:
- adicionar QR/NFC-e e cupom por câmera;
- processar OCR localmente;
- manter a foto fora do backend;
- convergir para o Smart Entry V4;
- preservar confirmação humana.

Branch:
`feature/round-4-smart-scanner`

Documento:
`docs/ROUND-4-SMART-SCANNER.md`

Regras permanentes:
- foto de cupom não deve ser enviada ao backend na V1;
- OCR entrega texto, não grava despesa;
- QR sem valor explícito não deve gerar valor por inferência fraca;
- cupom com múltiplos valores sem linha de total deve exigir revisão;
- fechar o scanner deve interromper todas as tracks da câmera.

### Rodada 7 — Polimento visual do Resumo
Objetivo:
- padronizar títulos;
- melhorar a ação Atualizar;
- impedir corte do seletor de mês no mobile;
- preservar a estrutura dos valores financeiros.

Branch:
`design/round-7-summary-mobile`

Documento:
`docs/ROUND-7-SUMMARY-MOBILE.md`

### Rodada 8 — Acertos parciais e quitação
Objetivo:
- registrar pagamentos parciais ou integrais sem criar despesas fictícias;
- manter Dinheiro e Vale separados;
- exibir valor original, pago e restante por competência;
- preservar o lançamento manual e os contratos anteriores.

Branch:
`feature/settlements-v1`

Documento:
`docs/ROUND-8-SETTLEMENTS.md`



### Rodada 8 — Behavior Engine V1
Objetivo:
- detectar comportamento financeiro por regras determinísticas;
- comparar mês atual com até 3 meses históricos;
- detectar acima da média, duplicidade, recorrente ausente e crescimento de categoria;
- preparar sinais estruturados para a futura UI de insights.

Branch:
`feature/round-8-behavior-engine`

Documento:
`docs/ROUND-8-BEHAVIOR-ENGINE.md`

Regras permanentes:
- Behavior Engine não deve depender de IA;
- falta de dados não deve ser preenchida por inferência;
- thresholds precisam combinar percentual e valor absoluto;
- UI deve consumir os sinais e não duplicar os cálculos;
- detectores devem priorizar precisão sobre quantidade de alertas.


### Rodada 9 — Insights UI
Objetivo:
- consumir sinais do Behavior Engine;
- mostrar no máximo 4 sinais no Resumo;
- explicar cada sinal em linguagem simples;
- oferecer drilldown de evidências;
- não duplicar cálculo ou threshold na UI.

Branch:
`feature/round-9-insights-ui`

Documento:
`docs/ROUND-9-INSIGHTS-UI.md`

Regras permanentes:
- UI de Insights não recalcula comportamento;
- severidade e prioridade vêm do Behavior Engine;
- máximo de 4 sinais no Resumo;
- detalhes mostram evidência, não opinião;
- sem ícones decorativos em tiles.


### Rodada 10 — Scanner V2
Objetivo:
- extrair melhor metadados de NFC-e;
- reduzir payload bruto de QR;
- tratar portal fiscal/CAPTCHA de forma segura;
- identificar itens do cupom por OCR;
- mostrar prévia antes de seguir para o lançamento.

Branch:
`feature/round-10-scanner-v2`

Documento:
`docs/ROUND-10-SCANNER-V2.md`

Regras permanentes:
- CAPTCHA não é automatizado nem contornado;
- QR sem valor explícito não inventa valor;
- item OCR não substitui total fiscal;
- imagem continua local;
- scanner visual precisa de preview antes de produção.

---

## 5. Convenção de registro daqui para frente

Toda correção relevante deve adicionar uma entrada contendo:

### Data
Quando ocorreu.

### Sintoma
O que o usuário viu.

### Causa raiz
Por que aconteceu.

### Correção
O que foi alterado.

### Regra permanente
O que devemos fazer diferente nas próximas rodadas.

### Validação
Como garantir que não volte.

---

## 6. Checklist rápido antes de qualquer nova rodada

- [ ] Ler PROJECT-STATE.md
- [ ] Ler documento da rodada anterior
- [ ] Conferir branch base
- [ ] Conferir se a branch está atualizada
- [ ] Conferir regras CSS existentes do componente
- [ ] Conferir dependências JS existentes
- [ ] Preservar autenticação e sessão
- [ ] Preservar contratos do backend
- [ ] Atualizar cache/versionamento da PWA
- [ ] Rodar validação automática
- [ ] Testar mobile
- [ ] Registrar novos bugs/aprendizados neste arquivo

---

## 7. Diretriz de produto

O sistema deve evoluir sem perder:
- estabilidade;
- simplicidade;
- velocidade;
- previsibilidade;
- experiência mobile;
- possibilidade de rollback.

Nova funcionalidade não deve justificar regressão de comportamento já estabilizado.


### 2026-09-19 — Rodada 5: documento fiscal assistido

#### Decisão
CAPTCHA de portal fiscal não será automatizado nem contornado.

#### Arquitetura
O scanner cruza QR + OCR localmente, envia somente texto/QR para `/receipts/inspect`, valida chave e consistência, e converge para o Smart Entry V4.

#### Regra permanente
“QR fiscal identificado” não significa “verificado pela SEFAZ”. Só usar linguagem de verificação oficial quando uma fonte oficial tiver sido realmente consultada com sucesso.

#### Privacidade
Foto, OCR bruto, QR bruto e CAPTCHA não são persistidos em `receipt_imports`.

#### Deduplicação
Quando existir chave NFC-e válida, ela é o identificador forte para impedir importação duplicada.

### 2026-10-11 — Carteiras pessoais com heurísticas e explicação opcional por IA

#### Decisão
Gastos compartilhados continuam no fluxo da casa. Carteiras privadas na área Carteiras
possuem orçamento mensal e lançamentos próprios, protegidos por dono e RLS.

#### Eficiência
Regras calculam limite diário, ritmo e cenário de delivery. A IA recebe somente
resumos compactos, sob demanda, com cache e saída limitada a 180 tokens.
Sem fornecedor configurado, as regras atendem o fluxo completo.

#### Validação
82 unitários; contrato frontend; migração e testes reais de RLS em branch Neon
isolada; fluxos mobile/desktop. Produção aguarda aprovação visual do preview.
Documento: `docs/PERSONAL-WALLETS.md`.

### 2026-10-11 — Experiência V2 e cinco áreas

Pedido explícito de uma interface mais moderna e reorganização autoriza substituir a diretriz visual V1 nesta rodada. A camada canônica passa a ser `css/experience-v2.css`. Início, Casa, Carteiras, Assistente e Ajustes organizam a navegação. Casa possui Visão geral, Despesas, Acertos e Planejamento. Novo gasto é uma ação persistente com escolha de destino. Contratos financeiros e privacidade continuam preservados.

Mapa completo e critérios: `docs/EXPERIENCE-V2.md`. Produção continua aguardando validação visual do preview pelo usuário.

### 2026-10-11 — IA individual e cofre pessoal simplificado

Gemini e DeepSeek podem ser configurados por cada usuário em Ajustes, com modelos sugeridos, teste de conexão e remoção de chave. `private_ai_settings` possui RLS por dono; AES-256-GCM protege as chaves com segredo somente no backend. A IA recebe resumos financeiros compactos e é acionada sob demanda. Erros de provedor não retornam corpo bruto nem segredo.

Cofre pessoal destaca o resumo mensal e abre criação/lançamento em diálogos. Campos da configuração ficam bloqueados durante requests para impedir uma resposta antiga de sobrescrever uma nova seleção. Documento: `docs/AI-SETTINGS.md`.

### 2026-10-11 — Legibilidade e consolidação do frontend

Textos pequenos, contraste baixo e ações apenas por ícone dificultavam o uso. O cofre agora prioriza Registrar gasto, Ver gastos e Ajustar limite; recomendações ficam recolhidas depois do histórico. Os controles principais têm 48px e os rótulos Novo gasto/Sair aparecem no celular.

`css/app.css` é a referência visual única e substitui style.css, design-system-v1.css e experience-v2.css. Foram retiradas 621 declarações supersedidas; tokens centralizados e seletores obsoletos removidos. Editar regras existentes em vez de adicionar arquivos de overrides. Assets 20261011-004 / cache v50. Documento vigente: `docs/READABLE-EXPERIENCE.md`.

Produção continua aguardando a validação visual do preview pelo usuário.

### 2026-10-11 — Direção financeira e painéis agrupados

O usuário rejeitou o visual anterior e pediu organização, refinando a preferência para um painel financeiro com limite restante em destaque. O Início passa a mostrar valores primeiro e retira o banner promocional. O Cofre agrupa carteira, mês, orçamento e ações em um painel; histórico e dicas ficam abaixo. Azul escuro destaca os valores principais, violeta identifica as ações.

Componentes de Início/Cofre substituídos em css/app.css, sem nova camada de overrides. Assets 20261011-005 / cache v51. Direção vigente: docs/FINANCIAL-DIRECTION.md. Contratos financeiros e privacidade preservados. Produção aguarda validação visual do preview.

### 2026-10-11 — Modais unificados, gráficos exploráveis e simulação pessoal

#### Sintoma
Modais tinham padrões distintos; gráficos dependiam de CDN e não mostravam os lançamentos que formavam os valores. Cofre ocultava o excesso do limite e repetia a seleção de carteira. Total/histórico da Casa pressupunham nomes fixos.

#### Correção
Nove diálogos usam o sistema nativo compartilhado AppUI e o componente .app-modal no CSS canônico. Foco, Escape, fundo, rolagem e bloqueio de fechamento durante salvamento são consistentes. Gráficos locais por pessoa/categoria abrem detalhes rastreáveis. Cofre acrescenta simulação de compra com reserva temporária e projeção condicionada à amostra; excesso fica visível. Totais, nomes, filtros e resumo incluem outras pessoas. A regra de acertos para Paulo/Fernando continua explícita no documento e precisa de contrato próprio para generalização.

#### Regra permanente
Novos modais devem usar AppUI.openModal/closeModal/setModalBusy e .app-modal. Gráficos financeiros devem ter leitura acessível e detalhamento coerente com carteira e mês. Simulações não salvam despesas e devem explicitar a base do cálculo. Projeções exigem amostra mínima.

#### Validação
91 unitários, 18 testes de navegador, todos os diálogos em três tamanhos e axe sem violações automáticas nos estados avaliados. Assets 20261011-006/cache v52. Documento vigente: docs/MODALS-AND-SMART-WALLETS.md, junto da direção financeira. Produção aguarda validação visual do preview.

### 2026-10-11 — Aberturas contidas e lançamento sem cortes

As imagens do usuário mostravam Visão geral sem superfície própria, skeleton indevido na orientação estática e Escanear cortado. Início, Casa, Cofre, Assistente, Ajustes e Novo gasto compartilham `.view-panel` no CSS canônico. Descrição do Início fica visível durante loading; período da Casa aparece no celular. Ações do lançamento usam duas colunas e Interpretar ocupa uma linha. SVG local atende esses três controles e os estados do ditado. Revelar formulário agora mostra o topo do cartão abaixo da barra fixa. Métricas do Assistente não ultrapassam telas estreitas.

Validação: 91 unitários, 18 testes de navegador e revisão visual adicional em 320/390/1366px. Assets 20261011-007/cache v53. Documento vigente: docs/CONTAINED-HEADINGS.md, junto da direção financeira. Produção aguarda avaliação visual da prévia pelo usuário.


### 2026-10-11 — Resiliência P1/P2 do frontend

Consultas mensais agora compartilham AbortController e descartam respostas fora de ordem. Loading/erro ocultam dados antigos; os quatro estados são explícitos e erros têm recuperação persistente. 401/403 levam ao login nativo com foco contido e Escape bloqueado; 5xx/rede/timeout preservam a sessão e permitem tentar novamente. Scanner QR/OCR libera promises rejeitadas e scripts falhos. Contratos da API validam listas, datas, valores, usuário e token. CSS canônico teve 38 blocos agrupados e os conflitos de rótulo/tamanho/colunas removidos, reduzindo !important de 38 para 16.

Validação: 117 unitários e 28 testes de navegador (26 unitários e dez fluxos de regressão novos); npm run lint cobre sintaxe, CSS e contratos. Comparação de estilos em 126 estados de telas/modais entre 320 e 1920px. Assets 20261011-009/cache v55. Relatório e escopo: docs/FRONTEND-RESILIENCE.md. PR #16 permanece em prévia isolada; produção aguarda a avaliação visual do usuário.

### 2026-10-11 — Direção clara e Assistente em chat

A escolha mais recente é clara e elegante. Navegação lateral branca, verde-petróleo discreto, resumos mais curtos no Início e superfície suave de orçamento no Cofre substituem a direção anterior. Assistente agora tem conversa, contexto Casa/carteira + mês, resposta progressiva, parar, recuperação e revisão explícita de gasto. Indicadores da casa e métricas técnicas têm destinos próprios. O backend monta contexto autorizado e usa Gemini/DeepSeek com histórico; comparação e simulações usam cálculos do sistema. Troca de sessão limpa dados pessoais e descarta requisições antigas. O histórico é temporário na página, sem persistência no banco.

Validação: 142 testes unitários e 38 testes de navegador passando; lint de 82 arquivos, duas folhas de estilo e contratos de DOM/API. Novos casos cobrem histórico, autorização, paginação, simulação/reserva, parsing SSE, erros dos provedores, cancelamento, retorno da sessão e limpeza de dados privados. Assets 20261011-010/cache v56. Backend da prévia isolada br-lucky-firefly-a50tfkjv atualizado, com variáveis existentes preservadas. Escopo/limites: docs/CHATBOT.md; plano de migração: docs/FRONTEND-REBUILD-AND-CHAT.md. React/TypeScript e histórico persistente ainda são etapas futuras. Produção continua aguardando avaliação visual do usuário.

### 2026-10-11 — Segunda etapa: React tipado e histórico privado persistente

Vite passa a gerar `dist` para testes e publicação. TypeScript estrito, contratos de fronteira, componentes e hook do Assistente em `src/features/assistant`; a marcação estática e `js/modules/assistant.js` foram removidos. `src/app/legacy-bridge.ts` é a fronteira temporária com os módulos de sessão/navegação/revisão. Início, Casa, Cofre e Ajustes ainda aguardam sua migração; as regras financeiras mantêm uma única implementação.

Histórico privado por usuário, destino e mês em `assistant_conversations`, com RLS, retomada após reload, exclusão com confirmação e versão otimista. Só pares concluídos são salvos; respostas antigas não recriam conversas excluídas. O servidor usa histórico autorizado, ignora pares históricos fornecidos pelo cliente novo e emite `end` somente após persistir. Clientes antigos sem `conversation` mantêm o protocolo temporário.

Migração aplicada somente ao banco `gastos_casa`, projeto `frosty-star-45149603`, branch `br-broad-unit-acfw9voz`. Teste RLS passou e reverteu fixtures. Backend isolado `br-lucky-firefly-a50tfkjv`, deployment 7, variáveis preservadas. Prévia expira em 18/10/2026. Produção permanece condicionada à avaliação visual do usuário.

Validação: 149 unitários e 45 testes de navegador, incluindo bundle/manifest relativo, React offline, retomada/exclusão, falhas e isolamento de sessão. TypeScript, formatador, lint, build e auditoria de dependências sem vulnerabilidades conhecidas. Escopo e limitações: `docs/CHATBOT.md`.

### 2026-10-11 — Limites dos modais com teclado móvel

Todos os diálogos compartilham largura/altura máximas e posicionamento relativos à área visual disponível. `js/ui.js` acompanha resize/scroll de `visualViewport`, com fallback para a janela, incluindo deslocamento causado pelo teclado. CSS respeita safe areas, conserva rolagem interna e remove o scroll aninhado do login. A confirmação React também passa pelo bloqueio de rolagem compartilhado e suas ações podem quebrar de linha.

`tests/modal-bounds.spec.mjs` cobre os dez diálogos estáticos/React em 320/390px com teclado e deslocamento simulados; inclui login, restauração da altura e botões da confirmação. Esses testes não substituem uma checagem do teclado em iPhone físico. Produção permanece sem alterações; correção publicada apenas na prévia.

Validação desta correção: 149 unitários e 49 testes de navegador passaram (198 no total), com lint/TypeScript/build aprovados. Assets versionados para 20261011-011; cache do build é gerado por hash. Verificação adicional cobre deslocamento horizontal/vertical da área visual e funcionamento offline do PWA.


### 2026-10-11 — Cofre simples, meta privada e ações do chatbot

#### Sintoma e decisão
O Cofre mostrava orçamento, gráficos, projeção e dicas em sequência, com muita altura antes dos lançamentos. Esta etapa prioriza limite restante, referência diária e últimos cinco gastos; análises ficam recolhidas. A meta tem nome, valor alvo, prazo e reserva de um mês, com explicação de que não representa transferência ou poupança comprovada.

#### Arquitetura
Início e renderização do Cofre passam para React/TypeScript (`src/features/overview`, `wallets`). Removidos `js/modules/experience.js`, `js/modules/wallets.js` e sua marcação de tela. Os motores permanecem únicos. O controlador tipado do Cofre ainda integra os diálogos compartilhados existentes; Casa, Ajustes e esses formulários continuam pendentes de migração. Não declarar a migração completa.

#### Resiliência e planejamento
AbortController e geração na consulta mensal do Cofre; loading, vazio, sucesso e erro persistente com retry. Contratos validam arrays, período e coerência entre despesas e totais. Dados antigos não permanecem em erro. Troca de sessão descarta respostas, fecha modais e limpa estados. Explicações impedem duplicação de envio e não reaparecem após trocar o mês.

`wallet-planner.protect` calcula referência diária depois da reserva, somente no mês da meta. Simulador, chatbot e explicação curta do Cofre usam a mesma referência. A reserva não se repete automaticamente, não cobre despesas futuras não registradas e não comprova saldo bancário. O chat oferece atalhos de gastos/simulação e a meta preenche uma pergunta no contexto correto; nenhuma gravação automática.

#### Backend e privacidade
Migração `20261011_wallet_goals.sql` aplicada somente em `br-broad-unit-acfw9voz`, banco `gastos_casa`, projeto `frosty-star-45149603`. RLS existente por dono preservada; teste real de meta passou e reverteu fixtures. Backend da prévia `br-lucky-firefly-a50tfkjv`, deployment 10, com variáveis herdadas. Produção não recebeu migração, deploy ou merge.

#### Validação
154 unitários passaram; 57 testes de navegador passaram na suíte completa e a verificação final cobre PWA/Cofre após ajuste de consistência das explicações. TypeScript, formatação, lint e build aprovados. A CI usa o linter canônico para a checagem dinâmica de sintaxe, removendo a lista duplicada de arquivos aposentados. Assets 20261011-012; cache gerado por hash. Modal da meta incluído na cobertura de teclado e viewport simulados em 320/390px. iPhone físico e provedores reais com chave continuam sem validação nesta rodada.

Documento atualizado: `docs/PERSONAL-WALLETS.md`. Publicação apenas em preview para avaliação visual, seguindo a regra de produção deste arquivo.

### 2026-10-11 — Ajustes organizados e migração React

#### Experiência
Ajustes apresenta cartões separados de conexão de IA, usuários da casa e regras aprendidas. Qualidade do lançamento rápido fica em detalhes recolhidos ao fim da tela, depois das configurações. A nota de roadmap foi substituída por orientação sobre privacidade. A configuração Gemini/DeepSeek conserva presets, modelo personalizado, teste, manutenção da chave existente e exclusão confirmada.

#### Arquitetura e remoções
`src/features/settings` passa a renderizar conexão, membros, regras e métricas com TypeScript estrito. Removidos `js/modules/ai-settings.js`, `members.js` e a marcação estática; regras/métricas saíram de `smart-entry.js`, que conserva lançamento/revisão e eventos temporários de compatibilidade. `GastosSettings.init` monta uma única raiz, sem inicializadores duplicados. Casa, scanner e diálogos de despesas continuam pendentes; a navegação/sessão ainda usa a ponte. Não declarar a reconstrução completa.

#### Resiliência e dados sensíveis
Erro de carregamento mantém retry e bloqueia ações incompletas. Storage indisponível não reativa o salvamento. Confirmações verificam a geração da sessão antes de excluir. Chave digitada e senha inicial são limpas ao sair da tela e ao encerrar sessão; falha 503 mantém o formulário para retry. Respostas antigas não restauram usuários/configuração/aprendizado. Métricas usam AbortController e geração por período, com valores limpos em loading/erro. Contratos validam provedores, listas, categorias, contagens e taxas; links para obter chave são definidos pelo provedor conhecido.

#### Escopo de publicação
Assets 20261011-013/cache de origem v59; cache do build segue derivado por hash. Somente frontend/preview, sem novo deploy de backend ou migração de banco. Produção aguarda a validação visual do usuário. Provedores são simulados nos testes e teclado móvel é simulado; iPhone físico permanece sem validação.

#### Validação da etapa
159 testes unitários e 70 testes de navegador passaram (229 no total). Cinco unitários novos cobrem contratos, privacidade de metadados, agrupamento/prioridade e métricas sem amostra. Treze testes novos de navegador cobrem retry/503, storage indisponível, confirmações e respostas de sessão antiga, rascunhos sensíveis, prioridade/exclusão do aprendizado, troca de período e layout 320/390/1920px. Lint, TypeScript, formato e build aprovados; verificação adicional de Ajustes/PWA após consolidar o espaçamento dos cartões. Provedores reais e dispositivo físico seguem fora dessa validação.

### 2026-10-11 — Auditoria visual da prévia por aba

A pedido do usuário, avaliada a prévia imutável `pr-16-afa373d` com Chromium, 51 capturas e larguras 320/390/1366/1920px. Login observado sem interceptação; telas autenticadas usam respostas de API e conversa de demonstração, sem acesso a contas/chaves reais ou gravação no servidor. Relatório: `docs/VISUAL-AUDIT-20261011.md`; evidências em `/workspace/artifacts/visual-audit-20261011`.

Confirmados: boas-vindas do chat cortadas por rolagem inicial, erro 503 em Ajustes comunicado como ausência de conexão, campos desalinhados no desktop e ações dependentes da CDN sem identificação visual quando ela falha. Registradas melhorias por aba para cabeçalhos, altura dos resumos, navegação interna da Casa, clareza da reserva, alvos de toque e estados. Sem overflow horizontal de documento nos cenários principais; três modais do Cofre contidos em 390px. Dispositivo físico e provedores reais não avaliados. Rodada apenas documental: fontes, backend e produção inalterados; nenhuma correção registrada como concluída.

### 2026-10-11 — Plano de reconstrução V3 após auditoria visual

Usuário pediu uma mudança completa e planejamento da refatoração. `docs/FRONTEND-REFACTOR-V3.md` define nova composição clara/elegante para as cinco áreas, shell único React, componentes compartilhados, fluxo de lançamento e diálogos, análises com aprofundamento e remoção progressiva do CSS/ponte legados. Preserva contratos, motores financeiros, privacidade e backend. O plano substitui a composição visual anterior, sem declarar as funções existentes como ausentes.

Execução prevista em sete etapas com regressões e validação; P1 da auditoria precedem refinamentos. Primeira entrega proposta: fundação visual e protótipo navegável de Início/Cofre/Chat. Esta rodada é planejamento documental: nenhum código funcional, backend, asset ou produção alterado; suíte não reexecutada sem mudança funcional.


### 2026-10-11 — Extensão do plano: 3D e chat com múltiplos meses

Usuário pediu efeitos 3D, mockups e chat moderno com leitura de vários meses. Seção 8 de `docs/FRONTEND-REFACTOR-V3.md` inclui profundidade com CSS/SVG, movimento reduzido, mockups móvel/desktop e contexto com intervalos de 3/6/12 meses e personalizado (máximo inicial de 12 meses). Verificado no código: contexto atual contém um mês e backend compara com o anterior; ampliar requer contratos, consultas, chave do histórico e testes de backend. O escopo deixa de ser exclusivamente frontend nessa etapa. Planejado uso de agregados calculados no servidor, autorização por destino/carteira, compatibilidade mensal e aprofundamento nos lançamentos. Nenhuma funcionalidade, migração ou publicação executada nesta rodada documental.


### 2026-10-11 — Plano V3 consolidado para modernidade e responsividade

Plano `docs/FRONTEND-REFACTOR-V3.md` consolidado: sequência definitiva incorpora identidade 3D e backend de múltiplos meses, com contratos/agregação antes da integração do chat. Acrescentado contrato responsivo móvel/tablet/desktop, paisagem, zoom, teclado, conteúdo extremo e critérios de composição/acessibilidade/performance. Primeira entrega prevista contém mockups e protótipo; entrega final exige aplicação integrada. Nenhuma implementação funcional iniciada nesta rodada de planejamento.


### 2026-10-11 — Primeira entrega integrada V3

- Nova composição clara com profundidade CSS progressiva, ícones SVG locais e estilos de componentes consolidados. `app.css` passou de 4.455 para 3.752 linhas.
- Shell em uma raiz React; Cofre reúne limite, reserva e disponível; Casa oferece exploração expansível de gráficos.
- Assistente consulta até 12 meses, compara intervalos de mesma duração e conserva cartões mensais no histórico. Resumos são validados em fronteira e não representam saldo bancário.
- Assets `20261011-014`, cache fonte `v60`.
- Validação: 166 testes unitários e 85 de navegador passaram na suíte completa; lint e build passaram. Após extração do cartão mensal e ajuste de campo, validação direcionada repetida.
- Migração de contexto multimensal aplicada somente à DB de staging `br-broad-unit-acfw9voz`; teste real de isolamento RLS passou com fixtures revertidas. Backend de preview `br-lucky-firefly-a50tfkjv`, deployment 11 ativo.
- Não houve merge ou deploy em produção. A arquitetura ainda possui módulos legados; detalhes em `FRONTEND-V3-DELIVERY.md`.

### 2026-10-11 — Correção do chat no Safari móvel

- O print do usuário mostrou cabeçalho encoberto, espaço vazio inferior e envio à esquerda em pouca altura. A geometria móvel agora acompanha `visualViewport.height/offsetTop`, com fallback para o viewport comum e limpeza dos listeners.
- O aviso global de carregamento mensal não participa do layout do Assistente. Cabeçalho, contexto e compositor não encolhem; a conversa possui rolagem própria.
- Navegação permanece em telas curtas sem teclado. Com teclado detectado, o chat usa a área visível inteira; ao fechar, recupera a navegação.
- Compositor compacto mantém envio à direita e status disponível ao leitor de tela. Resposta concluída não força foco/abertura do teclado em dispositivo de toque.
- Assets `20261011-016`, cache fonte `v62`. Três testes novos reproduzem viewport deslocado, teclado e foco após resposta. Validação em iPhone físico continua pendente.

### 2026-10-11 — Evolução da leitura do Assistente

- Explicação precede o resumo calculado. Um mês oferece ação de abrir lançamentos sem barra/total repetidos; múltiplos meses preservam comparação e drill-down.
- Formatação leve em componentes React: parágrafos, títulos, listas, negrito e código inline. HTML do modelo permanece texto; não há interpretação de HTML nem dependência nova.
- Respostas concluídas podem ser copiadas; bloqueio do clipboard conserva a conversa e informa alternativa de selecionar texto.
- Leitura antiga não é interrompida; “Ir à última resposta” oferece retorno. Uma pergunta enviada pelo usuário volta a acompanhar o fim.
- Contexto móvel mantém rótulos acessíveis sem ocupar uma linha extra. Preservadas geometria de visualViewport e navegação com teclado.
- Componentes `MessageCard` e `ResponseText` extraídos; assets `20261011-017`, cache fonte `v63`. Três regressões novas em `chat-reading.spec.mjs`.

### 2026-10-12 — Usabilidade e prontidão para produção

- Avaliação a pedido do usuário. `PRODUCTION-READINESS-20261012.md` registra evidências, melhorias e ordem de promoção.
- Saída explícita do Assistente para Início permanece visível com teclado aberto. Alvos de toque secundários ampliados para 48 px, sem regras sobrepostas novas.
- Inspeção de 24 capturas iniciais sem overflow horizontal/erro JS; dados demonstrativos. Testes novos cobrem saída, conservação de conversa/rascunho, teclado e alvos de toque.
- **Produção bloqueada:** rotas /wallets, /ai/settings e /assistant/conversation retornam 404; banco principal sem as quatro tabelas novas e metas; configuração ativa não inclui AI_SETTINGS_ENCRYPTION_KEY. Backend de produção está no deployment 24 (22/09), prévia no 11 (11/10).
- Consultas de catálogo e endpoints somente de leitura. Nenhum segredo, dado financeiro, migração ou deploy em produção alterado. Provedor real e iPhone físico ainda pendentes.
- Assets `20261012-002`, cache fonte `v65`. Mudanças somente na branch/PR16 e prévia isolada.

- Refinamento final: contexto do chat empilhado em 320 px para conservar nome Casa legível. 24 testes direcionados aprovados após o ajuste; suíte completa e CI da revisão anterior aprovaram os seis casos novos de usabilidade.

### 2026-10-12 — Refinamento após prints de Casa e Assistente

- Acertos ainda herdavam nomes brancos e botões sem delimitação de uma superfície escura antiga. Método agora tem texto visível e identificação própria; resumo e ações ficam organizados, com dois botões lado a lado e alvo mínimo de 48 px. Regras antigas dos botões removidas de app.css e consolidadas em experience.css.
- Renderização da identificação do pagamento usa nós DOM/textContent. Cálculos, autorização do pagador e confirmação do pagamento foram preservados.
- Compositor compacto aplicado a todas as telas móveis. Rodapé mantém aviso curto; limite de histórico fica explícito na confirmação de exclusão, preservando status acessível ao leitor de tela.
- Acompanhamento da conversa ocorre em useLayoutEffect e reage à altura do log via ResizeObserver. Leitura antiga é preservada; nova pergunta e retorno ao fim acompanham a resposta completa.
- Três regressões em screenshot-refinements.spec.mjs; 24 testes direcionados aprovados antes da suíte completa. Assets `20261012-004`, cache fonte `v67`. Somente branch/PR16 e prévia; bloqueios de produção permanecem os do relatório de prontidão.
- Conferência final removeu acesso duplicado aos gastos quando já oferecido pelo cartão mensal; simulação do Cofre permanece disponível no contexto mensal. Dezesseis testes de chat/ações aprovados após o ajuste. Teste geométrico dos acertos mede os dois controles no mesmo frame para não comparar fases diferentes da animação de entrada.
