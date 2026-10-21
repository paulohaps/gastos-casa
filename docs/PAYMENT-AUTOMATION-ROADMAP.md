# Gastos Casa como app de gastos — integração futura de pagamentos

## Refinamento de produto — 21/10/2026: Nubank e Inter

O usuário definiu **Nubank e Inter** como primeiras instituições. Este documento especifica a próxima evolução; conexão bancária, importação persistente e revisão de transações ainda não estão implementadas. O fechamento integrado de 20/10 continua como base, com homologação em dispositivo/provedor real pendente. O escopo inicial proposto é pessoa física, leitura de movimentações e confirmação assistida, sem iniciação de pagamentos.

Validação posterior: [OPEN-FINANCE-VALIDATION-20261021.md](OPEN-FINANCE-VALIDATION-20261021.md). Consulta pública e base financeira verificadas; sandbox autenticado bloqueado pela ausência de aplicação/credenciais do provedor, confirmada pelo usuário. Nenhuma conexão bancária homologada.

### Experiência proposta

1. Em **Ajustes → Conexões bancárias**, escolher Nubank ou Inter, conhecer os dados solicitados e concluir a autorização no fluxo oficial da instituição. Pedir somente os produtos necessários; investimentos e empréstimos ficam fora deste piloto.
2. Mostrar a fonte, o estado da autorização e a **última coleta completa**. Distinguir conexão autorizada, sincronização, ação pendente no banco, falha recuperável, autorização expirada e revogação. Horário do webhook não significa que todos os dados foram coletados.
3. Em **Movimentações → Para revisar**, apresentar itens privados: instituição/conta, data, descrição, valor, status da fonte e classificação sugerida. A contagem vem da inbox persistida, sem números de demonstração. Não criar uma sexta aba na navegação inferior nem repetir avisos de conexão em todos os cards.
4. Ao revisar, escolher **Pessoal** ou **Casa**. Pessoal exige escolher o Cofre; Casa exige confirmar pagador, classificação e regra de acerto compatível. Categorias são sugestões editáveis. Oferecer **Já registrei** para vincular um lançamento existente, além de **Ignorar**. Uma origem pessoal continua privada até a confirmação explícita de compartilhamento.
5. Depois da confirmação, abrir a despesa resultante e atualizar indicadores do mesmo período. Repetir a confirmação ou recarregar após uma resposta incerta deve recuperar o mesmo resultado.

O benefício pretendido é reduzir digitação e reconhecer registros já feitos manualmente, por voz ou comprovante. O exemplo de comunicação é “Encontramos uma movimentação. É pessoal ou da Casa?”, usando descrição e valores reais apenas depois da coleta autorizada. Não prometer captura instantânea: o webhook avisa mudanças disponíveis no provedor, não intercepta cada pagamento no celular.

### Viabilidade documentada e escolha do primeiro piloto

Consulta pública em **21/10/2026**, sem credenciais de agregador nem conta bancária:

| Candidato | Evidência encontrada | Decisão |
| --- | --- | --- |
| Pluggy, conectores Open Finance regulados | A tabela oficial lista Nubank e Inter, contextos Personal/Business, com contas, cartões e transações. Open Finance precisa de habilitação comercial no plano. | Primeira candidata para POC em sandbox, condicionada a plano, custo, contrato e produtos efetivamente autorizados em cada conta. Ainda não contratada/selecionada para produção. |
| Belvo, agregação Open Finance Brasil | A documentação descreve contas, transações e faturas no Brasil. A consulta realizada não confirmou a matriz específica Nubank/Inter nem preço. | Alternativa para comparação comercial e técnica; sem alegação de equivalência de cobertura. |

Cobertura anunciada por instituição não comprova coleta do cartão específico do usuário. No piloto, verificar os produtos do conector e os recursos realmente compartilhados pelo consentimento. A tabela de **conectores diretos** da Pluggy é diferente da tabela Open Finance: não usar o indicador de atualização automática de Inter direto para inferir a capacidade do Inter Open Finance. O piloto deve restringir a seleção aos conectores oficiais previstos no contrato.

