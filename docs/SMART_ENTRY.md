# Smart Entry — arquitetura, inteligência e rollback

## Objetivo

Transformar texto livre em um rascunho estruturado de gasto sem tornar a camada inteligente responsável por gravar dados financeiros.

Fluxo:

```
texto do usuário
  -> POST /smart-entry/parse
  -> parser determinístico
  -> regras manuais
  -> aprendizado confirmado da casa
  -> regras determinísticas
  -> histórico confirmado da casa
  -> ponto de extensão de IA
  -> SmartExpenseDraft
  -> prévia humana
  -> formulário atual
  -> POST /expenses
```

## Garantias

- O Smart Entry nunca grava diretamente em `gastos`.
- O usuário autenticado continua sendo o responsável efetivo pelo lançamento.
- Categorias continuam restritas a Mercado, Contas, Aluguel, Ifood e Outros.
- Formas de pagamento continuam restritas a Dinheiro e Vale.
- O formulário manual permanece disponível independentemente do Smart Entry.
- O texto original não é persistido.
- O endpoint aceita no máximo 500 caracteres.
- Consultas, lembretes, exclusões e frases negativas não viram gastos.

## Inteligência atual

A implementação continua sem depender de fornecedor externo.

A prioridade de categoria é:

1. regra manual configurada em **Configurações > Regras aprendidas**;
2. aprendizado confirmado da casa;
3. regra determinística por vocabulário;
4. histórico dos lançamentos confirmados;
5. fallback para revisão.

O aprendizado só acontece depois que um gasto originado pelo Smart Entry é realmente salvo. A fonte de verdade é o valor final confirmado pelo usuário, não a sugestão do parser.

Confiança do aprendizado:
- 1 confirmação: sugestão, exige revisão;
- 2 confirmações coerentes: evidência forte;
- 3+ confirmações coerentes: alta confiança;
- conflito entre categorias reduz a confiança e pode impedir a preferência automática.

Regras manuais sempre vencem aprendizado automático e histórico.

O arquivo `backend/smart-entry/ai-provider.mjs` é o contrato de extensão para um modelo externo. Um provider futuro só poderá enriquecer o rascunho; a validação final do backend continuará restringindo categoria, pagamento, valor e tamanho da descrição.

## Feature flag

O backend lê:

```
SMART_ENTRY_ENABLED
```

Valores `false`, `0`, `off` ou `no` desativam o recurso. Na ausência da variável, a V1 fica habilitada.

O frontend consulta `GET /features`. Se o recurso estiver desligado ou indisponível, o bloco inteligente não aparece e o formulário manual continua funcionando.

## Rollback

### Nível 1 — feature
Desabilitar `SMART_ENTRY_ENABLED` em um deployment que preserve as demais variáveis de ambiente.

### Nível 2 — frontend
Reverter os commits do Smart Entry. O fluxo `POST /expenses` não mudou.

### Nível 3 — backend
Reimplantar o deployment anterior da Neon Function. As rotas antigas não dependem de `/smart-entry/parse`.

### Banco
O aprendizado usa a tabela aditiva `smart_entry_rules`. Ela não altera `gastos` nem os contratos existentes.

Rollback funcional não exige apagar a tabela: desabilitar o Smart Entry ou voltar o backend anterior faz o app ignorá-la. Caso seja necessário remover o schema depois de uma janela de segurança, isso deve ser feito em uma migração separada e deliberada.

## Testes

Unitários cobrem:
- valor decimal;
- R$;
- valor falado;
- hoje/ontem/dia do mês;
- Vale/Dinheiro;
- categoria por regra;
- categoria por histórico;
- regra aprendida;
- override manual;
- conflito de evidências;
- múltiplos valores;
- consulta que não deve virar gasto;
- revisão obrigatória quando campo foi assumido.

Playwright cobre o bloco Smart Entry nos cinco viewports do projeto.

## Próxima evolução

Somente depois de medir a V1:
- provider de IA opcional para ambiguidades;
- telemetria sem texto bruto;
- telemetria de qualidade sem texto bruto;
- provider de IA opcional apenas para ambiguidades;
- foto/comprovante reutilizando o mesmo SmartExpenseDraft.


## Telemetria de qualidade

O Smart Entry registra telemetria técnica sem persistir o texto livre digitado.

A tabela `smart_entry_telemetry` armazena:
- versão do parser;
- origem da categoria;
- confiança por campo;
- indicação de revisão;
- quantidade de avisos;
- confirmação ou não do lançamento;
- tempo até confirmação;
- quais campos foram corrigidos;
- se uma evidência de aprendizado foi registrada.

Não são armazenados:
- texto original;
- descrição sugerida;
- valor sugerido;
- data sugerida;
- forma de pagamento sugerida;
- categoria sugerida.

Esses valores só transitam na requisição de confirmação para o backend calcular os booleanos de correção.

O painel **Configurações > Desempenho do Smart Entry** permite períodos de 7, 30 e 90 dias e mostra:
- interpretações;
- taxa de confirmação;
- taxa sem correção;
- tempo médio para confirmar;
- correções por campo;
- interpretações sem confirmação;
- evidências de aprendizado registradas;
- comparação da correção de categoria com e sem regras aprendidas.

A comparação de impacto só é apresentada como evidência quando há pelo menos 3 confirmações em cada grupo.


## Entrada por voz

O lançamento rápido possui um botão **Falar**. Quando o navegador oferece a Web Speech API:
- solicita acesso ao microfone a partir do gesto do usuário;
- usa `pt-BR`;
- mostra a transcrição no mesmo campo do Smart Entry;
- ao terminar a fala, interpreta automaticamente o texto;
- ainda exige confirmação humana antes de salvar.

Quando o navegador não oferece transcrição programática, o campo recebe foco e a interface orienta o uso do microfone nativo do teclado.

No mobile, campos editáveis usam fonte efetiva mínima de 16px. Isso evita o auto-zoom do Safari/iOS ao focar inputs menores, sem desabilitar o zoom de acessibilidade no viewport.

O fluxo de **Editar campos** também evita foco automático no mobile para não deslocar a viewport ou abrir o teclado sem uma ação explícita do usuário.
