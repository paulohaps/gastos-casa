# Interface clara e Assistente em conversa

## Entrega de 2026-10-11

A primeira implementação da direção clara e elegante substitui o tema anterior nos tokens, navegação, cartões, campos e ações compartilhadas. Início tem dois resumos: gastos da casa e orçamento restante da carteira pessoal, ambos com período identificado. O cartão pessoal consulta o servidor, usa a carteira selecionada no Cofre quando disponível e informa indisponibilidade sem inventar saldo. Cofre usa uma superfície suave para orçamento, mantendo movimentos, gráficos exploráveis e simulações existentes.

O Assistente agora permanece na conversa após enviar uma pergunta. Tem mensagens do usuário e do assistente, contexto Casa/carteira + mês, histórico por contexto, sugestões iniciais, resposta progressiva, parar, tentar novamente e conexão de IA. As análises compartilhadas foram para Casa; métricas de interpretação foram para Ajustes. Os handlers antigos que enviavam qualquer pergunta diretamente para lançamento foram removidos. Os estilos antigos de composição do Assistente e os destinos duplicados do Início foram removidos do CSS canônico; `css/chat.css` contém o novo componente de conversa.

## Conversa e privacidade

O histórico agora é privado e persistente no servidor: até cinquenta pares completos por usuário, destino e mês, limitados também a aproximadamente 1,4 MB de JSON. Recarregar a página retoma a conversa. Somente os últimos dez pares completos entram na próxima chamada, com limite adicional de 30.000 caracteres. O servidor usa seu próprio histórico autorizado; mensagens anteriores enviadas pelo navegador não substituem essa fonte.

Trocar carteira/período cancela a geração e abre outro contexto. “Nova” pede confirmação antes de excluir a conversa daquele contexto. Falhas de exclusão preservam o histórico. Controle de versão impede que outra aba ou uma geração antiga sobrescreva ou recrie conversas excluídas. Conflitos pedem recarregar o histórico. Respostas incompletas/canceladas não são persistidas; a pergunta permanece na memória da página para tentar novamente. A retenção não tem expiração automática nesta etapa; o usuário pode excluir cada conversa. Mensagens não vão para localStorage nem para o cache do PWA.

`GET /assistant/conversation?scope=house|wallet&month=AAAA-MM&walletId=...` retoma a conversa. `DELETE` na mesma URL exige `{ id, revision }`. `POST /assistant/chat` recebe também `conversation: null | { id, revision }`; eventos `start` e `end` devolvem a identidade/versão. `end` só é emitido após a gravação do par completo. Clientes de prévias antigas, sem o campo `conversation`, continuam no protocolo temporário anterior.

Encerrar/invalidar a sessão limpa mensagens, seleção de carteiras, valores pessoais e metadados de configuração. Requisições anteriores não repovoam esses dados. Chaves ficam criptografadas no servidor e nunca entram no código ou no histórico do navegador.

Perguntas são enviadas ao provedor configurado junto com um resumo do contexto autorizado: totais, categorias, até doze movimentos recentes, comparação mensal e, no Cofre, orçamento e simulação reconhecida. A mensagem de uso em Ajustes foi atualizada para explicar esse envio. Descrições não são tratadas como instruções de sistema; textos retornados são renderizados com `textContent`, sem HTML executável.

## API e cálculos

`POST /assistant/chat` exige autenticação/JWT. O dono da carteira e da chave é sempre a identidade da sessão; IDs enviados como dono não substituem essa identidade. Carteiras são verificadas por ID + dono antes de consultar despesas. Casa usa o JWT e as políticas existentes para dados compartilhados. Consultas são paginadas até 10.000 registros; falhas, payloads inválidos ou excesso não viram total zero nem contexto parcial.

A rota aceita apenas mensagens alternadas `user`/`assistant`, começando e terminando em `user`. Não aceita roles de sistema ou ferramentas. Até 21 mensagens, 2.000 caracteres por pergunta e 12.000 por resposta. A IA recebe valores agregados e comparação calculados pelo servidor. Simulações de compra reconhecidas reutilizam `GastosWalletPlanner.simulate`, inclusive reserva informada e números brasileiros; hipóteses e ausência de despesas futuras são explícitas. A IA não decide autorizações nem executa gravações.

Gemini usa `streamGenerateContent`; DeepSeek usa Chat Completions com streaming. Ambos mantêm histórico, filtram conteúdo de raciocínio e normalizam SSE em:

- `start`: contexto e provedor/modelo;
- `text`: fragmento da resposta;
- `end`: conclusão e atualização da sessão;
- `error`: código e mensagem seguros, preservando mensagem/sessão.

