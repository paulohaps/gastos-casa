# Interface legível e cofre direto — 2026-10-11

Esta rodada atende à revisão de uso por pessoas com pouca familiaridade com tecnologia. Mantém Manrope, violeta e a organização em cinco áreas, com textos maiores, contraste e ações nomeadas.

## Fluxo do cofre

As ações principais são **Registrar gasto**, **Ver gastos** e **Ajustar limite**. Registrar e ajustar abrem diálogos com Fechar visível, foco e Escape nativos. Ver gastos leva ao histórico e posiciona o foco. Gastos e quanto resta do orçamento são o resumo principal. A referência diária e as recomendações ficam em **Dicas para economizar**, recolhidas abaixo do histórico. Não há exigência de configurar IA para usar o cofre.

Uma carteira não precisa de um cartão de seleção repetido; a seleção aparece quando existem várias. Criar outra carteira permanece acessível. O limite é um orçamento mensal, não dinheiro disponível no banco. Falhas de salvamento são exibidas dentro do diálogo aberto.

## CSS canônico

`css/app.css` substitui os três arquivos carregados anteriormente. A consolidação retirou 621 declarações supersedidas do mesmo seletor/propriedade/contexto condicional, centralizou os tokens, uniu grupos adjacentes equivalentes e removeu seletores de views obsoletas. A ordem das demais regras foi preservada para não alterar a cascata entre componentes e media queries. O arquivo foi formatado para edição; não é uma concatenação das três camadas.

Novas alterações devem editar os componentes existentes. Não carregar um novo arquivo de overrides. Regras condicionais com escopos diferentes permanecem onde a responsividade exige. A revisão não representa uma eliminação de toda possível dívida técnica.

Texto base e campos: 16px; texto de apoio: pelo menos 14px; rótulos da navegação móvel: 12px. As ações principais têm alvo de 48px. O cabeçalho móvel usa duas linhas para mostrar Novo gasto, mês e Sair. As cores secundárias ficam mais escuras; o teste verifica contraste mínimo 4,5:1 no destino inativo da navegação móvel.

Assets `20261011-004`, cache PWA `gastos-ape-v50`; o precache aponta para o CSS único. Prévia mantém service worker desabilitado e backend isolado.

## Validação

Contrato frontend, sintaxe e 88 testes unitários. Smoke visual cobre 320, 360, 390, 430, 640, 768, 1366 e 1920px, com navegação, scanner, lançamento compartilhado e CRUD pessoal. A mudança do limite, foco no histórico, recomendações recolhidas, rótulos visíveis e contraste entram na regressão. Isso não substitui uma sessão de uso com pessoas idosas nem garante ausência absoluta de bugs.

Produção depende da validação visual do usuário no preview, conforme PROJECT-STATE.md.
