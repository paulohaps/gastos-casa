> Direção visual anterior. A escolha mais recente do usuário é clara e elegante, descrita em `FRONTEND-REBUILD-AND-CHAT.md`. Os princípios financeiros e de privacidade continuam válidos.

# Direção financeira — 2026-10-11

O usuário rejeitou a composição anterior e pediu mais organização. Depois da escolha inicial de estilo de aplicativo de banco, refinou a direção para um painel financeiro com destaque no limite restante. Esta rodada organiza dados e ações, sem apresentar orçamento como saldo de conta.

## Composição

- Início: valores do mês primeiro; histórico principal e coluna de espaços/assistente no desktop. No celular, os mesmos blocos seguem uma coluna, com os totais acima do histórico. O banner promocional e a ilustração orbital foram removidos.
- Cofre: carteira e mês, limite restante, gastos, uso do orçamento e ações ficam agrupados em um painel. Histórico e dicas opcionais ficam abaixo. Carteiras adicionais continuam selecionáveis.
- Títulos diretos: Visão geral, Casa, Cofre pessoal, Assistente financeiro e Ajustes.
- Fundo neutro, azul escuro nos valores principais, violeta nas ações, superfícies e alinhamentos consistentes. Texto legível e ações nomeadas da rodada anterior são preservados.

## Implementação

Os componentes de Início e Cofre foram substituídos no CSS canônico, incluindo suas condições responsivas anteriores. A rodada não adiciona outro arquivo de overrides. Os tokens compartilhados e as regras existentes de navegação foram editados. Contratos financeiros, configuração de IA, diálogos e proteção de dados não mudam.

Assets `20261011-005`, cache PWA `gastos-ape-v51`. Documento visual vigente: este arquivo, junto de READABLE-EXPERIENCE.md para os critérios de legibilidade.

## Verificação e publicação

Smoke cobre 320 a 1920px, navegação, scanner, lançamento compartilhado, CRUD pessoal, ajuste/exclusão de carteira, falha recuperável de salvamento, configuração Gemini/DeepSeek, foco, contraste e ausência de overflow. O teste navega pelas barras reais; links do histórico possuem destino próprio em Casa/Despesas.

Preview no PR #16 com backend isolado. Produção continua condicionada à validação visual do usuário conforme PROJECT-STATE.md.
