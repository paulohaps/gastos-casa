# Validação Open Finance — Nubank e Inter — 21/10/2026

**Veredito: viabilidade preliminar confirmada; integração e sandbox autenticado ainda não homologados.** O usuário informou que ainda não possui uma aplicação Pluggy. Nenhuma conexão bancária foi criada, nem conta/serviço contratado.

## O que foi verificado

| Verificação | Resultado | Limite da evidência |
| --- | --- | --- |
| Tabela pública Open Finance | HTTP 200; Nubank e Inter listados, com contextos Personal/Business e marcação de contas, transações e cartões | Os produtos representam a **união dos contextos**, conforme o próprio documento. Não confirma todos os produtos em PF, cartão específico ou consentimento real. |
| Acesso à API do provedor | GET sem autenticação a `/connectors?isOpenFinance=true` retornou HTTP 403 | Prova somente a recusa da consulta sem acesso autorizado; não comprova disponibilidade do produto na aplicação. |
| Credenciais para o ensaio | Segredos gerenciados ausentes; `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` não configurados; usuário confirmou ausência de aplicação | Sem tentativa de autenticação com credenciais inventadas ou reaproveitadas. Não houve coleta de chaves de outro serviço. |
| Sandbox documentado | Guia descreve banco sintético, fluxo Open Finance e cenários de falha | Guia lido; login no banco sintético, Connect Token, coleta e webhook **não executados**. |
| Atualização de dados | FAQ afirma que novas transações Open Finance podem levar até 24h para aparecer; atualização depende de sincronização | Não é captura instantânea nem SLA garantido para os bancos do usuário. Cadência contratada ainda desconhecida. |
| Base financeira existente | 52 testes unitários relevantes aprovados, zero falhas | Testes da aplicação atual, sem adaptador bancário e sem conexão a banco real. Não certificam a importação futura. |

A evidência estruturada fica em `validation/OPEN-FINANCE-20261021.json`. A cobertura foi consultada novamente nesta rodada; SHA-256 do documento consta na evidência.

## Restrições importantes para a prova de conceito

1. **Sandbox e live compartilham ambiente/host.** A documentação diz que não existe uma URL sandbox separada para o widget. `includeSandbox: true` apenas inclui conectores sintéticos; não torna qualquer conexão segura para teste. O ensaio deve restringir a seleção a conectores comprovadamente de sandbox, consultados por `sandbox=true`, sem escolher Nubank/Inter reais nesta etapa.
2. **As credenciais sintéticas de banco não autenticam a API Pluggy.** O servidor precisa de aplicação e credenciais próprias para obter API Key e Connect Token. API Key fica no servidor; o widget usa somente o token de conexão com escopo limitado.
3. **O banco sintético não homologa Nubank/Inter.** Os exemplos documentados não cobrem todos os Pix, transferências e estornos; valores e quantidades variam. Validar contrato de campos, estados e paginação sem fixar totais/IDs do sandbox. Cenários ausentes exigem fixtures controladas identificadas como simulação; os dois bancos exigem piloto posterior com consentimento.
4. **Produtos por PF exigem consulta autenticada.** Validar conector/contexto, produtos e recursos realmente declarados pelo consentimento, e não inferir disponibilidade PF a partir da linha agregada da documentação.
5. **Conta em Development não deve ser usada com dados reais no piloto.** O guia diferencia aplicações Development/Production e aponta particularidades da página de demonstração. Antes de contas reais, confirmar isolamento, ambiente contratado, privacidade e condições de produção. Não confundir conta do provedor em Development com sandbox bancário.
6. **Custos e habilitações continuam em aberto.** Open Finance é documentado como recurso que precisa de habilitação comercial. Esta consulta não confirmou preço, gratuidade do piloto ou concessão de acesso para uma aplicação nova. Não contratar plano automaticamente.

## Compatibilidade com o código do Gastos Casa

- Casa: `backend/routes/expenses.mjs` e `db/migrations/20261017_expense_requests.sql` aceitam Dinheiro/Vale. Origem Pix/cartão precisa de metadados e mapeamento explícitos, preservando os grupos dos acertos. Não alterar o enum silenciosamente.
- Idempotência: `backend/services/expense-operation.mjs` usa `record_expense`, mas o vínculo inbox/despesa deve ser atômico também. O POST pessoal em `backend/routes/wallets.mjs` não herda a garantia dessa RPC. O caminho de confirmação importada do Cofre precisa de garantia transacional própria.
- Ainda faltam inbox, vínculo persistente de origem, adaptador, consentimentos, processamento durável e endpoints de conexão. Isso foi identificado na inspeção; não foi implementado nesta validação.
- Reconexão, transação excluída/recriada, pagamento de fatura, transferência própria e estorno seguem os critérios do roadmap. A classificação por IA não autoriza lançamento ou compartilhamento automático.

## Testes executados nesta rodada

```sh
node --test tests/recovered-finance.test.mjs tests/financial-boundaries.test.mjs tests/settlements.test.mjs tests/settlements-route.test.mjs tests/wallets-route.test.mjs tests/wallet-planner.test.mjs
```

Resultado: **52 aprovados, 0 falhas, 0 ignorados**. Também executado `git diff --check`. Código de produção não modificado; lint/build/navegador não foram repetidos nesta alteração documental. Resultados da rodada anterior não são apresentados como testes Open Finance.

## O que falta para avançar

1. O responsável pelo projeto cria uma aplicação de testes em [Pluggy Dashboard](https://dashboard.pluggy.ai/) e confirma quais recursos/limites estão liberados, sem contratação paga implícita.
2. Configurar `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` como segredos do ambiente de ensaio. Esses são nomes propostos para o ensaio; o backend atual ainda não possui integração Pluggy. Não enviar chaves na conversa, commitá-las ou usar credenciais bancárias reais.
3. Com acesso disponível: executar autenticação, descoberta dos conectores sintéticos, autorização mock, coleta completa de contas/transações, falhas/reconexão/revogação e entrega autenticada de webhook. Registrar resultados reais; nenhum desses passos está aprovado neste documento.
4. Depois da fundação transacional descrita no roadmap e do ensaio, realizar piloto consentido Nubank/Inter com revisão obrigatória e critérios de privacidade/duplicidade.

## Fontes oficiais lidas

- [Cobertura Open Finance](https://docs.pluggy.ai/en/docs/open-finance/institutions-coverage).
- [Autenticação](https://docs.pluggy.ai/en/docs/authentication).
- [Sandbox](https://docs.pluggy.ai/en/docs/guides/sandbox).
- [Ambientes do widget](https://docs.pluggy.ai/en/docs/connect-widget/environments).
- [FAQ: atualização, aplicações e limites](https://docs.pluggy.ai/en/docs/get-started/faq).
- [Considerações Open Finance](https://docs.pluggy.ai/en/docs/open-finance/considerations-faq).
- [Roadmap do projeto](PAYMENT-AUTOMATION-ROADMAP.md).
