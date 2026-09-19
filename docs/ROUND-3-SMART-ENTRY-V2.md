# Rodada 3 — Smart Entry 2.0 / Contrato V4

Branch: `feature/round-3-smart-entry-v2`

Base: `feature/round-2-navigation`

## Objetivo

Evoluir o lançamento inteligente sem duplicar a inteligência já existente.

A base anterior já possuía:
- parser por regras;
- histórico;
- regras aprendidas;
- descrição padronizada;
- telemetria;
- voz;
- ponto de extensão para IA.

A Rodada 3 transforma isso em um contrato multimodal consistente, preparando câmera/QR/cupom sem implementar scanner ainda.

## Contrato V4

Parser:
`rules-learning-history-v4`

### Entrada normalizada
Modos aceitos:
- `text`
- `voice`
- `camera`
- `qr`
- `receipt`

Nesta rodada, somente texto e voz estão ativos na interface. Os demais modos ficam reservados no contrato para a próxima etapa.

### Draft financeiro
Mantém compatibilidade com:
- valor;
- descrição;
- categoria;
- forma de pagamento;
- data.

Adiciona:
- `estabelecimento` separado da descrição.

Exemplo:

```json
{
  "valor": 220,
  "descricao": "Combustível • Posto Trevo",
  "estabelecimento": "Posto Trevo",
  "categoria": "Outros",
  "formaPagamento": "Dinheiro",
  "data": "2026-09-19"
}
```

## Confiança

Continua existindo confiança por campo:
- valor;
- descrição;
- categoria;
- pagamento;
- data.

Adiciona:
- `confidence.overall`.

A interface traduz as faixas em:
- Alta;
- Boa;
- Média;
- Baixa.

A confiança é orientação para revisão, não autorização automática para gravar dados.

## Voz

A transcrição continua usando o fluxo existente.

Mudança:
- quando a interpretação vem do microfone, o backend recebe `inputMode: voice`;
- quando o usuário digita, recebe `inputMode: text`.

Os dois caminhos convergem no mesmo parser e no mesmo draft.

## Preparação para scanner

O contrato passa a declarar:

```json
{
  "capabilities": {
    "scannerReady": true,
    "acceptedInputModes": ["text", "voice", "camera", "qr", "receipt"]
  }
}
```

Isso evita criar um segundo pipeline quando câmera/QR forem implementados.

## Interface

A prévia do Smart Entry passa a mostrar:
- origem da entrada;
- confiança geral;
- confiança por campo;
- estabelecimento quando identificado;
- descrição padronizada;
- avisos;
- possível duplicidade;
- confirmação humana.

## Segurança

Regras mantidas:
1. Smart Entry não grava diretamente sem confirmação.
2. Valor ambíguo continua bloqueando confirmação.
3. Categoria/pagamento fora das listas permitidas são normalizados.
4. IA não substitui cálculos determinísticos.
5. Scanner futuro deverá produzir o mesmo contrato V4.
6. Texto bruto não deve virar descrição automaticamente.

## Testes adicionados

- origem de voz;
- fallback seguro para modo desconhecido;
- estabelecimento separado;
- confiança geral;
- contrato preparado para scanner;
- parser V4.

## Próxima rodada

Scanner Inteligente V1:
- câmera;
- QR/NFC-e;
- foto de cupom;
- classificação do tipo de entrada;
- extração básica;
- envio ao mesmo contrato do Smart Entry V4;
- confirmação antes de salvar.
