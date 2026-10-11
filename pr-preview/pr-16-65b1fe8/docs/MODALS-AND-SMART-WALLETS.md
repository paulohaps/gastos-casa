# Modais unificados e carteiras com decisões explicadas

## Direção desta rodada

O usuário pediu validar e padronizar todos os modais, gráficos com exploração dos detalhes e utilidades que tornem a carteira atraente. A direção financeira e a legibilidade continuam vigentes. Este documento complementa FINANCIAL-DIRECTION.md e substitui os padrões locais de diálogo.

## Implementado

- Um sistema de diálogo nativo no CSS canônico e em AppUI: tamanho, cabeçalho, ação de fechar, campos, rodapé, fundo e rolagem consistentes.
- Foco inicial e retorno à ação que abriu; Tab/Shift+Tab permanecem no diálogo; Escape fecha; conteúdo de fundo fica inativo e sem rolagem.
- Durante salvamento, fechar e Escape ficam bloqueados para evitar abandonar uma operação sem saber seu resultado. Erros de carteira e pagamento aparecem dentro do diálogo, preservando dados para tentar novamente.
- Clique no fundo fecha apenas escolhas e confirmações; formulários exigem Fechar, Cancelar ou Escape para evitar descartar dados por um toque acidental.
- O scanner segue processando imagem localmente; fechar o diálogo interrompe a câmera e invalida a sessão de leitura.

### Inventário completo

| ID | Uso |
| --- | --- |
| entryChoiceDialog | Destino do novo gasto |
| walletCreateDialog | Criar carteira pessoal |
| walletExpenseDialog | Criar/editar gasto pessoal |
| walletSettings | Nome e limite da carteira |
| confirmDialog | Confirmações, exclusões e alternativa de resumo quando a cópia falha |
| settlementDialog | Registrar pagamento do acerto |
| smartScannerBackdrop | Scanner QR/cupom |
| chartDetailsDialog | Detalhes dos gráficos |
| walletSimulatorDialog | Simular impacto de uma compra |

Não há mais controladores paralelos de foco/backdrop para scanner e acerto. O comportamento compartilhado está em js/ui.js, com ciclo de câmera no módulo do scanner e ações de negócio nos respectivos módulos.

## Gráficos com drilldown

A Casa mostra barras por pessoa e por categoria. O cofre possui distribuição por categoria em uma seção expansível. Cada barra é também um botão acessível: apresenta valor, participação e quantidade de lançamentos. Toque, Enter ou Espaço abre um diálogo com contexto, total e lançamentos que compõem o número.

O componente usa HTML e CSS locais, sem depender de Chart.js/CDN para exibir os gráficos. A visualização e a leitura dos números continuam disponíveis quando a dependência externa não carrega. Dados da Casa e do cofre não são combinados. Trocar carteira/mês ou navegar fecha o detalhamento, e fechar remove sua lista de lançamentos do DOM.

## Utilidades inteligentes já disponíveis

### Posso gastar?

Uma compra hipotética é descontada do orçamento real da carteira. O usuário pode informar uma reserva temporária para despesas ainda não lançadas. O resultado distingue:

- compra dentro do limite e da reserva;
- compra dentro do limite, mas reserva insuficiente;
- compra acima do limite;
- carteira sem limite, em que não há base para avaliar.

A simulação mostra limite após a compra e, quando o plano possui dias restantes, uma referência diária descontando a reserva. Não grava lançamentos nem persiste a reserva. Não consulta saldo bancário ou compromissos que o usuário não informou. O texto explicita essas condições; “cabe no limite informado” não é uma garantia de capacidade financeira.

### Ritmo do mês

O cofre mostra referência diária e uma estimativa de gasto ao fim do mês. A estimativa exige mês atual, ao menos sete dias e três lançamentos, usando gasto acumulado / dias decorridos × dias do mês. Há aviso sobre despesas concentradas no início do mês. Mês antigo, amostra insuficiente ou ausência de plano não recebem projeção artificial.

### Limite excedido

O excesso aparece diretamente no painel principal, inclusive quando dicas estão recolhidas. Seleção de carteira passou a usar apenas a lista; os cartões repetidos foram removidos.

## Correções de confiança

Totais da Casa, nomes no histórico, filtro de pessoas, gráfico e resumo compartilhável agora incluem todas as pessoas presentes nos lançamentos. O teste inclui uma terceira moradora, Maria Silva, com gasto de R$ 50.

A divisão de acertos existente ainda é a regra de Paulo/Fernando. Esta rodada não transforma essa regra em divisão genérica entre N moradores. A evolução de acertos deve definir participantes e quotas e validar os contratos do backend antes da implementação.

A lateral passa a ter rolagem própria em janelas baixas. Nomes acessíveis da marca e do botão de compartilhar foram corrigidos.

## Diferencial de produto e prioridades seguintes

Proposta: organizar a vida financeira da casa e o planejamento pessoal privado em um só lugar, com respostas rastreáveis aos lançamentos e decisões rápidas antes de gastar. A separação de espaços, revisão antes de salvar, imagens processadas localmente e provedor individual de IA dão suporte a essa proposta.

A preferência pelo produto é uma hipótese a validar com pessoas reais; não decorre apenas de mais recursos ou de trocar a aparência.

Próximas prioridades de produto, ainda não implementadas nesta rodada:

1. Chat financeiro real, autenticado, reutilizando Gemini/DeepSeek e escolhendo explicitamente Casa/Cofre e mês. Deve responder com evidências, manter privacidade e propor lançamentos para revisão.
2. Metas pessoais persistidas, com valor, prazo e contribuição planejada; distinguir orçamento de gasto de dinheiro efetivamente reservado.
3. Contas pessoais previstas e recorrentes para que o simulador possa usar compromissos reais autorizados, mantendo deduplicação ao lançar.
4. Entradas/transferências e exportação: exigem um modelo de movimentação consistente; transferência não deve aumentar gastos artificiais.
5. Divisão configurável da casa entre participantes, antes de apresentar acertos genéricos.

Validar com um pequeno grupo: tempo para lançar o primeiro gasto; entendimento da diferença Casa/Cofre; capacidade de explicar um número pelo gráfico; uso do simulador antes de uma compra; retorno semanal. Não foram adicionados rastreamento ou analytics nesta rodada.

## Verificação e publicação

Assets 20261011-006; cache gastos-ape-v52. O precache inclui o planner e o componente de gráficos. Preview continua com backend isolado e service worker desabilitado.

91 testes unitários; 18 testes de navegador, incluindo nove modais em 320×568, 390×600 e 1366×768, foco/Escape/rolagem/bloqueio, CRUD e falha recuperável, gráficos, terceiro morador, simulação sem gravação e troca de carteira/mês. Auditoria axe dos nove diálogos em três larguras: nenhuma violação automática nos estados avaliados. Capturas foram inspecionadas no celular e desktop.

Os cenários de navegador usam API simulada; não equivalem a testar câmera em iPhone físico, chamadas reais aos provedores ou toda a aplicação em produção. Nenhuma mudança de banco/backend foi necessária. Produção continua condicionada à validação visual do preview pelo usuário, conforme PROJECT-STATE.md.
