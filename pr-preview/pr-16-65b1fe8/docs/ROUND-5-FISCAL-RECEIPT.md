# Rodada 5 — Documento Fiscal Assistido

Branch: `feature/round-5-fiscal-receipt`

Base: `feature/round-4-smart-scanner-v2`

## Objetivo

Transformar o scanner da Rodada 4 em um fluxo fiscal confiável sem automatizar CAPTCHA, sem depender de scraping da SEFAZ e sem criar um segundo pipeline financeiro.

A foto continua sendo somente uma entrada. O gasto só é salvo depois da mesma revisão humana já usada pelo Smart Entry.

## Arquitetura

```
Foto / QR
  -> scanner local
  -> QR + OCR
  -> POST /receipts/inspect
  -> nfce-parser
  -> evidências fiscais
  -> Smart Entry V4
  -> revisão
  -> POST /expenses
  -> receipt_imports (somente metadados)
```

## O que o parser fiscal valida

- chave de acesso com 44 dígitos;
- dígito verificador da chave;
- UF, CNPJ, modelo, série e número derivados da chave;
- domínio fiscal oficial do QR;
- valor total encontrado no QR ou no texto do cupom;
- data do documento;
- CNPJ impresso;
- coerência entre CNPJ impresso e CNPJ da chave;
- estabelecimento quando legível.

A consistência é exibida como **Alta**, **Média** ou **Revisão necessária**. Não é exibido um score numérico ao usuário.

## CAPTCHA

O sistema não tenta:
- resolver CAPTCHA;
- enviar CAPTCHA a terceiros;
- reutilizar cookie da SEFAZ;
- contornar proteção do portal;
- fazer scraping como requisito do lançamento.

Quando o QR contém uma URL fiscal oficial, o painel mostra **Verificar na SEFAZ**. A consulta abre em nova aba e a interação com CAPTCHA continua humana.

Por isso os estados são diferentes de “verificado pela SEFAZ”:
- `identified_official_qr`;
- `identified_key`;
- `unverified_image`.

`verifiedByAuthority` permanece falso nesta rodada.

## Privacidade

Não persistimos:
- foto;
- OCR bruto;
- QR bruto;
- dados de cartão;
- CAPTCHA.

Depois que o gasto é confirmado, somente metadados fiscais mínimos podem ser gravados:
- chave;
- CNPJ/nome do emitente;
- data;
- total;
- origem;
- estado de identificação;
- modo de verificação;
- evidências booleanas.

## Deduplicação

Uma chave válida vira o identificador forte do cupom.

Antes de confirmar, `/receipts/inspect` procura a chave em `receipt_imports`.

Se já existir, a interface mostra:
**Este cupom já foi importado.**

O sistema não precisa depender de descrição + valor + data para esse caso.

## Banco

Migration:
`db/migrations/20260919_receipt_imports.sql`

A tabela é aditiva e não altera `gastos`.

O vínculo com `expense_id` só é criado depois que a despesa foi salva com sucesso.

## Rondônia

O parser reconhece a UF 11 como RO e considera a consulta fiscal assistida. Quando há URL oficial do QR, ela é reaproveitada para o botão de consulta.

Não existe integração automática com a página protegida por CAPTCHA nesta rodada.

## Rollback

A implementação foi feita em branch própria sobre a Rodada 4.

Rollback funcional:
1. não carregar `receipt-import.js`;
2. remover o dispatcher `/receipts/inspect`;
3. manter o Scanner V1 anterior;
4. a tabela `receipt_imports` pode permanecer sem uso.

Nenhuma coluna existente em `gastos` foi modificada.

## Próximos passos

Somente depois de validar esta rodada com cupons reais:
- extrair itens de forma estruturada;
- normalizar estabelecimentos;
- avaliar providers oficiais por UF;
- criar suporte multi-tenant para documentos fiscais;
- estudar armazenamento opcional de XML quando houver fonte oficial legítima.
