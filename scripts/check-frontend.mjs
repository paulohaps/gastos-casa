import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const api = fs.readFileSync('js/api.js', 'utf8');

const requiredIds = [
  'seletorMes','connectionStatus','cardTotal','cardSubtotalGeral','cardPaulo','cardSubtotalPaulo',
  'cardGustavo','cardSubtotalGustavo','boxAcertoDinheiro','boxAcertoVale','cardComparativoValor',
  'cardComparativoTexto','cardComparativoIcone','cardOrcamentoValor','orcamentoBarra','orcamentoResumo',
  'insightsLista','orcamentoPanel','btnSalvarOrcamentos','orcamentoDetalhes','formGasto','inputData',
  'inputFormaPagamento','usuarioAtualBadge','inputUsuario','inputValor','inputDescricao','inputCategoria',
  'btnSubmit','btnCancelarEdicao','chartDivisao','formRecorrente','recorrenteId','recorrenteDescricao',
  'recorrenteValor','recorrenteDia','recorrenteCategoria','recorrenteForma','listaRecorrentes',
  'filtroBusca','filtroCategoria','filtroUsuario','filtroForma','filtroContagem','filtroTotal',
  'tabelaHistorico','emptyState','toast','toastMsg',
  'configuracoes','formMembro','membroNome','membroEmail','membroSenha','listaMembros'
];

const missingIds = requiredIds.filter(id => !index.includes(`id="${id}"`));
if (missingIds.length) {
  console.error('IDs obrigatórios ausentes:', missingIds.join(', '));
  process.exit(1);
}

const requiredAppFunctions = [
  'carregarDados','atualizarDashboards','salvarOrcamentos','renderRecorrentes',
  'aplicarFiltros','gerarResumo','prepararEdicao','deletarGasto'
];
const missingFunctions = requiredAppFunctions.filter(name => !app.includes(`function ${name}`) && !app.includes(`async function ${name}`));
if (missingFunctions.length) {
  console.error('Funções essenciais ausentes:', missingFunctions.join(', '));
  process.exit(1);
}

for (const route of ['/expenses','/budgets','/recurring','/months','/members']) {
  if (!api.includes(route)) {
    console.error('Contrato de API ausente no frontend:', route);
    process.exit(1);
  }
}

console.log('Frontend contract check: OK');
