# PROJECT STATE — Gastos Casa

Este arquivo é a referência operacional contínua do projeto.

Antes de qualquer nova rodada, alteração visual, refatoração ou correção, ler este documento junto com os documentos da rodada atual.

---

## 1. Estado atual

### Arquitetura
- Frontend estático/PWA.
- Backend separado.
- Código frontend em módulos.
- `app.js` atua principalmente como orquestrador.
- Utilitários compartilhados em `js/core/utils.js`.
- Funcionalidades específicas em `js/modules/`.

### Navegação atual
Rodada 2 introduz quatro áreas:
- Resumo
- Lançar
- Movimentações
- Mais

Branch atual:
`integration/recover-validated-features` (baseada na `main` após os PRs #12, #13 e #14)

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
