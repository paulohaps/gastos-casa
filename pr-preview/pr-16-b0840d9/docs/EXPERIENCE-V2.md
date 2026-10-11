# Experiência V2 — 2026-10-11

O pedido de uma interface mais moderna e de reorganização das abas autoriza uma nova arquitetura visual. A diretriz visual V2 substitui a V1. Após a rodada de legibilidade, o CSS foi consolidado em `css/app.css`; consulte `READABLE-EXPERIENCE.md` para as regras vigentes. Os contratos financeiros, autenticação e separação de dados permanecem preservados.

## Onde fica cada tarefa

| Área | Conteúdo |
| --- | --- |
| Início | Resumo da casa, sinais que pedem atenção, acessos aos espaços e gastos recentes |
| Casa · Visão geral | Totais, divisão entre membros, comparativo, orçamento e participação |
| Casa · Despesas | Histórico, busca, filtros, edição, duplicação e exclusão |
| Casa · Acertos | Histórico de pagamentos entre membros |
| Casa · Planejamento | Gastos recorrentes e orçamento da casa |
| Cofre pessoal | Carteiras privadas, resumo do limite, lançamentos em janela própria e recomendações pessoais |
| Assistente | Captura por texto/voz/comprovante, sinais explicáveis, radar e métricas de aprendizado |
| Ajustes | Configuração individual de IA, membros e regras aprendidas |

**Novo gasto** é uma ação persistente que pergunta o destino: casa ou carteira pessoal. O lançamento compartilhado tem uma tela própria, acessível também por editar, duplicar e lançar recorrente. Texto interpretado sempre passa pela prévia existente antes de salvar.

## Direção visual

Barra lateral escura no desktop, navegação inferior com cinco destinos no celular, tipografia Manrope local, superfícies claras, destaque violeta e ilustração orbital em CSS. Ícones SVG acompanham os rótulos. O movimento respeita `prefers-reduced-motion`. A PWA inclui os novos arquivos e a fonte no cache.

## Limites e release

O assistente apresenta análises existentes com evidências; explicação generativa pessoal continua opcional, somente quando o fornecedor estiver configurado. Não simular conversa ou respostas de um modelo ausente.

Validar navegação, ausência de overflow, lançamento manual, scanner, voz, ações entre telas e CRUD privado em mobile e desktop. A produção continua dependendo da validação visual do usuário no preview, conforme `PROJECT-STATE.md`.

## Refinamento do cofre e conexão de IA

Criar carteira e registrar gasto abrem diálogos próprios. O cofre destaca gasto no mês, disponível no limite, referência diária e barra de uso. Movimentações e recomendações possuem áreas distintas; nome e limite ficam em um painel recolhido. Registrar em outra competência abre automaticamente o mês do lançamento. A configuração de IA está em Ajustes, também acessível no Assistente e no cofre.
