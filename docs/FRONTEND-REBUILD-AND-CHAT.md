# Reconstrução visual e Assistente em chat

Status: primeira entrega implementada para avaliação na prévia. O usuário escolheu **claro e elegante: superfícies limpas, cores discretas e navegação simples**. Início, Cofre, navegação e componentes compartilhados receberam a nova direção; o Assistente agora é um chat integrado ao backend. A segunda etapa instala React/TypeScript/Vite e substitui o Assistente por um componente tipado com histórico privado persistente. A terceira etapa substitui a renderização de Início e Cofre por React tipado, remove seus módulos anteriores e acrescenta meta privada com reserva mensal. A quarta etapa migra Ajustes: conexão de IA, usuários, regras aprendidas e qualidade. Casa e formulários compartilhados ainda precisam ser migrados; a ponte de compatibilidade continua explícita.

Escopo implementado, protocolo e validação: `docs/CHATBOT.md`.

## Objetivo

Reconstruir o frontend com uma linguagem visual consistente e transformar o Assistente em uma conversa financeira real. A experiência precisa continuar fácil para alguém com pouca familiaridade com tecnologia: textos legíveis, ações com nomes claros, poucos controles por tela e contexto financeiro sempre visível.

## Diagnóstico inicial que orientou a mudança

- A composição atual acumula resumos, chamadas para outras áreas e indicadores na mesma tela. O CSS ainda depende da ordem de regras de rodadas anteriores, mesmo após a consolidação técnica.
- O envio em `js/modules/experience.js` abre o lançamento e chama `interpretExternal`. Não existe uma conversa com mensagens e continuidade.
- `backend/services/ai-settings.mjs` já guarda as chaves pessoais no servidor, criptografadas, e chama Gemini/DeepSeek. O método atual recebe um único conteúdo, limita a resposta e não implementa histórico ou streaming.
- As correções recentes de cancelamento mensal, estados explícitos, autenticação, scanner e contratos de API são uma base a preservar. A suíte vigente tem 117 testes unitários e 28 de navegador.

## Nova organização das telas

| Área | Finalidade | Conteúdo principal |
|---|---|---|
| Início | Entender o mês e escolher a próxima ação | Resumo curto, últimos movimentos e uma recomendação útil |
| Casa | Organizar despesas compartilhadas | Movimentos, divisão, acertos e planejamento |
| Cofre | Controlar dinheiro reservado para gastos pessoais | Carteira, limite restante, movimentos e planejamento pessoal |
| Assistente | Conversar e agir com ajuda da IA | Conversa, contexto selecionado e cartões de ação |
| Ajustes | Configurar o aplicativo | Conta, moradores, aparência e conexão de IA |

“Novo gasto” é uma ação disponível no contexto atual, sem virar outra aba principal. Na Casa inicia um gasto compartilhado; no Cofre inicia um gasto da carteira selecionada. O chat também pode preparar esses lançamentos.

No celular, barra inferior com cinco destinos e nomes visíveis. No desktop, navegação lateral discreta com os mesmos destinos. Cabeçalhos, seletor de período e ações seguem um único padrão. Gráficos aprofundam a análise dentro da respectiva área; métricas técnicas de IA saem da tela principal do Assistente.

## Direção visual

A aparência será definida por um protótipo navegável de Início, Cofre e Assistente antes de expandir a implementação para as demais telas. O protótipo precisa mostrar conteúdo realista, estados vazios e uso em 390px e desktop, incluindo o teclado no chat.

A direção escolhida usa fundo quase branco (`#F7F8FA`), superfícies brancas, texto em grafite (`#17212B`), texto secundário (`#536170`), bordas discretas (`#E1E6EC`) e verde-petróleo para ações (`#146C66`). Esses tokens são uma proposta inicial para validar no protótipo, incluindo contraste dos estados interativos.

