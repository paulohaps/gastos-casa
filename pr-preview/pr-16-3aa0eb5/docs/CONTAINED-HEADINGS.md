# Aberturas de tela com painéis

Rodada de 2026-10-11, após imagens do Início e do lançamento no iPhone.

## Problemas observados

O título “Visão geral” ficava solto sobre o fundo. A descrição estática recebia o skeleton de `.supporting-text` durante o carregamento mensal, formando uma faixa cinza sem contexto. A rolagem para o formulário escondia o início do cartão atrás da barra fixa. Ações do lançamento disputavam três colunas estreitas e cortavam “Escanear”.

## Padrão aplicado

`.view-panel` reúne categoria, título e descrição com superfície clara, gradiente violeta discreto, borda e raio consistente. Início inclui o período da Casa. Casa, Cofre, Assistente, Ajustes e Novo gasto usam esse mesmo componente em `css/app.css`, substituindo regras antigas desses cabeçalhos. A descrição estática não recebe mais o skeleton reservado aos dados dinâmicos.

No celular, Falar e Escanear ocupam duas colunas; Interpretar ocupa a linha seguinte, com destaque primário. Ícones SVG locais continuam disponíveis sem CDN, inclusive ao iniciar/parar o ditado. Controles têm pelo menos 48px de altura. A abertura de Novo gasto mostra o título da área; edição e revisão rolam para o topo do cartão, respeitando a barra fixa. O seletor de período das métricas do Assistente passa para uma linha própria em telas estreitas.

## Validação

91 testes unitários e 18 testes de navegador. Os testes compactos verificam as seis áreas em 320/640px, descrição durante loading, rótulos completos e rolagem do cartão abaixo da barra. Revisão adicional de capturas e dimensões em 320, 390 e 1366px, sem overflow horizontal nessas áreas. Nove modais continuam cobertos em 320, 390 e 1366px.

Assets `20261011-007`; cache PWA `gastos-ape-v53`. Backend, autenticação e cálculos financeiros mantêm seus contratos. Esta rodada não acrescenta chat livre ao Assistente. A prévia continua isolada e a produção aguarda avaliação visual do usuário. Capturas automatizadas usam Chromium com viewport de celular; não substituem conferência em um iPhone físico.
