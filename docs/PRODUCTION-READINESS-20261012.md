# Avaliação de usabilidade e prontidão — 12/10/2026

## Parecer

**Não publicar a versão completa em produção ainda.** Os cenários automatizados do frontend estão funcionando, mas a produção ainda não possui o backend, o esquema e a configuração de criptografia usados pela prévia. Publicar só os arquivos do frontend quebraria Cofre, configuração de IA e histórico do Assistente.

Esta rodada usa testes automatizados e inspeção visual com dados demonstrativos; não é um estudo com participantes idosos nem comprovação de funcionamento em todo dispositivo. Não foram usados registros financeiros, senhas ou chaves reais do usuário.

## Facilidade de uso

| Fluxo | Resultado da avaliação |
|---|---|
| Trocar entre as cinco áreas | Navegação visível e ativa nos tamanhos avaliados; sem overflow horizontal nas 24 capturas iniciais |
| Sair do Assistente com teclado aberto | Problema confirmado: barra inferior oculta sem saída nomeada. Corrigido com acesso Início no cabeçalho, alvo de 48 px |
| Voltar ao chat | Conversa e pergunta em rascunho conservadas no teste de saída/retorno |
| Contexto do chat em 320 px | Nome Casa estava abreviado pela falta de espaço; campos empilhados nessa largura e nome legível verificado no teste |
| Ler e copiar a resposta | Parágrafos/listas, resumo calculado e cópia com falha recuperável cobertos pelos testes existentes |
| Registrar e revisar gasto | Fluxos Casa/Cofre, revisão antes de salvar, edição e confirmação de exclusão cobertos pela suíte |
| Configurar IA | Presets ajudam, mas obter uma chave ainda depende de conta no provedor e conhecimento externo. IA não configurada oferece orientação e conserva a pergunta |
| Toque em controles secundários | Encontrados alvos menores que 44 px. Ampliados para 48 px: mês da casa, Ver todos, link da chave, resumo de privacidade, categoria de regra, período das métricas e marca móvel |
| Login, modais e falhas | Cobertura de foco, Escape, teclado simulado, 503 preservando sessão e respostas fora de ordem |

A saída explícita evita exigir que o usuário saiba fechar o teclado para encontrar outra aba. Não é necessário concluir toda a migração dos módulos legados para liberar, desde que os fluxos integrados sejam validados; Casa/scanner ainda legados são dívida técnica registrada, não o bloqueio principal deste parecer.

## Bloqueios confirmados em produção

Inspeção somente de leitura, em 12/10/2026:

| Verificação | Produção | Prévia |
|---|---|---|
| GET /health | 200, versão 2026-09-19.10 | 200, versão 2026-10-11.2 |
| GET /wallets sem sessão | **404** | 401, rota protegida registrada |
| GET /ai/settings sem sessão | **404** | 401, rota protegida registrada |
| GET /assistant/conversation sem sessão | **404** | 401, rota protegida registrada |
| Deploy ativo da Function | 24, de 22/09 | 11, de 11/10 |
| Nome AI_SETTINGS_ENCRYPTION_KEY na configuração ativa | Ausente | Presente |
| Tabelas personal_wallets, personal_expenses, private_ai_settings e assistant_conversations no banco principal/previews | **Ausentes no banco principal** | Presentes, RLS habilitada |
| Colunas goal_* e constraint multimensal | Ausentes | Presentes |

O 401 confirma o registro e a proteção da rota; **não** comprova a integração autenticada com o banco ou provedor real. Nomes de variáveis foram conferidos; nenhum valor secreto foi consultado ou publicado.

Banco principal consultado: `frosty-star-45149603/br-floral-night-acsx867x`, DB `gastos_casa`. Banco isolado: `br-broad-unit-acfw9voz`. Functions: projeto `soft-lab-98397625`, produção `br-polished-voice-a5flam43`, prévia `br-lucky-firefly-a50tfkjv`, slug `gastospwa`.

## Sequência para publicar

