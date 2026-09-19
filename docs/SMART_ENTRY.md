# Smart Entry — arquitetura, inteligência e rollback

## Objetivo

Transformar texto livre em um rascunho estruturado de gasto sem tornar a camada inteligente responsável por gravar dados financeiros.

Fluxo:

```
texto do usuário
  -> POST /smart-entry/parse
  -> parser determinístico
  -> histórico confirmado da casa
  -> ponto de extensão de IA
  -> SmartExpenseDraft
  -> prévia humana
  -> formulário atual
  -> POST /expenses
```

## Garantias

- O Smart Entry nunca grava diretamente em `gastos`.
- O usuário autenticado continua sendo o responsável efetivo pelo lançamento.
- Categorias continuam restritas a Mercado, Contas, Aluguel, Ifood e Outros.
- Formas de pagamento continuam restritas a Dinheiro e Vale.
- O formulário manual permanece disponível independentemente do Smart Entry.
- O texto original não é persistido.
- O endpoint aceita no máximo 500 caracteres.
- Consultas, lembretes, exclusões e frases negativas não viram gastos.

## Inteligência V1

A V1 não depende de fornecedor externo.

1. regras para valor, data e forma de pagamento;
2. regras de categoria por vocabulário;
3. histórico dos últimos lançamentos confirmados para reconhecer descrições recorrentes;
4. confiança por campo;
5. avisos quando um campo foi assumido;
6. possível duplicidade antes da confirmação.

O arquivo `backend/smart-entry/ai-provider.mjs` é o contrato de extensão para um modelo externo. Um provider futuro só poderá enriquecer o rascunho; a validação final do backend continuará restringindo categoria, pagamento, valor e tamanho da descrição.

## Feature flag

O backend lê:

```
SMART_ENTRY_ENABLED
```

Valores `false`, `0`, `off` ou `no` desativam o recurso. Na ausência da variável, a V1 fica habilitada.

O frontend consulta `GET /features`. Se o recurso estiver desligado ou indisponível, o bloco inteligente não aparece e o formulário manual continua funcionando.

## Rollback

### Nível 1 — feature
Desabilitar `SMART_ENTRY_ENABLED` em um deployment que preserve as demais variáveis de ambiente.

### Nível 2 — frontend
Reverter os commits do Smart Entry. O fluxo `POST /expenses` não mudou.

### Nível 3 — backend
Reimplantar o deployment anterior da Neon Function. As rotas antigas não dependem de `/smart-entry/parse`.

### Banco
A V1 não cria nem altera tabela. Portanto não existe rollback de schema.

## Testes

Unitários cobrem:
- valor decimal;
- R$;
- valor falado;
- hoje/ontem/dia do mês;
- Vale/Dinheiro;
- categoria por regra;
- categoria por histórico;
- múltiplos valores;
- consulta que não deve virar gasto;
- revisão obrigatória quando campo foi assumido.

Playwright cobre o bloco Smart Entry nos cinco viewports do projeto.

## Próxima evolução

Somente depois de medir a V1:
- provider de IA opcional para ambiguidades;
- telemetria sem texto bruto;
- aprendizado por correções confirmadas;
- foto/comprovante reutilizando o mesmo SmartExpenseDraft.
