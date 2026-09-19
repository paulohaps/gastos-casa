# Backend do Gastos

O PWA não envia o token opaco da sessão diretamente à Neon Data API.

Fluxo atual:

```
GitHub Pages / PWA
        |
        v
Neon Function gastospwa
        |
        +--> Managed Better Auth (valida sessão e emite JWT)
        |
        +--> Neon Data API (JWT real)
        |
        v
Postgres + RLS
```

## Rotas

- `GET /health`
- `POST /login`
- `POST /logout`
- `GET /session`
- `GET /months`
- `GET /expenses?month=MM/YYYY`
- `POST /expenses`
- `GET /budgets?month=MM/YYYY`
- `POST /budgets` (salva metas em lote)
- `GET /recurring`
- `POST /recurring`

O cadastro público pelo backend está desativado. O banco ainda deve proteger todos os dados com RLS e a allowlist `household_members`.

## Regras

- Novo gasto sempre usa o nome do usuário autenticado.
- Os dois membros autorizados podem visualizar/editar/excluir gastos compartilhados.
- Metas são gravadas em lote para evitar estado parcial.
- Sessão do PWA é opaca; JWT é obtido e usado somente no backend.
- Erros de API retornam JSON com `error` e `message`.

## Deploy

A Function é Node.js 24 e precisa exportar um handler padrão:

```js
export default async function handler(request) {
  // ...
}
```

Não usar `Deno.serve` nessa Function.
