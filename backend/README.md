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


## Gestão de usuários

- `GET /members`: lista membros autorizados da casa.
- `POST /members`: cria uma conta no Neon Auth e adiciona o usuário à allowlist `household_members`.
- A rota exige sessão válida de um membro já autorizado.
- Cadastro público isolado não concede acesso aos dados financeiros.


## Lançamento inteligente

- `GET /features`: expõe feature flags do frontend sem dados sensíveis.
- `POST /smart-entry/parse`: interpreta texto em um rascunho de gasto autenticado.
- A V1 usa regras determinísticas + histórico confirmado da própria casa.
- A IA externa é um ponto de extensão e não é necessária para o funcionamento atual.
- O parser nunca grava um gasto. A confirmação reutiliza o mesmo `POST /expenses` já existente.
- `SMART_ENTRY_ENABLED=false` desliga a funcionalidade no backend sem alterar o fluxo manual.
- O texto original não é persistido em banco pelo Smart Entry.
