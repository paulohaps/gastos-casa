(function () {
  'use strict';

  let ctx = null;
  let items = [];

  function init(options) { ctx = options; }
  function setItems(next) { items = Array.isArray(next) ? next : []; }
  function getItems() { return items; }

  function toggle() {
    const painel = document.getElementById('orcamentoPanel');
    if (painel) painel.classList.toggle('hidden');
  }

  function render() {
    const gastosCategoria = ctx.totalsByCategory(ctx.getCurrentExpenses());
    const mapa = {};
    items.forEach(item => { mapa[item.categoria] = Number(item.valor_limite) || 0; });

    document.querySelectorAll('[data-orcamento-categoria]').forEach(input => {
      const cat = input.getAttribute('data-orcamento-categoria');
      input.value = mapa[cat] > 0 ? mapa[cat] : '';
    });

    const totalMeta = Object.values(mapa).reduce((total, valor) => total + Number(valor || 0), 0);
    const totalGasto = ctx.totalize(ctx.getCurrentExpenses());
    const cardValor = document.getElementById('cardOrcamentoValor');
    const resumo = document.getElementById('orcamentoResumo');
    const barra = document.getElementById('orcamentoBarra');
    const detalhes = document.getElementById('orcamentoDetalhes');
    if (!cardValor || !resumo || !barra || !detalhes) return;

    if (totalMeta <= 0) {
      cardValor.textContent = 'Sem meta';
      resumo.textContent = 'Crie limites por categoria para acompanhar o mês.';
      barra.style.width = '0%';
      barra.className = 'progress-bar progress-bar--primary';
    } else {
      const percentual = (totalGasto / totalMeta) * 100;
      cardValor.textContent = ctx.formatCurrency(totalGasto) + ' / ' + ctx.formatCurrency(totalMeta);
      resumo.textContent = percentual.toFixed(0) + '% utilizado • restante ' + ctx.formatCurrency(Math.max(0, totalMeta - totalGasto));
      barra.style.width = Math.min(100, percentual) + '%';
      barra.className = 'progress-bar ' + (percentual > 100 ? 'progress-bar--danger' : percentual >= 80 ? 'progress-bar--warning' : 'progress-bar--primary');
    }

    detalhes.innerHTML = '';
    ctx.categories.forEach(cat => {
      const limite = mapa[cat] || 0;
      const gasto = gastosCategoria[cat] || 0;
      const percentual = limite > 0 ? (gasto / limite) * 100 : 0;
      const card = document.createElement('div');
      card.className = 'budget-item';
      card.innerHTML =
        '<div class="budget-item__head">' +
          '<span class="budget-item__name">' + ctx.escapeHTML(cat === 'Ifood' ? 'iFood' : cat) + '</span>' +
          '<span class="budget-item__percent">' + (limite > 0 ? percentual.toFixed(0) + '%' : 'sem meta') + '</span>' +
        '</div>' +
        '<p class="budget-item__value">' + ctx.formatCurrency(gasto) + '</p>' +
        '<p class="budget-item__meta">' + (limite > 0 ? 'de ' + ctx.formatCurrency(limite) : 'Defina uma meta') + '</p>';
      detalhes.appendChild(card);
    });
  }

  async function save() {
    const botao = document.getElementById('btnSalvarOrcamentos');
    const mes = document.getElementById('seletorMes')?.value;
    if (!mes) return;

    const original = botao ? botao.innerHTML : '';
    if (botao) {
      botao.disabled = true;
      botao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    }

    try {
      const payload = [...document.querySelectorAll('[data-orcamento-categoria]')].map(input => ({
        categoria: input.getAttribute('data-orcamento-categoria'),
        valorLimite: Math.max(0, Number(input.value || 0))
      }));
      items = await ctx.api.salvarOrcamentos(mes, payload);
      render();
      ctx.renderInsights();
      ctx.renderRadar();
      ctx.showToast('Metas salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      ctx.showToast(error?.message || 'Erro ao salvar orçamento.', true);
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.innerHTML = original;
      }
    }
  }

  window.GastosBudgets = { init, setItems, getItems, render, save, toggle };
  window.toggleOrcamentoPanel = toggle;
  window.salvarOrcamentos = save;
})();
