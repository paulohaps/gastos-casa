# Entrega integrada V3 — 11/10/2026

## Resultado

Início, Cofre e Assistente receberam a linguagem clara e elegante planejada, com profundidade CSS discreta, navegação React compartilhada e ícones locais. Ajustes distingue falha de consulta de ausência de chave. Casa usa navegação segmentada e exploração expansível dos gráficos. Não há dependência nova de animação ou 3D.

No Cofre, limite, reserva e disponibilidade aparecem juntos; no desktop os movimentos ocupam a coluna ao lado. No chat vazio, o título permanece acessível desde o topo. Os controles de ação da tabela têm alvo de 48 px.

## Assistente multimensal

- Atalhos de 1, 3, 6 e 12 meses e intervalo personalizado de até 12 meses.
- Busca paginada de todos os registros do período e do intervalo anterior de mesma duração; consultas incompletas falham explicitamente.
- Totais financeiros calculados em centavos no servidor, meses sem registros explícitos e cartão mensal com abertura dos lançamentos daquele mês.
- Histórico separado por usuário, casa/carteira e período; os cartões persistem com a resposta, mas só texto e papel são enviados ao modelo.
- Respostas antigas não substituem contexto novo. Carteiras de outro usuário são rejeitadas antes da consulta.
- Limites e reservas históricos não são inventados: análise multimensal do Cofre não simula um orçamento passado inexistente.

## Validação

A suíte completa passou com **166 testes unitários e 85 testes de navegador (251 no total)**. Lint, TypeScript e build passaram. Os 22 novos casos cobrem calendário e intervalo, fronteira de resumos, consultas parciais, persistência, privacidade, requisições atrasadas, falha da IA, ícones locais, alvos de toque e nove tamanhos de viewport de 320 px a 1920 px, incluindo paisagem.

O teste real de RLS para conversas multimensais passou na base de staging, com fixtures revertidas. O backend de preview recebeu o deployment 11 e respondeu à verificação de saúde. Testes do chat usam provider simulado; não houve chamadas reais pagas a Gemini/DeepSeek nesta rodada.

Bundle final aproximado: JS 283 kB (85 kB gzip), CSS 109 kB (19 kB gzip). Não foram coletados indicadores de campo como INP nem uma certificação completa de WCAG.

## Publicação e evidências

PR de trabalho: https://github.com/paulohaps/gastos-casa/pull/16

Prévia estável: https://paulohaps.github.io/gastos-casa/pr-preview/pr-16/

Capturas locais com dados demonstrativos: `/workspace/artifacts/v3-preview/`. A galeria `index.html` apresenta os mockups reais do build, com versões móveis e desktop. Os dados demonstrativos não são registros financeiros reais.

Migration: `db/migrations/20261011_assistant_periods.sql`, aplicada somente à branch DB `br-broad-unit-acfw9voz`. Função isolada: `br-lucky-firefly-a50tfkjv` em `soft-lab-98397625`. Produção não foi alterada.

## Estado da refatoração

Uma única raiz React e shell compartilhado estão implementados. A ponte legada continua para Casa, scanner, lançamentos, sessão e parte da orquestração. Esta entrega é o primeiro marco integrado do plano V3, e não o encerramento de todas as sete etapas arquiteturais. A próxima etapa é substituir essas fronteiras mantendo os contratos e testes atuais; não adicionar outra camada de CSS sobre os componentes V3.

## Correção do Safari móvel após avaliação do usuário

Assets `20261011-015`, cache fonte `v61`. A geometria do chat móvel acompanha a altura e o deslocamento de `visualViewport`, mantendo cabeçalho e compositor dentro da área visível. O aviso global de mês não empurra o Assistente. A navegação permanece disponível em telas curtas sem teclado e retorna depois de fechá-lo. O envio fica à direita, o compositor é compacto em pouca altura e a conclusão da resposta não força foco no dispositivo de toque.

`tests/chat-viewport.spec.mjs` acrescenta três regressões: barras/deslocamento do navegador, teclado com restauração da navegação e ausência de foco automático depois da resposta. Esses testes usam geometria e entrada simuladas; a confirmação em Safari de um iPhone físico permanece pendente.
