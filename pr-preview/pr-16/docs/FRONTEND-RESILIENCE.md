# Resiliência do frontend — 2026-10-11

Escopo desta rodada: as sete correções do plano P1/P2 solicitado. As correções P1 foram verificadas antes de iniciar P2. O contrato financeiro e a privacidade das carteiras permanecem vigentes.

## P1

- `js/core/http-client.js`: combina cancelamento do chamador e timeout, mantendo ambos ativos até terminar a leitura do corpo. Erros HTTP mantêm status e código; erros de rede e timeout têm mensagens acionáveis.
- `js/core/latest-loader.js` e `js/app.js`: cada consulta mensal cancela a anterior. Uma geração identifica a consulta vigente e descarta respostas antigas, inclusive quando o transporte ignora o cancelamento. Os gastos e todas as consultas complementares compartilham o mesmo sinal.
- `js/ui.js` e `index.html`: estados `loading`, `empty`, `success` e `error`. Loading e erro ocultam os conteúdos financeiros do mês anterior, bloqueiam o resumo e mantêm o período explícito. O erro permanece na tela com “Tentar novamente”. Falhas no catálogo de meses repetem a consulta do catálogo antes de carregar valores.
- `js/api.js`: respostas autenticadas 401/403 removem a sessão e abrem o login. HTTP 5xx, timeout e erro de rede preservam token e sessão. Falhas temporárias na restauração mostram uma ação de recuperação sem pedir a senha novamente. Uma geração de sessão impede que respostas antigas renovem tokens após logout ou invalidem um login novo. A restauração expirada mantém uma única promise de login para todas as chamadas concorrentes.
- Login em `<dialog id="authDialog">`, aberto pelo sistema compartilhado de modais com `showModal()`. O formulário recebe foco e Escape permanece bloqueado até autenticar. O identificador anterior `authOverlay` é apenas um contêiner interno para compatibilidade.

## P2

- CSS canônico consolidado sem adicionar uma folha de overrides. Regras dependentes da ordem de breakpoints mantêm sua posição. Foram agrupados 38 blocos, removidos conflitos de “Novo gasto”, colunas da navegação móvel e tamanhos do seletor de mês, reduzindo o uso de `!important` de 38 para 16 declarações (incluindo o novo guard de conteúdo mensal). Os guards de visibilidade e de movimento reduzido continuam explícitos.
- `js/core/script-loader.js` e `js/modules/scanner.js`: chamadas simultâneas compartilham o carregamento. Erro, timeout ou script sem o global esperado removem o elemento e liberam a promise, permitindo tentar novamente. QR e OCR usam o mesmo mecanismo.
- `js/core/api-contracts.js` e `js/api.js`: respostas devem ser objetos; tokens e usuários são validados antes de atualizar a sessão. Listas precisam ser arrays, com valores financeiros finitos, datas existentes e os campos necessários a cada consumidor. Contratos inválidos geram `INVALID_RESPONSE`, sem convertê-los silenciosamente em listas vazias. Decimais numéricos enviados pelo banco continuam aceitos.
- Novos scripts locais incluídos no precache. Assets `20261011-009`; cache `gastos-ape-v55`.
- `npm test` executa unitários e testes de navegador. `npm run lint` verifica sintaxe de todos os scripts, declarações CSS duplicadas e contratos DOM/API. O CI instala com `npm ci` e executa lint. PostCSS é dependência de desenvolvimento; não entra no frontend servido ao usuário.

## Evidências de validação

`npm test`: 117 unitários e 28 testes de navegador passaram. `npm run lint` passou.

- 26 novos testes unitários: cancelamento, respostas fora de ordem, quatro estados, timeout durante o corpo, status HTTP, preservação de sessão, contratos inválidos, cache do scanner e cobertura dos assets offline.
- Dez novos testes de navegador: troca de mês com abort real, falha mensal com recuperação, restauração de sessão após 503, login após 401/403 com Tab/Escape, resposta 200 inválida, recuperação do catálogo de meses , segunda tentativa de QR/OCR após falha no CDN e login concorrente durante a restauração de sessão expirada.
- A suíte original permanece ativa: 91 unitários e 18 testes de navegador, incluindo os nove modais em tamanhos móveis e desktop. Os mocks foram extraídos para `tests/helpers/mock-backend.mjs`, sem remover cenários originais.
- Comparação adicional do CSS em 126 estados, sem diferenças nos estilos computados: seis áreas, três abas complementares da Casa e nove modais, em larguras 320, 390, 600, 768, 900, 1280 e 1920px.

Testes de navegador usam Chromium; não substituem validação em um iPhone físico. Os testes de scanner simulam as bibliotecas de leitura e exercitam upload/decodificação da imagem e recuperação de carregamento; não atestam a qualidade do OCR sobre cupons reais.

A prévia usa o backend isolado configurado no PR #16. Publicação no PWA oficial continua condicionada à avaliação visual do usuário, conforme `PROJECT-STATE.md`.

## Arquivos desta rodada

```text
.github/workflows/validate.yml
css/app.css
docs/FRONTEND-RESILIENCE.md
docs/PROJECT-STATE.md
index.html
js/api.js
js/app.js
js/core/api-contracts.js
js/core/http-client.js
js/core/latest-loader.js
js/core/script-loader.js
js/modules/scanner.js
js/ui.js
package-lock.json
package.json
playwright.config.mjs
scripts/lint.mjs
sw.js
tests/api-contracts.test.mjs
tests/assets.test.mjs
tests/helpers/mock-backend.mjs
tests/http-client.test.mjs
tests/latest-loader.test.mjs
tests/resilience.spec.mjs
tests/scanner-retry.spec.mjs
tests/script-loader.test.mjs
tests/session-resilience.test.mjs
tests/visual-smoke.spec.mjs
```