A tabela Open Finance agrega produtos na união dos contextos PF/PJ; marcação verde não garante o produto em cada contexto. A FAQ também documenta que novas transações podem levar até 24h para aparecer. Contrato/cadência e coleta autorizada precisam ser verificados antes de prometer frequência ao usuário. Sandbox compartilha host com live: incluir sandbox no widget não restringe sozinho o ensaio aos bancos sintéticos.

Critérios para contratar: cobertura PF dos dois bancos, conta e cartão, renovação/revogação, frequência e limites de atualização, recuperação de falhas, tratamento de IDs após reconexão, acesso a sandbox, retenção/exclusão, papéis e responsabilidades no tratamento de dados, custo fixo/mínimo e custo por conexão ativa/coleta. Não estimar valores comerciais sem proposta. Não solicitar senha bancária, certificado bancário ou chave de desenvolvedor ao usuário dentro do Gastos Casa.

### Dependências encontradas no código atual

| Evidência | Consequência para a implementação |
| --- | --- |
| `backend/routes/expenses.mjs` e `record_expense` aceitam `Dinheiro`/`Vale`; esses grupos afetam os acertos | Conservar **origem bancária** (Pix, débito, cartão etc.) separada da **forma usada na divisão atual**. Não gravar `Pix` em um enum que não aceita esse valor, nem converter silenciosamente cartão em Dinheiro. Definir o mapeamento com revisão explícita ou uma evolução aditiva do modelo. |
| `backend/services/expense-operation.mjs` usa RPC idempotente na Casa | Reutilizar a regra, mas a confirmação de uma importação também precisa vincular inbox e despesa na mesma transação. Duas requisições separadas não dão essa garantia. |
| `backend/routes/wallets.mjs` cria despesa pessoal via POST em `personal_expenses` | A idempotência da Casa não se aplica automaticamente ao Cofre. O caminho de importação pessoal exige sua própria garantia transacional e vínculo único de origem antes de ser liberado. Não tratar isso como garantia já existente no cadastro pessoal. |
| O app não possui conexão, inbox ou vínculo persistente de transação externa | Adicionar schema/RLS e serviços específicos em etapa posterior; não apresentar botões funcionais ou persistência fictícia agora. Nenhum endpoint novo é definido como disponível neste documento. |

### Regras que o adaptador deverá preservar

- **Duas idempotências:** deduplicar entrega do evento e identidade econômica da transação. Na Pluggy, reconectar cria um novo item e novos IDs de transações. Usar `providerId`, quando disponível, com identidade da conta/dono e atributos verificáveis; não confiar somente em item ID/event ID. Sem identidade conclusiva, sinalizar revisão, sem fundir registros por semelhança. Duplicação entre donos/contas conjuntas exige autorização e regra própria, sem consultar o histórico privado do outro participante.
- **Origem revisável:** `PENDING` de compra em fatura aberta não é equivalente a pagamento agendado em conta. Preservar status, tipo de conta, data e metadados; distinguir previsto, compra revisada e liquidação bancária. O status da origem não substitui a decisão de contabilização por competência.
- **Atualizar sem apagar história:** o provedor documenta exclusão/recriação de transação e possível reaparecimento. Um `transactions/deleted` invalida a representação da origem e pede conciliação; não autoriza apagar a despesa confirmada da Casa/Cofre. Estorno exige vínculo e tratamento explícito, não um valor negativo improvisado.
- **Transferências e fatura:** transferência Nubank → Inter do mesmo dono, pagamento de fatura e Pix para Fernando não viram novas despesas ou acertos automaticamente. Separar transferência, compra e liquidação; vincular o lançamento já existente quando confirmado. Estorno, cashback e parcelas também precisam de testes próprios.
- **Coleta completa:** na API consultada, transações têm limite de página 500; percorrer todas as páginas e lotear listas de IDs. Lista parcial não significa período sem gastos. Respeitar limites/retries do plano; não iniciar polling constante sem verificar política e custo.
- **Webhook confiável:** autenticar a entrega pelo mecanismo suportado e buscar o recurso usando as credenciais do servidor. A documentação consultada descreve cabeçalhos secretos configuráveis; não pressupor assinatura HMAC nativa. Verificar o vínculo da conexão com o dono no banco, nunca confiar no `owner` recebido no payload.
- **Fila durável:** responder 2xx depois de validar e persistir a entrega, deixando o trabalho de coleta para um worker. Se a persistência falhar, devolver erro temporário. A Pluggy documenta tentativas finitas; recuperação também precisa de reconciliação periódica/checkpoint, não só webhooks. Não depender de tarefa em memória depois da resposta HTTP.
- **Limite de confiança:** webhook não recebe JWT bancário do navegador nem lança gasto em nome do usuário. Ele alimenta somente a origem/inbox privada. Confirmar a despesa exige sessão autorizada e transação restrita ao dono. Tokens do agregador ficam no backend; a IA recebe apenas os campos autorizados e minimizados, nunca tokens, CPF ou número de conta por padrão.
- **IA assistiva:** descrição e contraparte vindas do banco são dados não confiáveis, não instruções para o modelo. Categoria sugerida não pode alterar valor, dono, competência, parcela ou destino de compartilhamento. Regras determinísticas calculam os valores; confirmação financeira continua explícita.

