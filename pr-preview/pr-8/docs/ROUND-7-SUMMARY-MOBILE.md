# Rodada 7 — Reestruturação do Resumo Mobile

Branch: `design/round-7-summary-mobile`

Base: `main`

## Objetivo

Reorganizar a tela Resumo para que a hierarquia visual faça sentido, especialmente no mobile.

A rodada trata os problemas observados na versão em produção:
- seletor de mês cortado;
- cabeçalhos sem padrão claro;
- Total do mês, participantes e acerto misturados na mesma malha;
- Paulo e Fernando sem uma estrutura visual própria;
- composição visual pouco previsível entre cards.

## Nova lógica da Visão geral

A leitura passa a seguir esta ordem:

1. Total do mês
2. Participantes
   - Paulo Henrique
   - Fernando Gustavo
3. Acerto de contas

A estrutura visual acompanha a estrutura conceitual.

## Participantes

Paulo e Fernando usam exatamente o mesmo padrão:
- identificação;
- valor;
- detalhamento Dinheiro / Vale.

No mobile:
- ficam um acima do outro;
- mesma largura;
- mesma hierarquia;
- mesmo espaçamento.

Em telas maiores:
- continuam dentro de uma única seção de participantes, sem misturar acerto financeiro na mesma malha.

## Topo mobile

O seletor de mês passa a ser o controle global prioritário.

Regras:
- texto do mês não pode ser cortado;
- marca ocupa largura fixa;
- ações secundárias usam botões compactos;
- seletor recebe largura flexível;
- controles precisam permanecer dentro da viewport.

## Títulos

Padrão oficial de seção:
- kicker pequeno;
- título principal;
- conteúdo;
- ação discreta quando necessária.

Não criar um estilo diferente para cada card.

## Ícones

Mantida a regra do Visual System V1:
- sem tiles decorativos;
- ícone sem função não recebe caixa;
- elementos puramente decorativos podem ser removidos.

## Performance

A dependência de Poppins foi removida porque o sistema visual já utiliza tipografia nativa.

## PWA

- assets: `20260919-032`
- cache: `gastos-ape-v39`

## Testes

O smoke visual passa a validar:
- estrutura Total / Participantes / Acerto;
- exatamente dois participantes;
- os dois participantes com a mesma largura no mobile;
- ordem vertical dos participantes;
- seletor de mês dentro da viewport;
- seletor de mês com largura mínima suficiente;
- valor do mês carregado corretamente.

## Regra permanente

Blocos de natureza diferente não devem ser colocados na mesma grade apenas para preencher espaço.

No Resumo:
- Total = agregado;
- Participantes = distribuição;
- Acerto = relação financeira.

Cada um deve ter uma estrutura coerente com sua função.
