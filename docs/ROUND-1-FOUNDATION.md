# Rodada 1 — Foundation / Modularização

Branch: `refactor/round-1-foundation`

## Objetivo

Organizar a base atual sem redesenhar a experiência e sem alterar o contrato do backend. Esta rodada prepara o projeto para as próximas fases: nova navegação, Smart Entry multimodal, scanner e motor de comportamento.

## Baseline preservada

- GitHub Pages + PWA.
- Backend Neon atual e contratos existentes.
- Login e sessão existentes.
- Smart Entry com confirmação humana.
- Voz PT-BR.
- Orçamentos e recorrentes.
- Gestão de usuários.
- Radar financeiro.
- Histórico e filtros.
- Regra mobile de inputs com 16px para evitar zoom automático no iPhone.

## Mudanças

### js/core/utils.js
Centraliza funções puras reutilizáveis:
- moeda;
- escape HTML;
- mês anterior;
- normalização de texto;
- totalização;
- totais por categoria.

### js/modules/dashboard.js
Isola:
- cards de totais;
- acerto entre participantes;
- comparação mensal;
- insights atuais;
- gráfico de participação;
- resumo copiável.

### js/app.js
Passa a atuar prioritariamente como orquestrador:
- inicialização;
- carregamento de dados;
- composição dos módulos;
- estados de erro.

## Regras arquiteturais

1. app.js não deve voltar a acumular regras internas de módulos.
2. Funções puras compartilhadas entram em js/core.
3. Funcionalidades de produto entram em js/modules.
4. Backend permanece separado em routes/services.
5. Enquanto o projeto usar scripts clássicos, cada módulo expõe uma API pequena por window.Gastos<Modulo>.
6. Evitar dependências circulares.
7. Alterações visuais grandes ficam fora desta rodada.
8. Mudanças em assets exigem nova versão de cache da PWA.
9. IA não deve assumir cálculos financeiros determinísticos que podem ser resolvidos localmente.
10. Novos recursos devem preservar confirmação humana quando houver baixa confiança.

## Critérios de regressão

Antes de merge:
- login e logout;
- carregamento do mês;
- troca de mês;
- cards e acerto;
- gráfico;
- Smart Entry;
- voz;
- formulário manual;
- edição/exclusão;
- filtros;
- orçamento;
- recorrentes;
- configurações;
- PWA/cache;
- mobile sem zoom de input;
- modais centralizados.

## Próxima rodada

Transformar a navegação em quatro superfícies de produto:
- Resumo;
- Lançar;
- Movimentações;
- Mais.

Sem reescrever regras já estáveis.