### Etapas e critérios de saída

1. **Descoberta:** confirmar plano/cobertura PF Nubank e Inter, definir consentimento/dados mínimos, custo e contrato. Resultado: matriz preenchida, sem contratação automática. CSV/OFX é uma alternativa de captura para testar revisão; não é requisito obrigatório para Open Finance.
2. **Fundação em ambiente isolado:** adaptador de origem independente de fornecedor, inbox privada, vínculo de confirmação, RLS, ledger/idempotência e auditoria sem segredos. Documentar e revisar migração aditiva antes de executar. Reaproveitar telas/controladores e cálculo em centavos existentes.
3. **Sandbox:** autorização simulada identificada, eventos reais do sandbox e falhas reproduzíveis. Testar concorrência, dez reentregas, todas as páginas, confirmação incerta com reload e confirmação concorrente no Cofre/Casa. Não contabilizar dados de sandbox como produção.
4. **Piloto autorizado:** uma conexão de cada instituição, com consentimento do próprio usuário, revisão manual obrigatória e acesso privado. Medir se os dois produtos necessários realmente chegam; confirmar atraso, renovação, reconexão e revogação. Não chamar esse teste de concluído antes de executá-lo.
5. **Liberação gradual:** medir tempo para confirmar, correções de classificação, itens duplicados bloqueados e coletas incompletas. Critérios financeiros: zero duplicação nos cenários ensaiados, nenhum compartilhamento indevido, nenhum acerto/fatura inflando despesas e revogação interrompendo novas coletas. Automatização sem revisão fica para uma decisão posterior baseada nos resultados.

### Referências públicas verificadas em 21/10/2026

- [Pluggy: Open Finance](https://docs.pluggy.ai/en/docs/open-finance/overview).
- [Pluggy: cobertura Open Finance por instituição](https://docs.pluggy.ai/en/docs/open-finance/institutions-coverage).
- [Pluggy: cobertura de conectores diretos, distinta da regulada](https://docs.pluggy.ai/en/docs/connections/connectors-coverage).
- [Pluggy: recursos realmente declarados pelo consentimento](https://docs.pluggy.ai/en/docs/connections/resources).
- [Pluggy: transações, paginação, pendências e troca de IDs](https://docs.pluggy.ai/en/docs/products/transactions).
- [Pluggy: webhooks, tentativas e cabeçalhos configuráveis](https://docs.pluggy.ai/en/docs/developer-tools/webhooks-ref).
- [Belvo: agregação Open Finance Brasil](https://developers.belvo.com/products/aggregation_brazil/aggregation-brazil-introduction).

As páginas acima foram lidas; nenhuma API autenticada de agregador foi chamada. A página do BCB respondeu como shell JavaScript; a página consultada do Open Finance Brasil retornou 403 e links iniciais dos bancos retornaram 404. Não foram usados como evidência de cobertura. Preços, frequência contratada, entidades responsáveis e funcionamento em contas reais continuam não verificados.

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

O ambiente de ensaio compatível e isolado foi validado em 20/10. Para a próxima etapa, seguir descoberta, fundação transacional, sandbox e piloto definidos no refinamento de 21/10. A importação assistida de arquivo permanece uma opção para validar a mesma inbox; não deve atrasar obrigatoriamente uma POC Open Finance se houver acesso a sandbox e condições adequadas.

Esta rodada não contrata parceiro, provisiona conexão bancária, cria tabela ou endpoint de importação, nem habilita registro automático.
