# Rodada 10 — Scanner V2

Branch: `feature/round-10-scanner-v2`

Base: `feature/round-9-insights-ui`

## Objetivo

Evoluir o scanner de uma leitura focada apenas no total para uma captura fiscal mais útil e explicável.

## NFC-e / QR

O Scanner V2 analisa o QR localmente antes de enviar qualquer conteúdo ao Smart Entry.

Ele tenta identificar:
- URL fiscal;
- domínio/portal;
- chave de acesso;
- valor explícito em query;
- valor do payload offline NFC-e quando presente;
- necessidade de consulta no portal.

Quando o QR possui valor explícito:
- monta um resumo compacto;
- evita enviar o payload bruto inteiro;
- mantém o conteúdo abaixo do limite de entrada do Smart Entry;
- permite continuar para a prévia normal do lançamento.

Quando o QR aponta apenas para o portal:
- não inventa valor;
- não tenta automatizar CAPTCHA;
- oferece “Abrir consulta fiscal”;
- oferece “Fotografar cupom” como fallback;
- informa que o portal pode exigir validação humana.

## CAPTCHA

O aplicativo não tenta contornar CAPTCHA ou validações equivalentes.

A estratégia é:
1. ler tudo que estiver disponível no QR;
2. usar valores explícitos quando presentes;
3. abrir o portal oficial quando a consulta depender dele;
4. deixar o usuário resolver a validação humana;
5. permitir fallback por foto/OCR.

## Cupom / OCR

Após o OCR local, o Scanner V2 tenta estruturar:
- estabelecimento;
- data;
- total;
- itens individuais;
- confiança do total e dos itens.

A imagem continua sendo processada localmente e não é enviada ao backend.

## Itens

A V2 reconhece linhas no formato:
`DESCRIÇÃO ... VALOR`

Filtros evitam tratar como produto:
- CNPJ/CPF;
- linhas fiscais;
- formas de pagamento;
- total;
- imposto;
- desconto;
- cabeçalhos.

A interface mostra até 8 itens e informa quando existem mais.

Os itens ainda não são gravados individualmente como despesas.

## Fluxo visual

Depois da leitura:
- o scanner permanece aberto;
- mostra o resultado encontrado;
- mostra itens quando disponíveis;
- o usuário escolhe “Continuar para lançamento”;
- só então o resultado segue para o Smart Entry;
- a confirmação final continua obrigatória.

## Contrato

Novo módulo puro:
`js/core/receipt-parser.js`

Funções:
- `analyzeQrPayload()`
- `analyzeReceiptText()`
- `parseMoney()`
- `extractAccessKey()`

Scanner:
- `GastosScanner.previewReceiptText()`
- `GastosScanner.previewQrPayload()`

As duas funções de preview existem também para teste visual determinístico.

## Segurança financeira

1. QR sem valor explícito não gera valor.
2. Cupom sem linha inequívoca de total não inventa total.
3. Itens reconhecidos não substituem o total oficial.
4. Scanner não salva sozinho.
5. Scanner não contorna CAPTCHA.
6. Resultado sempre termina no Smart Entry antes de qualquer gravação.

## PWA

- versão: `20260919-036`
- cache: `gastos-ape-v43`

## Validação antes de produção

Mudança visual exige:
1. testes verdes;
2. preview publicado;
3. link aberto e validável;
4. validação visual do usuário;
5. somente depois merge/publicação no PWA oficial.