Início apresenta dois resumos claros: gastos compartilhados do mês e disponibilidade da carteira pessoal escolhida. Os últimos movimentos vêm logo abaixo. O Cofre concentra carteira, período e orçamento em uma superfície organizada, com a lista de movimentos na sequência. No Assistente, a conversa ocupa a área principal; indicadores e gráficos aparecem dentro de respostas ou detalhes quando ajudam a pergunta feita.

Critérios de composição:

- Tipografia com hierarquia curta, sem títulos e controles superdimensionados. Texto de leitura confortável e entradas com pelo menos 16px no celular.
- Espaçamento consistente, superfícies com propósito e uma cor principal para ações. Bordas, sombras e raios pertencem ao mesmo sistema de tokens.
- Saldo bancário, gastos e limite disponível têm rótulos distintos. O Cofre apresenta limite restante como orçamento, sem simular uma conta bancária.
- Ícones locais acompanhados de rótulos; áreas de toque de pelo menos 48px. Contraste AA, foco visível e suporte a movimento reduzido.
- Modais, menus, campos, botões, avisos e gráficos reutilizam componentes. Descrições extensas ficam em ajuda contextual ou detalhes.
- O CSS novo começa em uma estrutura própria. A migração substitui as telas antigas por etapas, com remoção dos arquivos aposentados.

## Assistente como chatbot

### Conversa

Uma tela dedicada com mensagens do usuário e do Assistente, campo de texto fixo no rodapé, sugestões iniciais, indicador de resposta e controles para parar e tentar novamente. No celular, o campo acompanha o teclado e a rolagem preserva a leitura. Novas mensagens não forçam rolagem quando a pessoa estiver consultando mensagens anteriores.

Contexto visível: **Casa + período** ou **Meu cofre + carteira + período**. Mudanças de contexto iniciam uma conversa separada. O histórico pertence ao usuário autenticado; conversas pessoais não aparecem para outros moradores. Salvar, retomar e excluir conversas precisam de regras de retenção e autorização próprias.

Exemplos de uso:

- “Onde mais gastei neste mês?” → resumo com números calculados pelo sistema e acesso aos lançamentos correspondentes.
- “Por que gastei mais que no mês passado?” → comparação, indicando quando falta histórico suficiente.
- “Posso gastar R$ 150 hoje?” → simulação usando o limite da carteira escolhida, deixando explícitas as hipóteses.
- “Paguei R$ 42 na farmácia no PIX.” → cartão com valor, data, categoria e destino para revisar e confirmar.
- “Como posso economizar?” → sugestões vinculadas aos dados disponíveis, com detalhes acessíveis.

A IA explica e propõe ações. Cálculos financeiros continuam nos motores determinísticos. Lançamentos, alterações e exclusões exigem uma confirmação explícita do usuário.

### Integração real

- Criar rotas de conversas e mensagens no backend existente, autenticadas e com verificação de propriedade.
- Adaptar os clientes Gemini e DeepSeek para mensagens com histórico e respostas em streaming. Um protocolo comum deve informar início, texto, ação proposta, término e erro.
- Reutilizar as configurações e chaves pessoais existentes. Chaves permanecem no servidor; o navegador conversa apenas com o backend da aplicação.
- Montar contexto no servidor, consultando somente os dados autorizados para o usuário, período e carteira. A IA não executa SQL recebido da conversa.
- Validar ferramentas e resultados: totais, comparações, consulta de movimentos, simulação e preparação de lançamento. O envio de comprovantes reutiliza o scanner e a revisão já existentes.
- Limitar tamanho do histórico, uso de tokens e frequência de chamadas; cancelar a geração quando solicitado e impedir envios duplicados.
- Validar os modelos predefinidos com os provedores durante a implementação. Distinguir chave recusada, modelo indisponível, limite de uso e falha de conexão.
- Sem conexão de IA, mostrar configuração guiada. Consultas locais estruturadas podem continuar disponíveis, com sua origem explícita.

## Arquitetura proposta

Fundação instalada nesta etapa: React + TypeScript + Vite, com organização por funcionalidade e CSS baseado em tokens. O motivo é substituir a manipulação dispersa de DOM e os globais por componentes e contratos verificáveis. Essa escolha não determina a aparência; o protótipo é que valida o desenho.

