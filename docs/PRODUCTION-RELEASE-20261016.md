# Publicação e rollback — Gastos Casa 2.0

Estado da entrega: migrações e backend publicados; frontend liberado para promoção pelo workflow após a CI exata de main. A versão ativa é registrada em `https://paulohaps.github.io/gastos-casa/release.json` e nos resumos do workflow.

## Escopo e recuperação

Publicação autorizada pelo proprietário nesta conversa em 16/10/2026. Promover frontend validado e backend compatível, sem reescrever histórico financeiro. Rollback padrão troca somente os arquivos do frontend por uma versão arquivada, mantendo backend seguro, chave de criptografia e todos os registros novos. Não restaurar banco automaticamente nem reabilitar gravação insegura de acertos.

- Produção anterior: frontend main `6e99647735be3344590d8b0a98dcd8380b5c9ce7`, raiz de Pages preservada a partir de `cc02de3c3cae95512e31a88ebdcea20a5e33e64a`. Backend Function `gastospwa`, deployment 24, versão `2026-09-19.10`.
- Arquivo completo da raiz anterior: `/workspace/artifacts/releases/gc20-20261016-01/previous-production.tar`, SHA-256 `05392a01587c73e085d9681f97a64f09cb3f0583e057dc065f26c3f8865dc201`. Nenhuma chave/registro financeiro incluído.
- Banco principal: `frosty-star-45149603/br-floral-night-acsx867x`, DB `gastos_casa`.
- Cópia de recuperação sem compute: `br-still-queen-acvys5n7`, `backup-pre-gc20-20261016-01`, LSN `0/23CBF90`. Não alterar/apagar essa branch. O plano atingiu o limite de snapshots e de branches protegidas; a cópia é uma branch comum, sem proteção automática.
- Ensaio de banco: `br-dry-sea-ac9sj8ie`; sem TTL, pois a Data API recusou a branch com expiração. Limpeza fica pendente após encerrar a validação. Migrações executadas em transação única, com lock, timeouts e ledger/checksums. Gastos/acertos copiados permaneceram com as mesmas assinaturas antes e depois. Nenhuma linha financeira foi exportada.
- Auth do ensaio criado no banco separado `release_identity` dessa branch, com contas sintéticas `example.invalid`, verificação por e-mail desativada. Auth de produção preservado.
- Ensaio Function: slug `gc20releasecheck` na branch Functions `br-polished-voice-a5flam43`, apontando exclusivamente para Auth/Data API do ensaio. A Function pública `gastospwa` não foi alterada por esse ensaio; foi promovida depois da validação, como deployment 25. Branch Functions temporária `br-weathered-flower-a5t11fb8` também expira em 18/10; sua URL respondeu 404 apesar do deployment concluído, portanto não foi usada como evidência de publicação.
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

## Validação autenticada e promoção de infraestrutura

- O erro 500 da Data API isolada foi resolvido após reinicializar somente o compute do ensaio e atualizar o cache de esquema. A API nativa retornou capacidade `cents-v1` com identidade real.
- `scripts/test-release-api.mjs` passou com contas sintéticas, sessões/JWT reais, Function hospedada, Data API e RLS nativas: duas quitações simultâneas produzem um único pagamento; replay não duplica; chave com payload divergente conflita; INSERT direto e frações de centavo são recusados; pagamento não infla despesas; Cofre/meta e histórico respeitam propriedade; configuração de IA é criptografada e redigida. Nenhuma chamada Gemini/DeepSeek foi feita com chave real.
- Limpeza removeu somente os registros sintéticos criados pelo ensaio. As assinaturas de todos os gastos/acertos originais continuaram iguais.
- Produção recebeu as seis migrações em uma única transação, com ledger/hash/lock e cache de esquema atualizado. Gastos/acertos permaneceram com as mesmas assinaturas antes/depois. RLS habilitada nas novas tabelas; INSERT/UPDATE direto de acertos revogado; ledger de migração e requisições não recebem escrita de authenticated.
- Function de produção `gastospwa` promovida de deployment 24 para **25**, versão `2026-10-15.1`, com o mesmo ZIP ensaiado. Cinco variáveis anteriores preservadas e chave de criptografia de produção gerada separadamente; nenhum segredo no Git/artefatos públicos.
- Branch adicional `br-ancient-math-ac1ikxtb` foi criada diretamente de main durante o diagnóstico; compute `ep-winter-unit-acpkv7mb` suspenso, sem alterações de dados. Não é usada pelo aplicativo. Limpeza de branches de ensaio fica pendente; a branch de recuperação inicial deve ser conservada.
- CI da preparação `f65c49a`: 203 unitários + 163 cenários de navegador e oito grupos Postgres aprovados. Sem mudanças adicionais no visual/cálculos desde a versão validada.

## Ensaio de rollback com PWA

Os arquivos reais da produção anterior e o build candidato foram servidos numa cópia Git local isolada, com service worker habilitado em Chromium mobile. A sequência anterior → candidato → rollback anterior → candidato passou, com o mesmo armazenamento local de teste e sem limpeza manual de cache. O cabeçalho moderno foi medido em 65 px. Evidências em `/workspace/artifacts/releases/gc20-20261016-01/pwa-rehearsal.json` e quatro capturas.

Alvo da raiz anterior: **`legacy-b71b4947d241fd9e`**. Após a promoção, o workflow arquiva essa mesma raiz e registra o ID novo `prod-<12 caracteres do commit main>`. Para retornar à versão nova depois de um rollback, usar o ID novo, não recompilar uma branch antiga.

```bash
gh workflow run deploy-production-pwa.yml --ref main -f mode=rollback -f release_id=legacy-b71b4947d241fd9e
```

O comando restaura somente o frontend. Para seguir novamente à versão nova, usar `mode=rollback` com o ID novo exibido em `release.json` antes da reversão. O banco, os lançamentos posteriores, o ledger e a chave de criptografia permanecem no lugar.

Pendências que não foram simuladas como concluídas: Safari/iPhone físico, login com a conta pessoal do proprietário em produção e chamada com chave real Gemini/DeepSeek. O ensaio autenticado usa identidades próprias e dados sintéticos numa cópia isolada; não cria usuários/lançamentos de teste na produção.
