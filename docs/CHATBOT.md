# Interface clara e Assistente em conversa

## Entrega de 2026-10-11

A primeira implementação da direção clara e elegante substitui o tema anterior nos tokens, navegação, cartões, campos e ações compartilhadas. Início tem dois resumos: gastos da casa e orçamento restante da carteira pessoal, ambos com período identificado. O cartão pessoal consulta o servidor, usa a carteira selecionada no Cofre quando disponível e informa indisponibilidade sem inventar saldo. Cofre usa uma superfície suave para orçamento, mantendo movimentos, gráficos exploráveis e simulações existentes.

O Assistente agora permanece na conversa após enviar uma pergunta. Tem mensagens do usuário e do assistente, contexto Casa/carteira + mês, histórico por contexto, sugestões iniciais, resposta progressiva, parar, tentar novamente e conexão de IA. As análises compartilhadas foram para Casa; métricas de interpretação foram para Ajustes. Os handlers antigos que enviavam qualquer pergunta diretamente para lançamento foram removidos. Os estilos antigos de composição do Assistente e os destinos duplicados do Início foram removidos do CSS canônico; `css/chat.css` contém o novo componente de conversa.

## Conversa e privacidade

O histórico é temporário: existe apenas na memória da página, limitado a vinte contextos e cem mensagens por contexto. Somente os últimos dez pares completos entram na próxima chamada, com limite adicional de 30.000 caracteres. Trocar carteira/período cancela a geração e abre outro contexto; retornar permite retomar a conversa daquele contexto. Nova conversa limpa o contexto atual. Recarregar/encerrar a página perde o histórico; isso aparece na interface. Não existe persistência no banco nem sincronização entre dispositivos nesta entrega.

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
- Conversa/cliente: `js/modules/assistant.js`, `js/api.js`, `js/core/event-stream.js`, `js/core/http-client.js`, `js/app.js`.
- Backend: `backend/routes/assistant.mjs`, `backend/services/assistant.mjs`, `backend/services/assistant-provider.mjs`, `backend/services/ai-settings.mjs`, `backend/index.mjs`.
- Integração pessoal: `js/modules/wallets.js`, `js/modules/ai-settings.js`.
- Cache/checagens: `sw.js`, `manifest.json`, `scripts/lint.mjs`, `scripts/check-frontend.mjs`.
- Testes novos: `tests/assistant.test.mjs`, `tests/assistant.spec.mjs`, `tests/backend-session.test.mjs`, `tests/event-stream.test.mjs`.
- Cobertura existente adaptada aos novos destinos: `tests/visual-smoke.spec.mjs`; comportamento de lançamento, métricas e análises continua coberto.

## Validação e próxima etapa

Executar `npm test` e `npm run lint`. No ambiente local com Chromium do sistema: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm test`. Revisão visual em 320/390/430/768/1366/1920px, cobrindo navegação, chat, Cofre, scanner, modais e gráficos. Assets `20261011-010`, cache `gastos-ape-v56`.

A entrega preserva o frontend modular existente, sem introduzir uma segunda aplicação concorrente. React/TypeScript/Vite, histórico permanente autorizado no banco e validação em dispositivo físico do teclado móvel continuam previstos no plano de migração, após avaliar esta composição na prévia. A implementação atual não constitui a conclusão de toda a migração técnica proposta.

Resultado da validação: **142 unitários e 37 testes de navegador passaram**, incluindo os casos antigos e os novos. Lint passou para sintaxe, duas folhas de estilo e contratos de DOM/API. A revisão adicional do chat cobriu 320/390/1366px. Backend da prévia: `br-lucky-firefly-a50tfkjv`, deployment 5, variáveis existentes herdadas sem rotação de chave.
