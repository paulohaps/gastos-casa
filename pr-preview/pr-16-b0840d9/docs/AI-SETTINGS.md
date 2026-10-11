# Configuração individual de IA — 2026-10-11

Em **Ajustes → Inteligência artificial**, escolher provedor e modelo, colar a chave e salvar. **Testar conexão** faz uma chamada curta sem dados financeiros e não salva a configuração. A chave salva pode ser mantida ao trocar de modelo. Mudar de provedor exige uma chave do novo provedor. Há links para obter a chave, opção de identificador personalizado e remoção com confirmação.

## Provedores

Catálogo central: `backend/services/ai-settings.mjs`. Modelos sugeridos, conferidos na documentação oficial nesta rodada:

- Gemini: `gemini-3.5-flash-lite` (recomendado), `gemini-3.8-flash`.
- DeepSeek: `deepseek-flash` (recomendado), `deepseek-v4-pro`.

Referências: https://ai.google.dev/gemini-api/docs/models e https://api-docs.deepseek.com/quick_start. O acesso, saldo e disponibilidade dependem da conta do provedor. O identificador personalizado acomoda mudanças futuras no catálogo sem permitir URLs arbitrárias.

Gemini usa `generateContent` com `x-goog-api-key`; DeepSeek usa Chat Completions com bearer token e thinking desativado. URLs são fixas, redirecionamentos são recusados, timeout é 12 segundos. Explicações têm teto de 180 tokens de saída; o teste usa 32. Gemini usa nível mínimo de thinking, ou orçamento zero nos modelos 2.5. Falhas mantêm as heurísticas e exibem um aviso claro.

## Privacidade

Migração `db/migrations/20261011_private_ai_settings.sql`, aplicada primeiro na branch isolada. RLS exige dono autenticado e membro ativo. O backend fixa dono e JWT pela sessão; ignora identidades fornecidas no corpo.

O segredo `AI_SETTINGS_ENCRYPTION_KEY` deve conter 64 dígitos hexadecimais (32 bytes aleatórios) e existir somente no ambiente da Function. AES-256-GCM usa IV aleatório, tag de autenticação e identidade do dono como AAD. Não rotacionar o segredo sem migrar os ciphertexts existentes; perdê-lo torna as chaves salvas irrecuperáveis. Gerar um segredo independente para produção, sem copiar o segredo de preview e sem commitá-lo.

`GET /ai/settings` retorna apenas metadados, catálogo e disponibilidade do armazenamento. Não retorna chave, nem ciphertext. O formulário usa input de senha, limpa o segredo após salvar ou navegar para outra área, e não persiste a chave em localStorage, URL ou cache da PWA. Os campos ficam bloqueados enquanto uma ação está em andamento. Erros do provedor são traduzidos, sem registrar ou devolver o corpo bruto.

`POST /ai/settings` aceita `save`, `test` e `delete`. Testes têm intervalo de 30 segundos por usuário/processo. Configuração pessoal tem prioridade sobre `INSIGHTS_AI_*` geral. Sem configuração, a IA não é chamada. As análises recebem somente o resumo recalculado da carteira autenticada, nunca históricos brutos. Cache considera provedor, modelo, impressão criptográfica da chave e resumo; mudar/remover a conexão não reutiliza respostas da chave anterior.

## Verificação e publicação

88 testes unitários; testes de UI para escolha de modelos, teste sem salvar, manutenção da chave ao trocar modelo, mudança de provedor, remoção, privacidade no navegador e cofre em mobile/desktop. `tests/ai-settings-rls.sql` verifica isolamento real entre dois membros e reverte as fixtures. Chamada real a Gemini/DeepSeek depende da chave do usuário; testes automatizados simulam as respostas dos provedores.

Publicar primeiro migrações e backend com o segredo de criptografia, depois o frontend compatível. Preview isolado permanece no PR #16; alterações visuais de produção seguem a validação do usuário definida em `PROJECT-STATE.md`.
