# Auditoria recuperada — 17/10/2026

Base remota `731df88`; a sessão anterior perdeu commits locais não enviados. Esta branch reconstrói e testa novamente os achados, não recupera os antigos hashes.

| Evidência na base | Correção nesta branch |
|---|---|
| Cofre encerra paginação em página menor que 1000 | Reutiliza allRows, valida lista/período/valores e recusa orçamento parcial |
| Fronteiras do Cofre aceitam tolerância/frações | Centavos exatos e validação de datas reais |
| Chat emite change sem propagação ao React | Evento com bubbles; regressões verificam totais e histórico |
| Formulários preenchem hoje em UTC | Calendário civil local, também no Cofre |
| Comparativo corta somente o mês anterior | Corte nos dois períodos, calendário válido e centavos; total mensal preservado |
| Submit sem guarda e rótulo restaurado após edição | Guarda síncrona, retry com mesma chave, rótulo correto e falhas posteriores ao commit explícitas |
| INSERT de despesa sem operação persistida | RPC transacional por dono/chave; conflito e replay sem recriar após exclusão |
| Telemetria pode lançar erro após gravação | Efeitos auxiliares best effort, sem repetir em replay |
| Proprietário do banco isolado possui BYPASSRLS | Migração recusa esse executor; papel dedicado sem LOGIN/SUPERUSER/BYPASSRLS, políticas restritas e identidade nativa via wrapper sem leitura financeira |

O último achado foi observado somente no ambiente isolado. Não se presume que uma simulação local com role sem BYPASSRLS comprove o proprietário hospedado. A preparação de papéis/políticas está versionada, foi ensaiada no clone e não aplicada à produção.

Limites: associação local da tentativa não sobrevive ao reload; RPC não deduplica novas chaves/INSERTs diretos; aprendizado/telemetria não têm outbox; agregadores legados ainda merecem consolidação adicional. Nenhuma garantia de ausência de bugs ou auditoria de segurança integral.

## Evidências de UX — 18/10/2026

Composição anterior em css/dashboard.css/css/shell.css removia fundos/contornos de praticamente todas as áreas; DashboardMetrics e BalanceSummary repetiam a pagar/a receber; MetricCard não tinha ação de consulta. A nova composição delimita o workspace, concentra os saldos no resumo e permite inspeção dos dados já disponíveis. Ver comparação com fixtures em INTERACTIVE-WORKSPACE-20261018.md. Cálculos e fontes permanecem os mesmos.

## Revisão do início — 18/10/2026

A primeira prévia mantinha relatório extenso (2698px mobile na fixture) e análises concorrendo com tarefas. A captura da segunda composição revelou FAB cobrindo valor; corrigido com ação em fluxo no início mobile. Evidência e comparações: OPERATIONAL-HOME-20261018.md. Sem problema financeiro novo presumido.
