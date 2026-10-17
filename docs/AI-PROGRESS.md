# Recuperação e validação — 17/10/2026

O ambiente anterior foi substituído antes do push dos commits locais. Os hashes antigos citados na conversa não estão no remoto e não são referência desta implementação. Base recuperada: `731df88`. Branch nova: `recover/financial-reliability-20261017`.

As correções estão sendo reconstruídas a partir dos registros da conversa, com nova revisão e nova execução dos testes. Contagens anteriores não comprovam esta branch.

Escopo: leitura completa/centavos do Cofre, navegação mensal do chat, datas civis locais, comparação coerente, proteção/feedback do formulário e operação transacional idempotente de cadastro. Migração aditiva; nenhum dado histórico deve ser reescrito. `release/production.json` permanece bloqueado até ensaio hospedado.

Próximas etapas: regressões novas, lint/tipos/build, suíte integral, PostgreSQL local e ensaio Auth/JWT/Data API/RLS em `br-dry-sea-ac9sj8ie`. Nunca usar endpoints de produção nos testes de escrita. Preservar branch remota a cada marco. Resultados serão registrados somente após execução.
