# Rodada 4 — Scanner Inteligente V1

Branch: `feature/round-4-smart-scanner`

Base: `feature/round-3-smart-entry-v2`

## Objetivo

Adicionar entrada por câmera sem criar um pipeline financeiro paralelo.

Toda captura deve terminar no mesmo contrato Smart Entry V4 e continuar exigindo revisão/confirmação humana antes de salvar.

## Modos

### QR / NFC-e
Fluxo:
1. usuário abre Scanner;
2. câmera traseira é solicitada;
3. QR é detectado;
4. quando o navegador possui `BarcodeDetector`, ele é usado primeiro;
5. quando não possui, o fallback `jsQR` é carregado sob demanda;
6. o payload é enviado ao Smart Entry como `inputMode: qr`;
7. parâmetros explícitos de valor/data são aproveitados quando existirem;
8. se o QR não contiver valor utilizável, o app não inventa: orienta fotografar o cupom.

Também é possível escolher uma foto existente contendo o QR.

### Cupom
Fluxo:
1. usuário escolhe Cupom;
2. fotografa ou seleciona uma imagem;
3. imagem é reduzida localmente para processamento;
4. OCR é carregado sob demanda com Tesseract.js;
5. OCR roda no navegador;
6. a imagem não é enviada ao backend;
7. somente o texto extraído segue para `/smart-entry/parse` com `inputMode: receipt`;
8. parser procura estabelecimento, linha de total e data;
9. resultado volta para a mesma prévia do Smart Entry;
10. usuário revisa e confirma.

## Privacidade

Na V1:
- a imagem não é persistida;
- a imagem não é enviada ao backend;
- não há upload de foto para IA;
- OCR é executado no navegador;
- somente o texto extraído é enviado para interpretação estruturada.

## Regras de segurança financeira

1. Nunca escolher arbitrariamente um valor quando o cupom possui vários valores e nenhuma linha de total identificável.
2. Dar prioridade a linhas como:
   - Valor Total
   - Total a Pagar
   - Valor a Pagar
   - Total
3. QR sem valor explícito não gera valor fictício.
4. Scanner nunca salva sozinho.
5. Resultado sempre converge para o Smart Entry V4.
6. Possível duplicidade continua sendo analisada pelo fluxo existente.
7. O usuário pode editar os campos antes de confirmar.

## Dependências carregadas sob demanda

- jsQR 1.4.0: fallback de leitura QR.
- Tesseract.js 5.1.1: OCR local de cupom.

Essas bibliotecas não são carregadas na inicialização normal do aplicativo.

## Interface

No Lançar:
- Falar
- Escanear
- Interpretar

Scanner:
- QR / NFC-e
- Cupom
- câmera ao vivo para QR;
- seleção/foto como fallback;
- status de processamento;
- aviso de privacidade.

## Limitações conhecidas da V1

- QR de NFC-e pode não expor valor diretamente no payload.
- Layouts de cupom variam e OCR pode precisar de revisão.
- Cupom amassado, baixa luz ou foto inclinada reduzem precisão.
- OCR local pode levar alguns segundos na primeira execução porque precisa carregar o motor/idioma.
- Esta rodada não consulta automaticamente portais estaduais da SEFAZ.
- Esta rodada não extrai cada item individual do cupom.

## Critérios de aceite

- Scanner abre sem alterar o formulário manual.
- Fechar scanner interrompe a câmera.
- Foto não é enviada ao backend.
- QR legível é detectado por câmera ou foto.
- Cupom com linha explícita de total prioriza o total.
- Cupom com múltiplos preços e sem total não inventa valor.
- Resultado aparece na prévia Smart Entry V4.
- Usuário continua confirmando antes de salvar.
- PWA/cache inclui o módulo scanner.
- Scanner respeita safe-area e layout mobile.

## Próxima evolução do scanner

V2:
- leitura de itens;
- agrupamento de produtos;
- divisão opcional por categoria;
- histórico de preços;
- reconhecimento mais específico de NFC-e por UF/portal;
- melhoria de OCR por pré-processamento visual.
