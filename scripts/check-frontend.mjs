import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const api = fs.readFileSync('js/api.js', 'utf8');
const smartEntry = fs.readFileSync('js/modules/smart-entry.js', 'utf8');
const radar = fs.readFileSync('js/modules/radar.js', 'utf8');
const budgets = fs.readFileSync('js/modules/budgets.js', 'utf8');
const members = fs.readFileSync('js/modules/members.js', 'utf8');
const recurring = fs.readFileSync('js/modules/recurring.js', 'utf8');
const expenses = fs.readFileSync('js/modules/expenses.js', 'utf8');
const dashboard = fs.readFileSync('js/modules/dashboard.js', 'utf8');
const insights = fs.readFileSync('js/modules/insights.js', 'utf8');
const scanner = fs.readFileSync('js/modules/scanner.js', 'utf8');
const behaviorEngine = fs.readFileSync('js/core/behavior-engine.js', 'utf8');
const receiptParser = fs.readFileSync('js/core/receipt-parser.js', 'utf8');
const frontendModules = [app, behaviorEngine, receiptParser, smartEntry, scanner, radar, budgets, members, recurring, expenses, insights, dashboard].join('\n');

const requiredIds = [
  'seletorMes','connectionStatus','cardTotal','cardSubtotalGeral','cardPaulo','cardSubtotalPaulo',
  'cardGustavo','cardSubtotalGustavo','boxAcertoDinheiro','boxAcertoVale','cardComparativoValor',
  'cardComparativoTexto','cardComparativoIcone','cardOrcamentoValor','orcamentoBarra','orcamentoResumo',
  'insightsLista','insightsCount','orcamentoPanel','btnSalvarOrcamentos','orcamentoDetalhes','formGasto','inputData',
  'inputFormaPagamento','usuarioAtualBadge','inputUsuario','inputValor','inputDescricao','inputCategoria',
  'btnSubmit','btnCancelarEdicao','chartDivisao','formRecorrente','recorrenteId','recorrenteDescricao',
  'recorrenteValor','recorrenteDia','recorrenteCategoria','recorrenteForma','listaRecorrentes',
  'filtroBusca','filtroCategoria','filtroUsuario','filtroForma','filtroContagem','filtroTotal',
  'tabelaHistorico','emptyState','toast','toastMsg',
  'configuracoes','formMembro','membroNome','membroEmail','membroSenha','listaMembros',
  'radar-financeiro','radarStatus','projecaoMesValor','projecaoMesTexto','recorrentesPendentesValor',
  'recorrentesPendentesTexto','riscoOrcamentoValor','riscoOrcamentoTexto','alertasFinanceiros',
  'alertasFinanceirosContagem',
  'smartEntryPanel','smartEntryText','btnFalarSmart','smartVoiceStatus','btnInterpretarSmart','smartEntryPreview','smartEntryPreviewTitle',
  'smartEntryReviewBadge','smartEntryDescricao','smartEntryValor','smartEntryCategoria','smartEntryPagamento','smartEntryData',
  'smartEntryWarnings','smartEntryDuplicateWarning','smartEntrySource','smartEntryOverallConfidence',
  'smartEntryMerchantWrap','smartEntryEstabelecimento','btnEditarSmart','btnConfirmarSmart','smartEntryDivider',
  'btnSmartScanner','smartScannerBackdrop','smartScannerDialog','smartScannerClose','smartScannerModeQr',
  'smartScannerModeReceipt','smartScannerVideo','smartScannerCanvas','smartScannerStatus','smartScannerCameraFile','smartScannerGalleryFile','smartScannerCapture','smartScannerGallery',
  'smartScannerResult','smartScannerResultTitle','smartScannerResultMeta','smartScannerItems','smartScannerVerificationNote',
  'smartScannerFiscalLink','smartScannerUsePhoto','smartScannerContinue',
  'smartRulesTitle','formSmartRule','smartRuleTermo','smartRuleCategoria','listaSmartRules',
  'smartMetricsTitle','smartMetricsDays','smartMetricInterpretacoes','smartMetricInterpretacoesMeta',
  'smartMetricConfirmados','smartMetricConfirmadosMeta','smartMetricSemCorrecao','smartMetricSemCorrecaoMeta',
  'smartMetricTempo','smartMetricTempoMeta','smartMetricsCorrecoes','smartMetricsLearningImpact'
];

