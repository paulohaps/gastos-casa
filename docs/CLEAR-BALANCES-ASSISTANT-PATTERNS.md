# Saldos claros e contexto financeiro do assistente — 16/10/2026

## Problema e comportamento final

O Início mantinha o saldo como indisponível mesmo após a promoção do servidor com política cents-v1. O assistente recebia categorias/totais mensais, sem os pagamentos de acerto ou agregações diárias. Valores pagos pelos participantes não representam suas responsabilidades.

Início mostra total de gastos, minha parte nas despesas, o que devo à outra pessoa e o que ela me deve. A seção aberta “Quem deve a quem” detalha Dinheiro/Vale e fica também na visão geral da Casa. O mês está sempre explícito. Os atalhos levam ao fluxo existente de registrar pagamentos. Na Casa, os totais por pessoa agora dizem “Pago por”. Nenhuma dívida é compensada automaticamente entre métodos ou competências; nenhum saldo mensal é apresentado como pendência acumulada de todo o histórico.

O núcleo de leitura `GastosSettlementCore.summarize`, reutilizado por React, Casa e backend, agrupa cada competência/método antes de usar o calculador existente. Retorna centavos inteiros, dívidas separadas por direção e responsabilidades. Preserva a regra do centavo residual de PH, o histórico e a RPC transacional existente. Método/participante/período inválido impede divulgar saldo. A UI exige confirmação de lista completa e capacidade atômica; erro ou resposta parcial nunca vira quitação.

Filtros de método atualizam os saldos correspondentes; categoria, pagador, busca e escopo pessoal os tornam explicitamente indisponíveis. Um pagamento não tem categoria de despesa. Dados antigos são invalidados na troca de mês/falha de leitura. O mês inteiro fica acessível no seletor existente.

## Assistente e privacidade

Para contexto Casa, resolve a identidade pelo membro ativo autorizado no JWT, confirma cents-v1 e lê todos os acertos do intervalo, com paginação validada. Calcula pendências exatas após pagamentos e informa ao modelo o significado de cada campo. Falha em identidade/capacidade/pagamentos torna os acertos indisponíveis, sem impedir o resumo dos gastos. O histórico de conversas e seu contrato de snapshots não mudam.

`spending-patterns.mjs` agrega todos os dias da semana e dias do mês, contagem de lançamentos, dias com registros, ocorrências no calendário, totais e médias por ocorrência. Usa datas civis, corte em America/Porto_Velho, ignora datas futuras apenas no padrão e não inventa recorrência. Médias são referências arredondadas para exibição, não novos saldos. Poucos dias de registro são identificados como evidência insuficiente. Um mês não comprova repetição mensal. Dias sem registros entram na referência de calendário, sem afirmar que houve cobertura completa dos gastos reais.

No contexto Casa, há recortes distintos: todos os gastos compartilhados e somente os pagos pelo usuário autenticado. Esses pagamentos não são chamados de responsabilidade nem de todos os gastos pessoais. O cofre permanece privado: contexto pessoal não consulta gastos, participantes, capacidade de acertos ou pagamentos compartilhados. Para comparar mais meses, selecionar o intervalo no chat; não inferir períodos fora desse contexto.

Perguntas sugeridas incluem quem deve a quem e dias de maior gasto. Gemini/DeepSeek e configuração criptografada existentes preservados. O teste do contexto não faz chamadas cobradas ao provedor: o texto efetivamente produzido com a chave real ainda depende do modelo e da configuração do usuário.

## Verificação e publicação

- Regressões unitárias: sentidos opostos entre métodos, identidade PH/FG, resíduos por competência, responsabilidade versus pago, lista inválida, período incorreto, quitação real, calendário/semana/dia 31, corte temporal, valores inválidos, contexto autorizado e privacidade, indisponibilidade sem saldo falso.
- Navegador: saldos visíveis em 320/390/1440 px, acesso a Acertos, atualização por pagamento/mês/método, falha sem dado antigo, filtros incompatíveis, perguntas contextuais e lista sem confirmação de integridade. Testes anteriores adaptados somente aos rótulos e ao novo local de Acertos.
- Integração nativa isolada: `scripts/test-assistant-grounding.mjs`, com `GASTOS_RELEASE_SESSION_FILE` e opcional `GASTOS_GROUNDING_REPORT`. URL restrita ao banco de ensaio br-dry-sea-ac9sj8ie. Auth/JWT/Data API/RLS reais, duas identidades, despesas sintéticas 100 e 200,01, acerto 10: dívida pendente 40,01 e padrões somente dos dados autorizados. Passou; registros sintéticos rastreados removidos, membros de ensaio novamente desativados, compute suspenso. Nenhum lançamento real de produção escrito.
- Capturas antes/depois e geometria: `/workspace/artifacts/debts-patterns`. Larguras 390/1440 sem overflow.
- Sem migrações ou alteração de schema. Atualização de backend necessária somente para disponibilizar o novo contexto ao assistente, mantendo todas as variáveis e a chave de criptografia. Backend 2026-10-16.1 publicado como deployment 26, com variáveis e chave herdadas sem alteração; versão/rotas protegidas/CORS verificados. Assets 20261016-001 / cache fonte v78.
- Rollback do frontend para `prod-d97ea1a82bb5`, pelo workflow existente, preserva dados e o backend compatível. ZIP anterior do backend preservado; não reverter migrações nem chave. As alterações financeiras desta rodada são somente de leitura.

Lint/TypeScript/build aprovados, 215 unitários aprovados, 170 cenários de navegador na suíte. Uma regressão de preservação do histórico detectada na rodada integral foi corrigida; os 20 cenários de integridade foram revalidados. Resultado integral canônico e identificadores de publicação registrados na entrega/CI. Safari/iPhone físico e resposta de um provedor com a chave pessoal não são simulados como validados.
