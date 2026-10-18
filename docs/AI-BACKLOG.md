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
