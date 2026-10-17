# Promoção de confiabilidade financeira — 17/10/2026

## Escopo e origem

Promoção autorizada na conversa, após ensaio hospedado da branch `recover/financial-reliability-20261017`. Fonte de execução validada: `b44478052f74df0888eb08288d80549babeecb42`; commits seguintes desta promoção alteram somente manifesto e documentação. PR: https://github.com/paulohaps/gastos-casa/pull/18.

Inclui paginação completa e centavos do Cofre, datas civis, comparação mensal equivalente, navegação do chat e cadastro transacional idempotente. Clientes antigos sem chave permanecem compatíveis. Não modifica dados históricos nem credenciais.

## Infraestrutura confirmada

- Backup atual do banco: `br-green-meadow-acy0qmvw`, filho de produção `br-floral-night-acsx867x`, projeto `frosty-star-45149603`, criado em 17/10/2026 às 15:09 UTC, confirmado ready, sem compute. Backup anterior preservado.
- Aplicadas somente `20261017_00_expense_rpc_owner.sql` e `20261017_expense_requests.sql`, em uma única transação. Segunda etapa executada com `SET LOCAL ROLE gc_expense_rpc_owner`.
- Conferência posterior: proprietário da RPC sem SUPERUSER/BYPASSRLS, SECURITY DEFINER com search_path fixo; authenticated executa, anonymous não executa; authenticated não herda o proprietário; ledger com RLS habilitada.
- Assinaturas agregadas e contagens de `gastos`, `acertos`, `personal_expenses` e `personal_wallets` coincidiram antes/depois. Nenhuma linha financeira de produção criada para testes.
- Function `gastospwa`, projeto `soft-lab-98397625`, branch `br-polished-voice-a5flam43`: deployment **28** concluído/ativo, versão pública **2026-10-17.3**. Seis variáveis existentes herdadas; nenhuma chave de criptografia substituída.
- Deployment 27 apareceu concluído enquanto o endpoint ainda respondia com a versão anterior. A promoção frontend ficou bloqueada. Após uma repetição do mesmo ZIP, deployment 28 e endpoint confirmaram a versão esperada; causa da discrepância não demonstrada.
- ZIP determinístico SHA-256 `3b112131e3869e492d6fb97356e5a841f63fb534faf97cb94a00a6abcc3381d4`; árvore de fontes `9e700caa01f41b635392c40aadebaaf60139f4823e50cf43f62231f54f0c8604`, igual à ensaiada. Não contém segredos.

## Validação e publicação frontend

- Reexecutados nesta promoção: lint, TypeScript, build e 228 testes unitários, aprovados. Gate público `scripts/check-production.mjs` aprovado para versão, quatro rotas protegidas (401) e CORS.
- Ensaio isolado anterior: seis grupos Auth/JWT/Data API/RLS reais, incluindo concorrência/replay, legado e carteira com 1001 registros. Evidência: `validation/RECOVERED-NATIVE-20261017.json`.
- Suíte integral anterior: 178 cenários Chromium e 12 grupos PostgreSQL. CI do PR e de main deve validar novamente antes da publicação automática; não considerar execução pendente como aprovada.
- Manifesto `release/production.json` liberado após confirmação da infraestrutura. Workflow de produção exige CI aprovada do SHA exato de main e nova checagem do backend, arquiva a raiz atual e publica snapshot Git atômico.
- Resultado final da publicação deve ser conferido em `https://paulohaps.github.io/gastos-casa/release.json` e nos workflows do PR/main. Este registro antecede o merge; não comprova sozinho a publicação do frontend.

## Rollback

Versão frontend anterior confirmada: **prod-731df889b83f**. Após a promoção, conferir `previous_release` no release.json público.

No GitHub Actions, executar **Deploy Production PWA** em main, escolher **rollback** e informar `prod-731df889b83f`. Equivalente:

```sh
gh workflow run deploy-production-pwa.yml --repo paulohaps/gastos-casa --ref main -f mode=rollback -f release_id=prod-731df889b83f
```

Esse rollback restaura somente os arquivos frontend e conserva banco, ledger e backend compatível com o cliente antigo. Não restaurar o banco rotineiramente: isso poderia descartar operações novas. Backup é recuperação excepcional, com validação/autorização própria.

## Limitações

Safari/iPhone físico e provedores Gemini/DeepSeek reais não exercitados. Nenhum teste autenticado de escrita executado em produção. Associação local de tentativa incerta não sobrevive a reload; INSERTs diretos ou chaves diferentes não são deduplicados. Projeções continuam heurísticas. Nenhum segredo ou valor pessoal copiado para documentação.
