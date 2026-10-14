# Workspace financeiro — reconstrução da experiência

## Direção e escopo

Pedido de 13/10/2026: mudar completamente a apresentação para uma experiência SaaS moderna e organizada. A nova direção usa navegação persistente em azul profundo, superfícies claras, tipografia do sistema, raios contidos, controles consistentes e profundidade decorativa com CSS. O foco continua nos registros reais da casa e nos planos pessoais.

Esta entrega reconstrói a interface e a arquitetura de estilos. Preserva os motores financeiros, contratos HTTP, autenticação, streaming e separação de dados. Casa, scanner e parte dos formulários ainda usam a ponte legada existente; não representa migração integral desses motores para React nem transformação do produto em um serviço com cobrança/organizações.

## Arquitetura de informação

- **Início:** cabeçalho editorial, faixa de métricas da casa/Cofre/radar, atalhos de lançamento/planejamento/acertos, atividade recente e distribuição por categoria com drill-down dos registros reais.
- **Casa:** resumo com total e participantes; despesas com filtros; acertos com valores a pagar e histórico no mesmo lugar; planejamento com recorrentes e limites.
- **Cofre:** cabeçalho e período separados do painel; limite restante com contraste, reserva e disponível após reserva; gastos e meta em áreas próprias; análises progressivas.
- **Assistente:** contexto em lateral no desktop e barra compacta no celular; boas-vindas com sugestões; respostas com largura de leitura; compositor compacto e persistente; saída explícita mantida.
- **Ajustes:** conexão de IA e administração organizadas em colunas no desktop e sequência no celular.
- **Busca de ações:** diálogo nativo com filtro sem distinção de acentos, Enter para navegar e Escape para voltar; atalho Ctrl/Cmd+K. Não executa pagamentos ou gravações. Respeita outros diálogos e a autenticação.

## CSS e componentes

`css/shell.css` é o único proprietário da geometria de navegação, cabeçalhos e superfícies compartilhadas. As definições anteriores correspondentes foram retiradas de `app.css`, inclusive media queries sobrepostas. `experience.css` contém as composições financeiras; `chat.css`, a área de conversa. `CommandMenu.tsx` isola descoberta/navegação. `DepthMark` foi aposentado e substituído pelas composições decorativas atuais. Nenhuma biblioteca externa adicionada.

O cabeçalho do Cofre saiu do painel de saldo. Os acertos deixaram de disputar espaço no resumo da Casa. Os testes existentes de navegação foram atualizados para abrir Acertos antes de registrar pagamentos e para verificar a nova composição de três métricas.

## Validação

Dados de teste são fictícios. Os testes novos cobrem busca, foco/teclado, resultados vazios, autenticação, navegação sem mutações financeiras, drill-down e áreas em telas de 320 a 1920 px. A suíte existente mantém os cenários de corrida de mês, 503, chave de IA, isolamento de conversa, streaming, scanner, PWA e limites de modais.

Capturas de todas as áreas em 320/390/768/1440 px ficam em `/workspace/artifacts/saas-workspace/`. Teclado/viewport de iPhone são simulados; não houve execução em aparelho físico ou chamada paga a provedores.

Validação final local: `npm test` aprovado com 166 testes unitários e 108 testes de navegador (274 no total, oito novos). `npm run lint` aprovado: TypeScript, Prettier e contratos/sintaxe. Build de produção e verificação de PWA/offline integram a suíte aprovada.

## Publicação

Assets `20261013-001`; cache fonte `v68`. Prévia na branch do PR16. Não há migração, alteração de segredo, deploy de backend ou promoção à produção nesta rodada. Os bloqueios de infraestrutura registrados em `PRODUCTION-READINESS-20261012.md` continuam aplicáveis.
