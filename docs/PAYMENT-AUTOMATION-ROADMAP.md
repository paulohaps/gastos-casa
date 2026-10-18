# Gastos Casa como app de gastos — integração futura de pagamentos

## O que já existe e o que foi implementado

Cadastro manual, voz, scanner de comprovante, regras de interpretação e assistente Gemini/DeepSeek já existem. A revisão de 18/10 destaca gastos na abertura e acrescenta heurísticas determinísticas sobre os registros autorizados: concentração por categoria, valores atípicos por mediana e candidatos a recorrência. O modelo recebe regras e evidências; não movimenta dinheiro nem cria despesas automaticamente.

Reconhecimento de um comprovante não confirma liquidação bancária. Nenhum botão de conexão bancária ou indicador de captura automática foi incluído nesta fase.

## Fontes de dados possíveis

| Fonte | Benefício | Limite / dependência |
| --- | --- | --- |
| Comprovante e cadastro rápido existentes | Menos digitação agora | Usuário ainda confirma valor, data, pagador e destino |
| Importação CSV/OFX | Histórico e conciliação sem conexão contínua | Implementar parser, prévia e identificação de duplicidades; não existe importação bancária persistida hoje |
| Open Finance com parceiro habilitado | Transações autorizadas com atualização recorrente | Definir parceiro, consentimento, cobertura, custos, frequência, contratos e revogação; não presumir evento instantâneo para todo pagamento |
| Integração com um prestador de pagamentos | Webhook de transações processadas por aquele prestador | Não informa todas as compras feitas em outros bancos/cartões |
| Aplicativo Android nativo com acesso a notificações | Pode sugerir registros a partir de notificações permitidas pelo usuário | Permissão explícita, políticas da loja e textos variáveis; notificação não comprova liquidação; não é capacidade da PWA nem solução equivalente para iOS |

A Notifications API da web permite que o próprio aplicativo apresente notificações. Não permite que uma PWA leia livremente notificações de aplicativos bancários. Não solicitar credenciais bancárias no frontend.

Fontes oficiais consultadas em 18/10/2026:

- Banco Central: https://www.bcb.gov.br/estabilidadefinanceira/openfinance
- MDN, Notifications API: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API
- Android, NotificationListenerService: https://developer.android.com/reference/android/service/notification/NotificationListenerService

## Fluxo proposto

1. Usuário autoriza uma fonte e escolhe a conta de origem; a autorização é revogável.
2. Adaptador no backend autentica a origem e converte o evento num formato canônico. Reentregas são esperadas.
3. Evento entra numa **caixa de revisão privada**. Nunca entra automaticamente na Casa por mencionar Fernando ou por ter uma categoria parecida.
4. Regras determinísticas sugerem descrição, categoria, data e tipo; a IA pode explicar ou sugerir classificação, com a configuração e as permissões existentes.
5. Usuário revisa valor, pagador, pessoal/compartilhado e divisão. Só então o cadastro financeiro existente confirma a despesa de forma transacional e idempotente.
6. Eventos posteriores conciliam o mesmo registro. Pendência, confirmação, estorno e exclusão não criam despesas adicionais por replay.

## Contratos de backend a desenhar antes de implementar

Os nomes abaixo descrevem necessidades, não endpoints ou tabelas já disponíveis.

- Identificador estável da fonte por proprietário, conexão e conta; chave única de evento externo no banco. ID do provedor tem precedência sobre heurística de descrição/valor/data. Similaridade só sinaliza revisão; não apaga nem funde registros reais automaticamente.
- Inbox persistente com estado e vínculo único para o ID da despesa criada, operada em transação. Não usar apenas localStorage ou bloqueio de botão como prevenção de duplicidade.
- Payload normalizado: moeda, valor exato em centavos, direção entrada/saída, instante original, data civil local, status da fonte e identificadores de conciliação. Não confundir o mês de pagamento com competência de parcela.
- Estorno, transferência entre contas próprias, pagamento de fatura e compra parcelada exigem regras explícitas. A modelagem atual de despesas positivas não deve receber estornos negativos de forma improvisada.
- Webhooks exigem autenticação/assinatura conforme a fonte, proteção contra replay, validação do payload, retentativa e registro de processamento sem dados bancários sensíveis nos logs.
- Tokens de acesso ficam cifrados no servidor. Não alterar/reutilizar credenciais existentes sem necessidade; nunca expor tokens de conexão ao modelo de linguagem.
- RLS/autorização por dono, compartilhamento explícito, revogação e política de retenção. Uma conexão pessoal não autoriza compartilhar o histórico com outro participante.

## Critérios de aceite da futura integração

- Reentregar o mesmo evento dez vezes gera uma única despesa confirmada.
- Receber pendência e confirmação do mesmo evento não duplica o gasto.
- Estorno preserva rastreabilidade sem inflar despesas ou desaparecer com o original.
- Registrar pagamento de fatura não duplica compras já importadas.
- Troca de fuso/mês mantém data e competência corretas.
- Conta externa não consegue consultar eventos ou gastos de outro dono.
- Recusar uma sugestão não altera o histórico financeiro.
- Conexão revogada impede novas consultas e informa o estado com clareza.

## Ordem recomendada

1. Resolver o ambiente de ensaio atualizado, com Auth/Data API/RLS comprovadamente isolados.
2. Implementar importação assistida de arquivo com prévia e testes de conciliação.
3. Validar utilidade com os usuários e selecionar a fonte Open Finance adequada.
4. Implementar consentimento/inbox/adaptador e ensaiar eventos sintéticos antes de liberar para contas reais.

Esta rodada não contrata parceiro, provisiona conexão bancária, cria tabela ou endpoint de importação, nem habilita registro automático.
