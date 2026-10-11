# Gastos Casa

Aplicativo financeiro para despesas compartilhadas, carteiras pessoais e Assistente com Gemini/DeepSeek.

## Desenvolvimento

Use Node.js 24, a mesma versão da CI.

```sh
npm ci
npm run dev
```

O frontend precisa do Vite para compilar TypeScript e JSX. Para servir a versão publicada:

```sh
npm run build
npm run preview
```

`dist/` contém somente assets do navegador. GitHub Pages usa caminhos relativos para funcionar tanto na raiz quanto em pastas de prévia. `PREVIEW_BACKEND_URL` configura um backend HTTPS isolado no build de prévia e desativa seu service worker.

## Verificação

```sh
npm run lint
npm test
```

`npm test` roda os unitários, compila o frontend e testa `dist/` com Playwright. Instale o browser com `npx playwright install chromium` ou defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE` para um Chromium já instalado. Os testes de IA usam provedores simulados.

## Arquitetura e migração

Início, Cofre e Assistente estão em `src/features/overview`, `wallets` e `assistant`, com React e TypeScript estrito. `src/shared` contém contratos de fronteira e componentes compartilhados; `src/app/legacy-bridge.ts` integra temporariamente a sessão, navegação e revisão de gastos existentes. Casa, Ajustes e os formulários compartilhados ainda usam os módulos existentes. A renderização anterior de Início/Cofre foi removida; o controlador tipado do Cofre mantém uma fronteira explícita com os diálogos compartilhados. Cada tela migrada substitui sua implementação anterior; os motores financeiros em `js/core` continuam únicos.

O backend existente em `backend/` guarda chaves de IA criptografadas e histórico privado por usuário, destino e mês. Migrações versionadas ficam em `db/migrations`; aplicar primeiro na branch isolada. Não aplicar esta entrega em produção antes da avaliação visual da prévia.

- [Escopo e protocolo do chat](docs/CHATBOT.md)
- [Plano de reconstrução](docs/FRONTEND-REBUILD-AND-CHAT.md)
- [Estado e regras de publicação](docs/PROJECT-STATE.md)
- [Backend](backend/README.md)