Comentários de heartbeat mantêm a conexão durante silêncio do provedor. Limite de geração de 45 segundos no servidor, 55 no cliente. Cancelamento interrompe a leitura e o fetch; resposta sem marcador final do provedor é incompleta. O parser compartilhado suporta UTF-8/CRLF divididos entre chunks e limita frames a 128 KiB.

Há proteção local por processo: uma geração ativa por dono, intervalo mínimo de dois segundos e limites de tamanho dos mapas. Isso não é uma quota global entre múltiplos processos. Sem chave aparece configuração guiada; não há resposta de IA simulada em produção. Falhas do provedor não usam 401/403 de sessão; indisponibilidade do servidor de autenticação retorna 503.

## Revisão de lançamentos

Uma descrição explícita de gasto com valor oferece **Revisar como gasto**. Perguntas de análise não oferecem esse botão. A ação reaproveita o interpretador existente, abre a revisão da Casa ou da carteira escolhida e preenche uma proposta. O chat não salva automaticamente. Salvar exige o formulário/revisão existente. Voz, comprovantes, scanner e gráficos continuam nos fluxos existentes.

## Modelos e configuração

Sugestões iniciais: Gemini 2.5 Flash-Lite / Flash e DeepSeek Chat / Reasoner. Modelos personalizados e configurações já salvas continuam suportados. A disponibilidade depende do provedor e das permissões da chave; **Testar conexão** confirma a escolha na conta do usuário. Testes automatizados usam respostas simuladas; não foram consumidas credenciais pessoais para uma chamada real a Gemini/DeepSeek.

## Arquivos principais

- Visual/composição: `index.html`, `css/app.css`, `css/chat.css`, `js/modules/navigation.js`, `js/modules/experience.js`.
- Conversa/cliente: `src/features/assistant/Assistant.tsx`, `src/features/assistant/useAssistant.ts`, `src/shared/api/conversation.ts`, `js/api.js`, `js/core/event-stream.js`, `js/core/http-client.js`, `js/app.js`.
- Backend: `backend/routes/assistant.mjs`, `backend/services/assistant.mjs`, `backend/services/conversations.mjs`, `backend/services/assistant-provider.mjs`, `backend/services/ai-settings.mjs`, `backend/index.mjs`.
- Integração pessoal: `js/modules/wallets.js`, `js/modules/ai-settings.js`.
- Cache/checagens: `sw.js`, `manifest.json`, `scripts/lint.mjs`, `scripts/check-frontend.mjs`.
- Testes novos: `tests/assistant.test.mjs`, `tests/assistant.spec.mjs`, `tests/backend-session.test.mjs`, `tests/event-stream.test.mjs`.
- Cobertura existente adaptada aos novos destinos: `tests/visual-smoke.spec.mjs`; comportamento de lançamento, métricas e análises continua coberto.

## Validação e próxima etapa

Executar `npm test`, `npm run lint` e `npm run build`. No ambiente local com Chromium do sistema: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm test`. O navegador testa o build publicado em `dist`, incluindo assets relativos e PWA offline. Vite gera o precache com os nomes efetivos dos bundles; os workflows publicam apenas o build e mantêm o backend isolado nas prévias.

O Assistente foi migrado para React 19 e TypeScript estrito, separado em componente, hook, contratos e validação de fronteira. `js/modules/assistant.js` e sua marcação anterior foram removidos. `src/app/legacy-bridge.ts` é a fronteira temporária com sessão, navegação e revisão existentes. Os motores financeiros mantêm uma única implementação. A migração de Início, Casa, Cofre e Ajustes continua pendente; esta etapa não declara o frontend inteiro convertido.

Migração `db/migrations/20261011_assistant_conversations.sql` aplicada somente na branch de dados `br-broad-unit-acfw9voz`, projeto `frosty-star-45149603`. `tests/conversations-rls.sql` verifica leitura/edição/exclusão do dono, bloqueio de outro morador e de não membro, revertendo as fixtures. A prévia expira em 18/10/2026. Nenhuma alteração de banco ou backend foi aplicada à produção.

Os novos testes cobrem retomada após reload, isolamento de período/usuário/carteira, exclusão com foco contido, respostas atrasadas após troca de sessão, conflitos entre abas, limites de retenção, falhas de armazenamento, histórico autoritativo, compatibilidade com clientes antigos, manifest relativo e React offline. Validação em teclado móvel físico e chamadas reais aos provedores continuam dependendo do dispositivo e da credencial do usuário.

Resultado local: 149 testes unitários e 45 testes de navegador passaram (194 no total); TypeScript, formatação, lint e build passaram. Backend da prévia isolada atualizado para deployment 7, com as variáveis existentes herdadas. Auditoria das dependências: nenhuma vulnerabilidade conhecida após atualização compatível de Vite/PostCSS/Playwright.
