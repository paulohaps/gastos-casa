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
const scanner = fs.readFileSync('js/modules/scanner.js', 'utf8');
const settlements = fs.readFileSync('js/modules/settlements.js', 'utf8');
const frontendModules = [app, smartEntry, scanner, radar, budgets, members, recurring, expenses, dashboard, settlements].join('\n');

const requiredIds = [
  'seletorMes','connectionStatus','cardTotal','cardSubtotalGeral','cardPaulo','cardSubtotalPaulo',
  'cardGustavo','cardSubtotalGustavo','boxAcertoDinheiro','boxAcertoVale','cardComparativoValor',
  'cardComparativoTexto','cardComparativoIcone','cardOrcamentoValor','orcamentoBarra','orcamentoResumo',
  'insightsLista','orcamentoPanel','btnSalvarOrcamentos','orcamentoDetalhes','formGasto','inputData',
  'inputFormaPagamento','usuarioAtualBadge','inputUsuario','inputValor','inputDescricao','inputCategoria',
  'btnSubmit','btnCancelarEdicao','chartDivisao','formRecorrente','recorrenteId','recorrenteDescricao',
  'recorrenteValor','recorrenteDia','recorrenteCategoria','recorrenteForma','listaRecorrentes',
  'filtroBusca','filtroCategoria','filtroUsuario','filtroForma','filtroContagem','filtroTotal',
  'tabelaHistorico','emptyState','toast','toastMsg','settlementHistoryList','settlementHistoryCount',
  'settlementDialog','settlementForm','settlementMethod','settlementDate','settlementAmount','settlementNote',
  'configuracoes','formMembro','membroNome','membroEmail','membroSenha','listaMembros',
  'radar-financeiro','radarStatus','projecaoMesValor','projecaoMesTexto','recorrentesPendentesValor',
  'recorrentesPendentesTexto','riscoOrcamentoValor','riscoOrcamentoTexto','alertasFinanceiros',
  'alertasFinanceirosContagem',
  'smartEntryPanel','smartEntryText','btnFalarSmart','smartVoiceStatus','btnInterpretarSmart','smartEntryPreview','smartEntryPreviewTitle',
  'smartEntryReviewBadge','smartEntryDescricao','smartEntryValor','smartEntryCategoria','smartEntryPagamento','smartEntryData',
  'smartEntryWarnings','smartEntryDuplicateWarning','smartEntrySource','smartEntryOverallConfidence',
  'smartEntryMerchantWrap','smartEntryEstabelecimento','btnEditarSmart','btnConfirmarSmart','smartEntryDivider',
  'btnSmartScanner','smartScannerBackdrop','smartScannerDialog','smartScannerClose','smartScannerModeQr',
  'smartScannerModeReceipt','smartScannerVideo','smartScannerCanvas','smartScannerStatus','smartScannerFile','smartScannerCapture',
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

for (const route of ['/expenses','/budgets','/recurring','/settlements','/months','/members','/features','/smart-entry/parse','/smart-entry/rules','/smart-entry/metrics']) {
  if (!api.includes(route)) {
    console.error('Contrato de API ausente no frontend:', route);
    process.exit(1);
  }
}

console.log('Frontend contract check: OK');
