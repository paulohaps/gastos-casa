# Arquitetura do Gastos Casa

## Visão geral

A aplicação usa PWA estática no GitHub Pages, Neon Function no backend e PostgreSQL/Data API no Neon.

```
GitHub Pages / PWA
  -> js/api.js
  -> Neon Function
  -> Neon Auth + Data API
  -> PostgreSQL
```

A modularização é incremental: cada domínio é extraído sem reescrever o app nem trocar framework.

## Frontend

```
js/
├── api.js
├── ui.js
├── app.js
└── modules/
    ├── smart-entry.js
    ├── radar.js
    ├── budgets.js
    ├── members.js
    ├── recurring.js
    ├── expenses.js
    └── dashboard.js
```

### `api.js`
Responsável por autenticação, sessão e contratos HTTP com o backend.

### `ui.js`
Componentes compartilhados de interface: toast, estado de conexão, erros de módulo e modal de confirmação.

### `modules/smart-entry.js`
Domínio completo do lançamento inteligente:
- interpretação e prévia;
- voz;
- duplicidade antes de salvar;
- regras aprendidas;
- métricas;
- formulário de regra manual;
- metadados enviados na confirmação.

O módulo recebe dependências por `init()` em vez de acessar diretamente o estado interno do app.

### `modules/radar.js`
Domínio do Radar Financeiro:
- projeção mensal;
- risco de orçamento;
- recorrentes pendentes;
- aceleração por categoria;
- possível duplicidade;
- render dos alertas.

Também recebe estado e utilitários por injeção de dependência.

### `app.js`
Agora atua principalmente como orquestrador:
- registra Service Worker;
- inicializa os módulos;
- carrega os dados do mês;
- mantém apenas o estado mensal compartilhado;
- distribui os resultados para os módulos;
- concentra utilitários pequenos ainda compartilhados.

Os domínios de Smart Entry, Radar, orçamento, membros, recorrentes, gastos/histórico e dashboard já foram extraídos.

## Backend

```
backend/
├── index.mjs
├── routes/
│   ├── expenses.mjs
│   ├── budgets.mjs
│   ├── recurring.mjs
│   ├── members.mjs
│   └── smart-entry.mjs
├── services/
│   └── smart-entry-service.mjs
└── smart-entry/
    ├── parser.mjs
    ├── metrics.mjs
    └── ai-provider.mjs
```

### `index.mjs`
Agora é principalmente composição:
- CORS;
- autenticação;
- Data API;
- feature flags;
- health/features;
- login/session/logout;
- montagem e despacho de routers.

Não deve voltar a acumular lógica específica de domínio.

### `routes/*.mjs`
Cada arquivo trata apenas o contrato HTTP de um domínio.

### `services/smart-entry-service.mjs`
Contém regras de aplicação do Smart Entry que precisam de persistência:
- histórico;
- regras aprendidas;
- aprendizado;
- telemetria;
- métricas;
- validação do draft.

### `smart-entry/*.mjs`
Núcleo de inteligência, preferencialmente puro e testável.

## Banco

Migrations permanecem aditivas e versionadas em `db/migrations/`.

## Regras para novas funcionalidades

1. Não adicionar um novo domínio diretamente em `app.js` ou `backend/index.mjs`.
2. Criar módulo/route/service próprio quando a funcionalidade tiver estado ou regras relevantes.
3. Manter regra de negócio fora de componentes visuais.
4. Manter acesso ao banco fora do parser puro.
5. Toda extração deve preservar contratos existentes e passar CI antes de remover código antigo.
6. Mudanças de PWA devem versionar assets e cache.
7. Toda rota nova entra no contract check.

## Próximas extrações

A próxima etapa técnica, sem urgência funcional, é mover utilitários compartilhados para `js/core/` e separar autenticação/transporte HTTP de `js/api.js`.

A migração deve continuar incremental para evitar regressões visuais ou de regra financeira.
