# Prioridade atual — 20/10/2026

- Concluído: fechar a experiência existente na prévia integrada. Backend compatível e isolado, sessão separada, mobile compacto, histórico desconhecido consistente e ensaio real dos fluxos. CI 241 unitários / 206 navegador / 12 PostgreSQL aprovada; detalhes em INTEGRATED-EXPERIENCE-20261020.md.
- Próximo: validar uso com o usuário na prévia, iPhone físico e Gemini/DeepSeek reais com chave fornecida pelo próprio usuário. O ensaio automatizado usou WebKit real e upstream de contrato identificado como simulado; não extrapolar para modelos reais.
- Acompanhar: um total zero intermediário no WebKit após recarga não se repetiu na rodada integral; diagnóstico está disponível no runner. Não declarar causa solucionada sem reprodução.
- Não iniciar captura bancária ou novas funções nesta rodada. Pendências técnicas históricas abaixo permanecem no backlog; nenhuma nova migração foi necessária.

# Backlog recuperado — 17/10/2026

- P1: Cofre completo/exato, drill-down sincronizado, cadastro transacional idempotente: implementados; resultados em AI-PROGRESS.
- P2: datas civis, comparações coerentes, feedback e preservação de tentativa incerta: implementados; resultados em AI-PROGRESS.
- P1 de release: ensaio nativo da RPC e paginação de 1001 itens: executado duas vezes com sucesso; papéis sem BYPASSRLS na nova RPC, RLS real e limpeza sintética. Produção promovida e verificada; evidência em validation/PRODUCTION-20261017.json.
- Release concluído: CI exata, backup, migrações aditivas, backend e frontend promovidos. Preparação administrativa deve preceder migração executada com SET ROLE gc_expense_rpc_owner. Contrato antigo sem chave preservado via UUID do servidor, sem prometer idempotência de replay aos clientes legados; frontend novo conserva sua chave. Manifesto liberado após verificar backend compatível e promoção autorizada.
- P2: retomar tentativas incertas após reload sem expor rascunhos financeiros; consolidar demais agregadores legados em centavos com estados de falha.
- P2: vínculo contábil persistido para recorrentes; versionamento de limite por mês. Não inferir histórico inexistente.
- Dispositivo/provedor: Safari/iPhone físico e Gemini/DeepSeek reais continuam pendentes.

Não executar migração destrutiva, alterar chave de produção ou reescrever histórico para resolver estas pendências.

## Rodada de produto — 18/10/2026

- Implementado e validado: workspace definido, Casa/Pessoal, atalhos, inspector de indicadores/acertos, pergunta contextual com rascunho protegido e superfícies coerentes. Relatório INTERACTIVE-WORKSPACE-20261018.md; PR #19, prévia sem promoção.
- Próximo para esta experiência: revisão de uso em Safari/iPhone físico e feedback do usuário na prévia. Não presumir que Chromium comprova teclado/barras nativas do Safari.
- Próximo técnico financeiro permanece recuperação privada da tentativa incerta após reload; fora desta alteração visual.

## Refinamento após rejeição da prévia — 18/10/2026

Implementados: início separado em Agora/Movimentações/Análises, consulta de despesa, histórico paginado e ação mobile sem sobrepor valores. Próxima prioridade de produto: feedback do usuário nessa prévia e validação em Safari físico. Pendências financeiras anteriores permanecem fora deste escopo.

## Rodada app de gastos — 18/10/2026

- Implementados: gasto como protagonista; avisos de acerto sem duplicação; HTTP 404/501 como serviço desatualizado; leitura de concentração e heurísticas explicáveis de valores atípicos/recorrência; plano de integração em PAYMENT-AUTOMATION-ROADMAP.md.
- **P1 ambiente:** substituir backend antigo da prévia por ensaio atualizado com Auth/Data API/RLS isolados comprovados. Não apontar PR ao banco real. Publicar heurísticas no chat somente após esse ensaio.
- P2 produto: importação de extrato com inbox privada e conciliação idempotente, depois seleção de parceiro Open Finance. Dependências/modelo/aceite documentados; não há captura bancária implementada.
- Safari/iPhone físico e provedor real permanecem pendentes.
