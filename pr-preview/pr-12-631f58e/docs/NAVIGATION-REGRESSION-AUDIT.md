# Auditoria de regressões após divisão por páginas

Data: 2026-09-19

## Objetivo

Mapear ações que foram criadas quando o sistema era uma página única e que, após a divisão em Resumo / Lançar / Movimentações / Mais, passaram a apontar para componentes que podem estar ocultos em outra view.

## Regra estrutural

Nenhuma ação pode:
1. preencher um componente invisível;
2. abrir um formulário sem garantir a view correta;
3. usar apenas `window.scrollTo` para alcançar conteúdo que pode estar em outra página;
4. depender da posição antiga dos componentes.

A navegação deve ocorrer antes de revelar, rolar ou focar o destino.

## Mapeamento

| Origem | Ação | Destino real | Situação encontrada | Correção |
|---|---|---|---|---|
| Movimentações | Editar gasto | Lançar / formulário manual | BUG: preenchia formulário oculto | Corrigido |
| Movimentações | Duplicar gasto | Lançar / formulário manual | BUG: preenchia formulário oculto | Corrigido |
| Mais / Recorrentes | Lançar agora | Lançar / formulário manual | BUG: preenchia formulário oculto | Corrigido |
| Movimentações | Excluir gasto | Modal global | Seguro | Mantido |
| Mais / Recorrentes | Editar recorrente | Mais / formulário recorrente | Mesma view | Mantido |
| Mais / Recorrentes | Excluir recorrente | Modal global | Seguro | Mantido |
| Resumo | Definir metas | Mais / orçamento | Já navega para Mais antes de abrir | Mantido |
| Mais / Orçamento | Fechar / salvar | Mais | Mesma view | Mantido |
| Mais / Usuários | Novo usuário | Mais | Mesma view | Mantido |
| Mais / Regras | Nova regra / editar regra | Mais | Mesma view | Mantido |
| Lançar / Smart Entry | Editar campos | Lançar / formulário manual | Mesma view | Mantido |
| Lançar / Scanner | Resultado OCR/QR | Lançar / Smart Entry | Mesma view | Mantido |
| Header | Compartilhar resumo | Ação global | Não depende de view | Mantido |
| Header | Trocar mês | Ação global | Não depende de view | Mantido |

## Correção arquitetural

Foi criado em `GastosNavigation`:

`showAndReveal(view, targetSelector, options)`

Responsabilidades:
- mudar para a view correta;
- atualizar hash e estado ativo;
- aguardar o DOM refletir a nova view;
- rolar até o componente;
- focar campo apenas em desktop para evitar teclado/zoom indesejado no mobile.

## Fluxos protegidos por teste visual

O smoke agora valida explicitamente:

1. Mais → Recorrentes → Lançar agora → Lançar.
2. Movimentações → Editar → Lançar.
3. Cancelar edição.
4. Movimentações → Duplicar → Lançar.
5. Excluir gasto → modal global.
6. Navegação entre as quatro áreas em diferentes breakpoints.

## Regra permanente

Qualquer ação nova que tenha origem e destino em views diferentes deve usar a camada de navegação. Não usar:
- `window.scrollTo` isoladamente;
- `scrollIntoView` antes de tornar a view visível;
- preenchimento direto de formulário oculto.

## Checklist de regressão para próximas rodadas

- [ ] A ação nasce em qual view?
- [ ] O destino está na mesma view?
- [ ] Se não estiver, a navegação acontece primeiro?
- [ ] O destino fica visível antes do scroll/foco?
- [ ] Mobile não abre teclado automaticamente sem intenção?
- [ ] Back/forward continua coerente?
- [ ] Existe smoke test para o fluxo cruzado?