1. Preparar recuperação e artefatos da versão atual. Revalidar as migrações em uma branch isolada do estado atual de produção, antes de aplicá-las ao banco principal.
2. Aplicar as migrações revisadas, nesta ordem: `20261011_personal_wallets.sql`, `20261011_wallet_goals.sql`, `20261011_private_ai_settings.sql`, `20261011_assistant_conversations.sql`, `20261011_assistant_periods.sql`. Não executar novamente as migrações CREATE TABLE em um esquema que já as recebeu. Confirmar RLS, grants e recarga do esquema da Data API.
3. Configurar uma chave de criptografia estável em `AI_SETTINGS_ENCRYPTION_KEY` (32 bytes, representados por 64 caracteres hexadecimais). Guardar como segredo de produção, sem copiar valores de staging, imprimir ou colocar em Git. Preservar os valores corretos de Auth, Data API, origem e flags de produção.
4. Publicar o backend correspondente nessa Function de produção. Confirmar rotas e realizar teste autenticado: Casa, carteira privada, configuração de chave e retomada/exclusão do histórico. Verificar isolamento entre usuários e entre Casa/Cofre.
5. Validar ao menos uma conversa com uma chave real escolhida pelo usuário. Verificar no iPhone: abrir teclado, enviar/parar resposta, sair pelo Início, voltar e usar modais. Essas validações ainda estão pendentes.
6. Só então promover o frontend da PR16 para main, após avaliação da prévia e aprovação de publicação. O workflow de main publica o frontend automaticamente; ele não aplica essas migrações nem configura/publica o backend.
7. Conferir navegação, login e cache PWA após promoção. Em rollback, voltar aos artefatos compatíveis; não apagar tabelas ou registros financeiros como forma de rollback.

Esta avaliação **não aplicou migrações, não alterou variáveis e não publicou em produção**.

## Evidências e validação

- Capturas iniciais: `/workspace/artifacts/usability-readiness-20261012`, seis áreas em 320, 390, 768 e 1366 px, dados demonstrativos. JSON inicial registra os alvos pequenos encontrados antes da ampliação.
- `infrastructure.json` contém metadados públicos e resultados de catálogo, sem dados pessoais ou valores de segredos.
- Novos casos em `tests/usability-readiness.spec.mjs`: sair com teclado em 320/390 px, saída por teclado, conservação de conversa/rascunho e alvos de toque.
- Suíte completa local: 166 unitários e 95 de navegador passaram; depois da ampliação de alvos, seis testes de usabilidade e os cenários V3 passaram. CI da revisão com os seis casos novos confirmou 166 unitários e 97 de navegador (263 no total). Após o ajuste de contexto em 320 px, 24 casos de usabilidade/V3/teclado passaram novamente; CI da revisão final também é conferido antes do encerramento. Lint, TypeScript e build passaram. Scanner/OCR e provedores são simulados nos cenários de navegador; não substituir essa cobertura por uma alegação de teste real de câmera/provedor.

Prévia estável: https://paulohaps.github.io/gastos-casa/pr-preview/pr-16/


## Complemento — correções preparadas após a avaliação de Product Design

A rodada descrita em `FINANCIAL-INTEGRITY-REFINEMENT.md` implementa RPC atômica, idempotência e cálculo em centavos. A migração `20261015_atomic_settlements.sql` é adicional à sequência acima e deve ser validada numa branch do esquema real antes da promoção. Ela revoga INSERT/UPDATE diretos de acertos para authenticated; publicar junto do backend que utiliza a RPC. A nova interface verifica a capacidade do banco pelo backend e mantém gravação de pagamentos indisponível quando o ambiente não a confirma.

Testes em Postgres descartável não certificam o esquema, os segredos ou a implantação de produção. Nenhuma migração/deploy remoto foi executado nesta rodada. Os 404 de Cofre/IA/histórico e demais dependências de produção não são resolvidos por uma publicação isolada do frontend. Conservar backups/ledger e não reabrir gravação insegura como rollback.
