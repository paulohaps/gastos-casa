# Publicação e rollback — Gastos Casa 2.0

Estado: preparação; ainda sem troca do site de produção.

## Escopo e recuperação

Publicação autorizada pelo proprietário nesta conversa em 16/10/2026. Promover frontend validado e backend compatível, sem reescrever histórico financeiro. Rollback padrão troca somente os arquivos do frontend por uma versão arquivada, mantendo backend seguro, chave de criptografia e todos os registros novos. Não restaurar banco automaticamente nem reabilitar gravação insegura de acertos.

- Produção anterior: frontend main `6e99647735be3344590d8b0a98dcd8380b5c9ce7`, raiz de Pages preservada a partir de `cc02de3c3cae95512e31a88ebdcea20a5e33e64a`. Backend Function `gastospwa`, deployment 24, versão `2026-09-19.10`.
- Arquivo completo da raiz anterior: `/workspace/artifacts/releases/gc20-20261016-01/previous-production.tar`, SHA-256 `05392a01587c73e085d9681f97a64f09cb3f0583e057dc065f26c3f8865dc201`. Nenhuma chave/registro financeiro incluído.
- Banco principal: `frosty-star-45149603/br-floral-night-acsx867x`, DB `gastos_casa`.
- Cópia de recuperação sem compute: `br-still-queen-acvys5n7`, `backup-pre-gc20-20261016-01`, LSN `0/23CBF90`. Não alterar/apagar essa branch. O plano atingiu o limite de snapshots e de branches protegidas; a cópia é uma branch comum, sem proteção automática.
- Ensaio de banco: `br-dry-sea-ac9sj8ie`; sem TTL, pois a Data API recusou a branch com expiração. Limpeza fica pendente após encerrar a validação. Migrações executadas em transação única, com lock, timeouts e ledger/checksums. Gastos/acertos copiados permaneceram com as mesmas assinaturas antes e depois. Nenhuma linha financeira foi exportada.
- Auth do ensaio criado no banco separado `release_identity` dessa branch, com contas sintéticas `example.invalid`, verificação por e-mail desativada. Auth de produção preservado.
- Ensaio Function: slug `gc20releasecheck` na branch Functions `br-polished-voice-a5flam43`, apontando exclusivamente para Auth/Data API do ensaio. A Function pública `gastospwa` não foi alterada por esse ensaio. Branch Functions temporária `br-weathered-flower-a5t11fb8` também expira em 18/10; sua URL respondeu 404 apesar do deployment concluído, portanto não foi usada como evidência de publicação.
- Pacote backend `/workspace/artifacts/releases/gc20-20261016-01/backend.zip`, SHA-256 `baae5dc28137a7e1e1e42bfdd644ea2380d1612ab0d33886e6d687905cccb44b`. Contém somente código backend/núcleos compartilhados e entrada Node 24; sem segredos.

## Migrações e chave

Aplicar somente após o ensaio autenticado, antes do frontend, na ordem já registrada no relatório de prontidão: personal_wallets, wallet_goals, private_ai_settings, assistant_conversations, assistant_periods e atomic_settlements. Ledger `public.gastos_app_migrations` é privado, versiona nome/hash e evita reaplicação divergente. Os seis arquivos permanecem no Git. `DROP CONSTRAINT` de assistant_periods é substituição transacional por regra mais abrangente; não remove dados. RPC revoga escrita direta em acertos e usa idempotência/lock; rollback não deve desfazer essas proteções.

Gerar chave própria de produção, nunca copiar a chave do ensaio. Manter `AI_SETTINGS_ENCRYPTION_KEY` nas próximas implantações; trocar o frontend não exige trocar chave nem restaurar banco.

## Operação do frontend

Workflow **Deploy Production PWA**:

1. Publicação automática somente após **Validate Gastos** integralmente aprovado para o commit exato de main; execução manual publish também confere a CI e a versão do backend.
2. Versões imutáveis em `gh-pages/releases/<release_id>`, com `release.json` e hash do conteúdo. A primeira publicação arquiva a raiz legada automaticamente.
3. Preserva previews, hostname e assets com hash necessários a páginas já abertas. Alteração chega ao site pelo commit de Pages, sem copiar arquivos parcialmente para uma árvore servida.
4. Para rollback: GitHub → Actions → Deploy Production PWA → Run workflow em main → **rollback** → informar o ID anterior exibido no resumo da publicação.
5. O workflow valida arquivo/checksum antes de tocar a raiz. Para voltar à versão nova, executar rollback informando o ID da versão nova arquivada. Não é necessário recompilar.

A versão legada não possui Cofre/chat atualizados e pode não enviar o contrato novo de acertos. Em rollback para ela, conservar o backend atômico; operações incompatíveis devem falhar, nunca voltar ao INSERT inseguro. Dados das funcionalidades novas continuam no banco.

## Validação

Seis regressões de release verificam publicação/restauração em ambos os sentidos, preservação de previews/hostname/assets, idempotência, corrupção, path traversal, diretório errado, backend de prévia e rejeição de arquivos privados/symlinks. Ação padrão não altera banco nem backend. Ensaio integrado e resultado final de publicação serão registrados abaixo.