```text
src/
  app/              # Inicialização, sessão, navegação e composição
  features/
    overview/
    household/
    wallets/
    assistant/
    settings/
  shared/
    ui/             # Componentes, campos, diálogos e estados de tela
    api/            # Cliente HTTP, contratos e adaptadores
    finance/        # Motores puros e regras financeiras existentes
    styles/         # Tokens, base e estilos compartilhados
```

Estado remoto fica nos serviços e hooks de consulta, identificado por usuário, período e carteira. Estado de interface fica no componente ou reducer responsável. O chat tem estados explícitos de conversa e geração; as demais consultas mantêm loading, empty, success e error.

Primeiro utilizar recursos nativos de fetch, AbortController, dialog e CSS. Bibliotecas adicionais precisam resolver uma necessidade concreta. As regras financeiras não devem ganhar uma segunda implementação durante a migração.

O build precisa continuar funcionando no GitHub Pages e nas pastas de prévia, com assets relativos. Os workflows passarão a publicar o build, preservando o backend isolado das prévias. PWA, atualização e operação offline receberão testes próprios.

## Etapas e entregáveis

1. **Protótipo visual:** definir tokens, navegação e três telas representativas, incluindo o chat. Conferir celular e desktop, legibilidade e clareza das ações.
2. **Fundação nova:** criar estrutura tipada, componentes compartilhados, cliente de API e sessão. Importar os motores financeiros e seus testes, sem alterar resultados.
3. **Chat funcional:** implementar conversa, contexto, histórico, streaming, recuperação de erros e ações com confirmação. Testar Gemini/DeepSeek com respostas simuladas e conexão real quando houver credencial de teste autorizada.
4. **Migração das áreas:** Início e Cofre; Casa com acertos e planejamento; Ajustes e scanner. Cada área concluída substitui sua implementação anterior. Links existentes precisam continuar chegando ao destino correto.
5. **Consolidação e entrega:** remover frontend aposentado, verificar build e PWA, publicar prévia e conferir os fluxos principais. O processo de produção continua seguindo `PROJECT-STATE.md`.

## Critérios de conclusão

- Direção visual consistente nas cinco áreas, inclusive loading, vazio, erro e modais.
- Chat mantém uma conversa, consulta dados reais autorizados, responde em português e oferece ações revisáveis.
- Isolamento entre Casa, carteiras pessoais, usuários e históricos de conversa comprovado por testes.
- Falhas de IA não apagam mensagens nem sessão; requisições antigas não substituem o contexto vigente.
- Sem overflow em 320–1920px; navegação por teclado, contraste e chat com teclado móvel verificados.
- Suíte existente preservada em comportamento e ampliada para o chat; TypeScript, lint, build e CI passando.
- Uma única implementação por tela e regra de negócio, com remoção dos globais, handlers inline e CSS aposentados ao concluir a migração.

## Quarta etapa — Ajustes em React

`src/features/settings` substitui o HTML e os módulos de IA/usuários. As regras e métricas foram retiradas de `smart-entry.js`, que mantém apenas os eventos de compatibilidade e a lógica do lançamento. Chaves ficam apenas no campo durante edição e no servidor após salvar; sair da tela ou limpar a sessão remove o rascunho. Usuários, aprendizado e qualidade têm estados explícitos, retry e proteção contra respostas de sessões anteriores.

Os cartões apresentam IA primeiro, usuários e regras em seguida. A qualidade do lançamento rápido fica recolhida ao fim da tela; o texto de roadmap técnico foi substituído por orientação de privacidade. Métricas usam AbortController e geração ao mudar o período e limpam os números antigos em loading/erro. Presets Gemini/DeepSeek, modelo personalizado, teste, salvamento sem reenviar a chave e exclusão com confirmação permanecem.

Casa, scanner, navegação/sessão e diálogos de despesas ainda têm fronteiras de compatibilidade. Esta entrega conclui Ajustes, sem declarar a reconstrução completa do frontend.
