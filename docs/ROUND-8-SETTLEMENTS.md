# Rodada 8 — Acertos parciais e quitação

## Problema

O Resumo calculava quanto uma pessoa devia à outra, mas não registrava quanto já havia sido pago. Um pagamento não pode ser modelado como gasto, porque isso altera o total do mês e inverte a origem da dívida.

## Decisão

Criar o domínio aditivo `acertos`, separado de `gastos`.

Cada registro contém:
- competência explícita;
- data real do pagamento;
- pagador autenticado e imutável;
- recebedor;
- forma (`Dinheiro` ou `Vale`);
- valor positivo;
- observação opcional de até 240 caracteres.

O cálculo continua 50/50. Para cada forma:

`saldo restante = saldo bruto das despesas - pagamentos na direção devedor → credor`

## Regras protegidas no backend

- somente membro autenticado da casa acessa os registros;
- o pagador é sempre o usuário autenticado;
- só o devedor atual pode registrar pagamento ao credor atual;
- o valor não pode superar o saldo restante;
- Dinheiro não abate Vale e Vale não abate Dinheiro;
- competência, pagador, recebedor e criador não podem ser alterados;
- exclusão recalcula o saldo a partir do histórico remanescente.

## Ordem segura de publicação

1. Criar uma branch Neon isolada a partir da branch usada pelo app.
2. Aplicar `db/migrations/20260922_settlements.sql` usando conexão direta, não pooled.
3. Validar RLS e os cenários parcial, integral, direção inválida e valor excedente.
4. Publicar a Neon Function com a nova rota.
5. Publicar o frontend/preview.
6. Aplicar em produção somente após aprovação do preview.

Sem a migration e a rota publicadas, o frontend mantém os demais módulos disponíveis e sinaliza falha apenas no módulo de acertos.

## Validação local

- contrato frontend (`node scripts/check-frontend.mjs`);
- testes unitários, incluindo cálculo por forma;
- smoke visual em 360×740, 430×932, 768×1024, 1366×768 e 1920×1080;
- fluxo de lançamento manual, edição, duplicação, recorrentes e autenticação permanece coberto pelo smoke existente.
