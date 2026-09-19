(function () {
  'use strict';

  let ctx = null;
  let items = [];

  function init(options) {
    ctx = options;
    bindForm();
  }
  function setItems(next) { items = Array.isArray(next) ? next : []; }
  function getItems() { return items; }

  function wasPosted(item) {
    const alvo = ctx.normalizeText(item.descricao);
    return ctx.getCurrentExpenses().some(gasto => {
      const descricao = ctx.normalizeText(gasto.descricao);
      return descricao === alvo || descricao.includes(alvo) || alvo.includes(descricao);
    });
  }

  function render() {
    const lista = document.getElementById('listaRecorrentes');
    if (!lista) return;

    const ativos = items.filter(item => item.ativo !== false);
    if (!ativos.length) {
      lista.innerHTML = '<div class="recurring-empty"><i class="fa-solid fa-repeat"></i><span>Nenhum recorrente cadastrado.</span></div>';
      return;
    }

    lista.innerHTML = '';
    ativos.forEach(item => {
      const lancado = wasPosted(item);
      const linha = document.createElement('div');
      linha.className = 'recurring-item';
      linha.innerHTML =
        '<div class="recurring-item__content">' +
          '<div class="recurring-item__headline">' +
            '<p class="recurring-item__title">' + ctx.escapeHTML(item.descricao) + '</p>' +
            '<span class="status-badge ' + (lancado ? 'status-badge--success' : 'status-badge--warning') + '">' + (lancado ? 'Lançado' : 'Pendente') + '</span>' +
          '</div>' +
          '<p class="recurring-item__meta">Dia ' + Number(item.dia_vencimento) + ' • ' + ctx.formatCurrency(Number(item.valor)) + ' • ' + ctx.escapeHTML(item.categoria) + '</p>' +
        '</div>' +
        '<div class="recurring-item__actions">' +
          '<button type="button" onclick="usarRecorrente(\'' + ctx.escapeHTML(item.id) + '\')" class="table-action" title="Lançar agora" aria-label="Lançar ' + ctx.escapeHTML(item.descricao) + ' agora"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>' +
          '<button type="button" onclick="editarRecorrente(\'' + ctx.escapeHTML(item.id) + '\')" class="table-action table-action--edit" title="Editar" aria-label="Editar ' + ctx.escapeHTML(item.descricao) + '"><i class="fa-solid fa-pen"></i></button>' +
          '<button type="button" onclick="deletarRecorrente(\'' + ctx.escapeHTML(item.id) + '\')" class="table-action table-action--danger" title="Excluir" aria-label="Excluir ' + ctx.escapeHTML(item.descricao) + '"><i class="fa-solid fa-trash"></i></button>' +
        '</div>';
      lista.appendChild(linha);
    });
  }

  function cancelForm() {
    const form = document.getElementById('formRecorrente');
    if (!form) return;
    form.reset();
    document.getElementById('recorrenteId').value = '';
    document.getElementById('recorrenteCategoria').value = 'Contas';
    document.getElementById('recorrenteForma').value = 'Dinheiro';
  }

  function toggleForm() {
    const form = document.getElementById('formRecorrente');
    if (!form) return;
    if (form.classList.contains('hidden')) {
      cancelForm();
      form.classList.remove('hidden');
      document.getElementById('recorrenteDescricao')?.focus({ preventScroll: true });
    } else {
      form.classList.add('hidden');
    }
  }

  function edit(id) {
    const item = items.find(row => row.id === id);
    if (!item) return;
    const form = document.getElementById('formRecorrente');
    form.classList.remove('hidden');
    document.getElementById('recorrenteId').value = item.id;
    document.getElementById('recorrenteDescricao').value = item.descricao;
    document.getElementById('recorrenteValor').value = Number(item.valor);
    document.getElementById('recorrenteDia').value = Number(item.dia_vencimento);
    document.getElementById('recorrenteCategoria').value = item.categoria || 'Outros';
    document.getElementById('recorrenteForma').value = item.forma_pagamento || 'Dinheiro';
    document.getElementById('recorrenteDescricao')?.focus({ preventScroll: true });
  }

  function use(id) {
    const item = items.find(row => row.id === id);
    if (!item) return;
    ctx.cancelExpenseEdit();
    document.getElementById('inputData').valueAsDate = new Date();
    document.getElementById('inputDescricao').value = item.descricao;
    document.getElementById('inputValor').value = Number(item.valor);
    document.getElementById('inputCategoria').value = item.categoria || 'Outros';
    document.getElementById('inputFormaPagamento').value = item.forma_pagamento || 'Dinheiro';
    window.GastosNavigation?.showAndReveal('lancar', '#formGasto', {
      focusSelector: '#inputValor',
      block: 'start'
    });
  }

  async function remove(id) {
    const confirmado = ctx.ui
      ? await ctx.ui.confirmAction({
          title: 'Excluir recorrente',
          message: 'Este gasto recorrente será removido. Deseja continuar?',
          confirmLabel: 'Excluir'
        })
      : confirm('Excluir este gasto recorrente?');
    if (!confirmado) return;

    try {
      await ctx.api.excluirRecorrente(id);
      items = items.filter(item => item.id !== id);
      render();
      ctx.renderInsights();
      ctx.renderRadar();
      ctx.showToast('Recorrente excluído.');
    } catch (error) {
      ctx.showToast(error?.message || 'Erro ao excluir recorrente.', true);
    }
  }

  function bindForm() {
    const form = document.getElementById('formRecorrente');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const payload = {
        id: document.getElementById('recorrenteId').value || null,
        descricao: document.getElementById('recorrenteDescricao').value.trim(),
        valor: Number(document.getElementById('recorrenteValor').value),
        diaVencimento: Number(document.getElementById('recorrenteDia').value),
        categoria: document.getElementById('recorrenteCategoria').value,
        formaPagamento: document.getElementById('recorrenteForma').value,
        ativo: true
      };

      if (!payload.descricao || payload.valor <= 0 || payload.diaVencimento < 1 || payload.diaVencimento > 31) {
        return ctx.showToast('Revise os dados do recorrente.', true);
      }

      const submit = form.querySelector('button[type="submit"]');
      const original = submit.innerHTML;
      submit.disabled = true;
      submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

      try {
        await ctx.api.salvarRecorrente(payload);
        items = await ctx.api.fetchRecorrentes();
        cancelForm();
        form.classList.add('hidden');
        render();
        ctx.renderInsights();
        ctx.renderRadar();
        ctx.showToast('Recorrente salvo!');
      } catch (error) {
        ctx.showToast(error?.message || 'Erro ao salvar recorrente.', true);
      } finally {
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });
  }

  window.GastosRecurring = { init, setItems, getItems, render, wasPosted, toggleForm, cancelForm, edit, use, remove };
  window.recorrenteFoiLancado = wasPosted;
  window.renderRecorrentes = render;
  window.toggleRecorrenteForm = toggleForm;
  window.cancelarRecorrente = cancelForm;
  window.editarRecorrente = edit;
  window.usarRecorrente = use;
  window.deletarRecorrente = remove;
})();
