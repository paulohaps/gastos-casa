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
`design/round-7-summary-mobile`

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

### 2026-09-19 — Resumo misturava informações de naturezas diferentes na mesma grade

#### Sintoma
Na tela Resumo, Total do mês, Paulo, Fernando e Acerto de contas apareciam como quatro quadrantes equivalentes. No mobile isso dificultava a leitura e deixava os participantes sem um padrão próprio. O seletor de mês também podia aparecer cortado.

#### Causa raiz
A primeira reorganização visual tratou a grade como problema geométrico, não como hierarquia de informação. Controles secundários do cabeçalho também competiam com o seletor de mês.

#### Correção
A Rodada 7 reorganizou o Resumo em:
- Total do mês;
- Participantes;
- Acerto de contas.

Paulo e Fernando passam a compartilhar exatamente a mesma estrutura e ficam um acima do outro no mobile.

O seletor de mês se tornou o controle prioritário do cabeçalho mobile, com largura flexível e ações secundárias compactas.

#### Regra permanente
Blocos de natureza diferente não devem compartilhar uma malha apenas para preencher espaço. A composição deve representar a função da informação.

No cabeçalho mobile, o controle principal não pode ser truncado para acomodar ações secundárias.

#### Validação
O smoke visual verifica a estrutura do Resumo, largura/ordem dos participantes e limites do seletor de mês.

Documento:
`docs/ROUND-7-SUMMARY-MOBILE.md`

---

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

### Rodada 7 — Resumo Mobile
Objetivo:
- corrigir hierarquia do Resumo;
- priorizar o seletor de mês no mobile;
- padronizar participantes;
- separar Total, Participantes e Acerto de contas.

Branch:
`design/round-7-summary-mobile`

Documento:
`docs/ROUND-7-SUMMARY-MOBILE.md`


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
