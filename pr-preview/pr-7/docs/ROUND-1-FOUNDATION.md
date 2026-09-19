# Rodada 1 — Foundation / Modularização

Branch: `refactor/round-1-foundation-v2`

## Objetivo
Organizar a base sem redesenhar a experiência e sem alterar contratos do backend.

## Baseline preservada
- GitHub Pages + PWA.
- Backend Neon e contratos existentes.
- Login/sessão.
- Smart Entry com confirmação humana.
- Voz PT-BR.
- Orçamentos, recorrentes e usuários.
- Radar financeiro.
- Histórico e filtros.
- Correção mobile de inputs com 16px para evitar zoom automático no iPhone.

## Estado encontrado
A base mais recente já havia avançado na modularização, incluindo módulos independentes para despesas e dashboard. A Rodada 1 foi ajustada para complementar essa arquitetura em vez de duplicá-la.

## Mudança aplicada
### js/core/utils.js
Centraliza funções puras e compartilhadas:
- moeda;
- escape HTML;
- extração de mês;
- mês anterior;
- normalização de texto;
- totalização;
- totais por categoria.

### js/app.js
Continua como orquestrador e deixa de manter cópias locais desses utilitários.

### PWA
O novo módulo entra no precache e a versão de assets sobe para `20260919-024` / cache `v31`.

## Regras arquiteturais
1. app.js deve coordenar módulos, não concentrar regra de domínio.
2. Funções puras compartilhadas entram em js/core.
3. Funcionalidades de produto entram em js/modules.
4. Backend permanece separado em routes/services.
5. Evitar dependências circulares.
6. Não reescrever módulo estável sem necessidade.
7. Mudanças em assets exigem atualização explícita do cache PWA.
8. Cálculo financeiro determinístico deve permanecer fora da IA.
9. Baixa confiança em interpretação exige confirmação humana.

## Checklist antes de merge
- login/logout;
- carregamento e troca de mês;
- cards e acerto;
- comparativo e insights;
- gráfico;
- Smart Entry e voz;
- formulário manual;
- edição/exclusão;
- filtros;
- orçamento;
- recorrentes;
- configurações;
- PWA/cache;
- mobile sem zoom inesperado;
- modais centralizados.

## Próxima rodada
Reorganizar a navegação em quatro superfícies:
- Resumo;
- Lançar;
- Movimentações;
- Mais.

A próxima rodada deve reutilizar os módulos atuais e reduzir a dependência de uma única página longa.
