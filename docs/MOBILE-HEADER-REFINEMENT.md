# Cabeçalho compacto no mobile

## Composição

O cabeçalho de duas linhas (125 px com borda) passa para uma linha de 64 px + borda nas larguras até 900 px. A área segura superior do aparelho é acrescida quando fornecida pelo navegador/PWA, sem reduzir os alvos de toque. Logo, seletor de período compartilhado e menu ficam alinhados; Cofre e Ajustes preservam seus períodos próprios. O seletor mostra somente MM/AAAA para caber integralmente em 320 px; o mês atual permanece identificado no nome acessível da opção.

Busca, tema, conta e saída ficam num disclosure nativo, com controles únicos compartilhados com o desktop. A ponte de sessão injeta o botão existente em `.header-session-actions`, mantendo ID, comportamento de saída e atalho em Ajustes. Desktop continua com controles em linha e sidebar. O Assistente mantém o cabeçalho próprio e a saída explícita para Início.

Nova despesa usa o botão flutuante em Início, Casa, Cofre e Ajustes; não se repete como ação flutuante no formulário ou no Assistente. No formulário, o menu mantém o atalho para escolher outro destino, inclusive depois de revisar uma mensagem do chat. O espaçamento final permite alcançar o conteúdo abaixo da ação e da navegação inferior. Os destinos casa/cofre permanecem no seletor de cadastro existente.

## Interação e acessibilidade

- Disclosure nativo com nome acessível e alvos de 48 px; Tab segue a ordem do documento.
- Fecha com Escape, toque fora, mudança de rota, saída de foco e limpeza de sessão.
- A busca mantém seu dialog e foco contido. Ao fechar, retorna ao summary se seu botão estiver dentro do menu recolhido.
- Mudanças de breakpoint preservam um destino de foco visível e não duplicam controles de sessão.
- O seletor usa o mesmo fluxo de mudança de mês, incluindo cancelamento de carregamentos e dados históricos.

## Validação

Cinco novos testes de navegador cobrem 320/390/768 px, altura, sobreposição, sincronização de mês/valores, cadastro nas quatro áreas, navegação do Assistente, tema persistido, busca, Escape, toque fora, conta, logout e redimensionamento até desktop. O teste existente de busca foi atualizado para abrir o menu mobile e verificar retorno ao summary.

Capturas e inspeção geométrica em `/workspace/artifacts/mobile-header/`, com fixtures sintéticas. Comparação inicial: 125 → 65 px. Backend, cálculos, dados e migrações não mudaram. Safari/iPhone físico continua pendente. Assets `20261015-004`; service worker fonte `v77`.

### Resultado final

- `npm run lint` aprovado (TypeScript, formatação e contratos incluídos).
- `npm run build` aprovado.
- `npm run test:unit`: 197/197 aprovados.
- `playwright test --workers=3`: 163/163 aprovados na versão final; cinco testes novos. A rodada completa inicial encontrou o atalho de destino indisponível após revisão pelo chat; a ação foi preservada no menu e o fluxo passou novamente, junto com toda a suíte.
- Inspeção das seis telas × cinco larguras (320/390/768/901/1440) × dois temas: 60 combinações sem overflow horizontal; cabeçalho mobile de 65 px contando borda, com inset superior zero no Chromium. Capturas Dark/Light e comparador `compare.html` no diretório de artefatos. Safari/iPhone físico não foi executado.

### Arquivos

- Shell: `src/app/AppShell.tsx`, novo `src/app/HeaderMenu.tsx`, `src/app/CommandMenu.tsx`, `css/shell.css`.
- Ponte e apresentação do período: `js/api.js`, `js/app.js`.
- PWA: `index.html`, `sw.js`.
- Regressões: novo `tests/mobile-header.spec.mjs`, `tests/workspace-redesign.spec.mjs`, `tests/visual-smoke.spec.mjs`.
- Documentação: este relatório e `docs/PROJECT-STATE.md`.