const missingIds = requiredIds.filter(id => !index.includes(`id="${id}"`));
if (missingIds.length) {
  console.error('IDs obrigatórios ausentes:', missingIds.join(', '));
  process.exit(1);
}

const requiredAppFunctions = [
  'carregarDados','atualizarDashboards','salvarOrcamentos','renderRecorrentes',
  'aplicarFiltros','gerarResumo','prepararEdicao','deletarGasto','renderRadarFinanceiro',
  'configurarSmartEntry','interpretarSmartEntry','renderSmartEntryPreview','iniciarDitadoSmart',
  'carregarRegrasSmart','renderRegrasSmart','toggleSmartRuleForm',
  'carregarMetricasSmart','renderMetricasSmart'
];
const missingFunctions = requiredAppFunctions.filter(name =>
  !frontendModules.includes(`function ${name}`) &&
  !frontendModules.includes(`async function ${name}`) &&
  !frontendModules.includes(`window.${name} =`)
);
if (missingFunctions.length) {
  console.error('Funções essenciais ausentes:', missingFunctions.join(', '));
  process.exit(1);
}

for (const route of ['/expenses','/budgets','/recurring','/months','/members','/features','/smart-entry/parse','/smart-entry/rules','/smart-entry/metrics']) {
  if (!api.includes(route)) {
    console.error('Contrato de API ausente no frontend:', route);
    process.exit(1);
  }
}

console.log('Frontend contract check: OK');


if (!index.includes('js/core/behavior-engine.js')) {
  console.error('Behavior Engine não está carregado no index.html');
  process.exit(1);
}
if (!behaviorEngine.includes('behavior-v1') || !behaviorEngine.includes('possible_duplicate') || !behaviorEngine.includes('missing_recurring')) {
  console.error('Contrato do Behavior Engine V1 incompleto.');
  process.exit(1);
}
if (!app.includes('window.GastosBehavior') || !app.includes('window.GastosBehaviorEngine?.analyze')) {
  console.error('Behavior Engine não está conectado ao bootstrap do app.');
  process.exit(1);
}


if (!index.includes('js/modules/insights.js')) {
  console.error('Insights UI não está carregada no index.html');
  process.exit(1);
}
if (!insights.includes('window.GastosInsights') || !insights.includes('slice(0, 4)')) {
  console.error('Contrato da Insights UI incompleto.');
  process.exit(1);
}
if (!dashboard.includes('window.GastosInsights?.render()')) {
  console.error('Dashboard ainda não delega Insights ao Behavior Engine.');
  process.exit(1);
}


if (!index.includes('js/core/receipt-parser.js')) {
  console.error('Scanner V2 parser não está carregado no index.html');
  process.exit(1);
}
if (!receiptParser.includes('analyzeQrPayload') || !receiptParser.includes('analyzeReceiptText')) {
  console.error('Contrato do Scanner V2 parser incompleto.');
  process.exit(1);
}
if (!scanner.includes('previewReceiptText') || !scanner.includes('smartScannerFiscalLink')) {
  console.error('Scanner V2 não expõe preview de cupom/fallback fiscal.');
  process.exit(1);
}


if (!receiptParser.includes('buildItemsDescription')) {
  console.error('Scanner V2 não possui montagem estruturada da descrição por itens.');
  process.exit(1);
}
if (!scanner.includes('applyExternalOverrides') || !scanner.includes('smartScannerGallery')) {
  console.error('Scanner V2 não preserva itens na descrição ou não oferece galeria.');
  process.exit(1);
}
