(function () {
  'use strict';

  let ctx = null;
  let editId = null;
  let originalUser = null;

  function init(options) {
    ctx = options;
    bindForm();
  }

  function renderTable(dados) {
    const tbody = document.getElementById('tabelaHistorico');
    const emptyState = document.getElementById('emptyState');
    if (!tbody || !emptyState) return;

    tbody.innerHTML = '';
    emptyState.classList.toggle('hidden', dados.length !== 0);

    dados.forEach(gasto => {
      const valor = Number(gasto.valor) || 0;
      const forma = gasto.formaPagamento || 'Dinheiro';
      const tr = document.createElement('tr');

      const tdData = document.createElement('td');
      tdData.className = 'table-date';
      tdData.textContent = gasto.data || '';

      const tdDesc = document.createElement('td');
      tdDesc.className = 'table-description';
      const desc = document.createElement('div');
      desc.textContent = gasto.descricao || '';
      const cat = document.createElement('div');
      cat.className = 'table-category';
      cat.textContent = gasto.categoria || 'Outros';
      tdDesc.append(desc, cat);

      const tdQuem = document.createElement('td');
      const quemWrap = document.createElement('div');
      quemWrap.className = 'table-person-wrap';
      const pessoa = document.createElement('span');
      pessoa.className = 'person-badge ' + (gasto.usuario === 'Paulo Henrique' ? 'person-badge--paulo' : 'person-badge--fernando');
      pessoa.textContent = gasto.usuario === 'Paulo Henrique' ? 'Paulo' : 'Fernando';
      const pagamento = document.createElement('span');
      pagamento.className = 'payment-label' + (forma === 'Vale' ? ' payment-label--vale' : '');
      pagamento.innerHTML = forma === 'Vale'
        ? '<i class="fa-solid fa-ticket"></i> iFood'
        : '<i class="fa-solid fa-money-bill-transfer"></i> Dinheiro';
      quemWrap.append(pessoa, pagamento);
      tdQuem.appendChild(quemWrap);

      const tdValor = document.createElement('td');
      tdValor.className = 'table-value';
      tdValor.textContent = ctx.formatCurrency(valor);

      const tdAcoes = document.createElement('td');
      const acoes = document.createElement('div');
      acoes.className = 'table-actions';

      const criarBotao = (titulo, icon, classe, onClick) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = titulo;
        btn.setAttribute('aria-label', titulo + ' ' + (gasto.descricao || 'gasto'));
        btn.className = classe;
        btn.innerHTML = '<i class="' + icon + '"></i>';
        btn.addEventListener('click', onClick);
        return btn;
      };

      acoes.append(
        criarBotao('Duplicar', 'fa-solid fa-copy', 'table-action', () => duplicate(gasto.id)),
        criarBotao('Editar', 'fa-solid fa-pen', 'table-action table-action--edit', () =>
          edit(gasto.id, gasto.data, gasto.descricao, valor, gasto.usuario, forma, gasto.categoria || 'Outros')),
        criarBotao('Apagar', 'fa-solid fa-trash-can', 'table-action table-action--danger', event =>
          remove(gasto.id, event.currentTarget))
      );

      tdAcoes.appendChild(acoes);
      tr.append(tdData, tdDesc, tdQuem, tdValor, tdAcoes);
      tbody.appendChild(tr);
    });
  }

  function applyFilters() {
    const buscaEl = document.getElementById('filtroBusca');
    const catEl = document.getElementById('filtroCategoria');
    const usuarioEl = document.getElementById('filtroUsuario');
    const formaEl = document.getElementById('filtroForma');
    if (!buscaEl || !catEl || !usuarioEl || !formaEl) return;

    const busca = ctx.normalizeText(buscaEl.value);
    const categoria = catEl.value;
    const usuario = usuarioEl.value;
    const forma = formaEl.value;

    const filtrados = ctx.getCurrentExpenses().filter(item => {
      const texto = ctx.normalizeText((item.descricao || '') + ' ' + (item.categoria || ''));
      if (busca && !texto.includes(busca)) return false;
      if (categoria && item.categoria !== categoria) return false;
      if (usuario && item.usuario !== usuario) return false;
      if (forma && (item.formaPagamento || 'Dinheiro') !== forma) return false;
      return true;
    });

    renderTable(filtrados);
    const contagem = document.getElementById('filtroContagem');
    const totalEl = document.getElementById('filtroTotal');
    if (contagem) contagem.textContent = filtrados.length + (filtrados.length === 1 ? ' lançamento' : ' lançamentos');
    if (totalEl) totalEl.textContent = ctx.formatCurrency(ctx.totalize(filtrados));
  }

  function duplicate(id) {
    const gasto = ctx.getCurrentExpenses().find(item => item.id === id);
    if (!gasto) return;

    cancelEdit();
    document.getElementById('inputData').valueAsDate = new Date();
    document.getElementById('inputDescricao').value = gasto.descricao || '';
    document.getElementById('inputValor').value = Number(gasto.valor) || '';
    document.getElementById('inputFormaPagamento').value = gasto.formaPagamento || 'Dinheiro';
    document.getElementById('inputCategoria').value = gasto.categoria || 'Outros';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!window.matchMedia?.('(max-width: 900px)')?.matches) {
      setTimeout(() => document.getElementById('inputValor')?.focus({ preventScroll: true }), 250);
    }
    ctx.showToast('Gasto copiado para o formulário.');
  }

  async function remove(id, btnElement) {
    const confirmado = ctx.ui
      ? await ctx.ui.confirmAction({
          title: 'Excluir gasto',
          message: 'Este lançamento será removido do histórico. Deseja continuar?',
          confirmLabel: 'Excluir'
        })
      : confirm('Tem certeza que deseja apagar este gasto?');
    if (!confirmado) return;

    const mesSelecionado = document.getElementById('seletorMes').value;
    const original = btnElement?.innerHTML || '';
    if (btnElement) {
      btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      btnElement.disabled = true;
    }

    try {
      await ctx.api.enviarGasto({ action: 'delete', id, month: mesSelecionado });
      ctx.showToast('Gasto apagado!');
      await ctx.reloadMonth(mesSelecionado);
    } catch (error) {
      ctx.showToast(error?.message || 'Erro ao apagar.', true);
      if (btnElement) {
        btnElement.innerHTML = original || '<i class="fa-solid fa-trash-can"></i>';
        btnElement.disabled = false;
      }
    }
  }

  function edit(id, dataStr, descricao, valor, usuario, forma, categoria) {
    editId = id;
    originalUser = usuario || null;
    const partesData = String(dataStr || '').split('/');
    if (partesData.length === 3) {
      document.getElementById('inputData').value = partesData[2] + '-' + partesData[1] + '-' + partesData[0];
    }
    document.getElementById('inputDescricao').value = descricao || '';
    document.getElementById('inputValor').value = Number(valor) || '';
    document.getElementById('inputFormaPagamento').value = forma || 'Dinheiro';
    document.getElementById('inputCategoria').value = categoria || 'Outros';

    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.classList.add('is-editing');
    btnSubmit.innerHTML = '<span>Salvar Edição</span> <i class="fa-solid fa-pen"></i>';
    document.getElementById('btnCancelarEdicao').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    editId = null;
    originalUser = null;
    const form = document.getElementById('formGasto');
    if (form) form.reset();
    const data = document.getElementById('inputData');
    if (data) data.valueAsDate = new Date();

    const usuario = document.getElementById('inputUsuario');
    if (usuario && window.usuarioLogadoNome) usuario.value = window.usuarioLogadoNome;

    const btnSubmit = document.getElementById('btnSubmit');
    if (btnSubmit) {
      btnSubmit.classList.remove('is-editing');
      btnSubmit.innerHTML = '<span>Lançar Despesa</span> <i class="fa-solid fa-paper-plane"></i>';
    }
    document.getElementById('btnCancelarEdicao')?.classList.add('hidden');
  }

  function bindForm() {
    const form = document.getElementById('formGasto');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const valorInput = Number(document.getElementById('inputValor').value);
      const dataInputStr = document.getElementById('inputData').value;
      if (!Number.isFinite(valorInput) || valorInput <= 0) {
        return ctx.showToast('Valor inválido!', true);
      }

      const btn = document.getElementById('btnSubmit');
      const originalText = btn.innerHTML;
      const estavaEditando = Boolean(editId);

      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
      btn.disabled = true;

      const payload = {
        action: estavaEditando ? 'update' : 'add',
        id: editId,
        month: document.getElementById('seletorMes').value,
        dataGasto: dataInputStr,
        formaPagamento: document.getElementById('inputFormaPagamento').value,
        usuario: estavaEditando && originalUser
          ? originalUser
          : (window.usuarioLogadoNome || document.getElementById('inputUsuario').value),
        valor: valorInput,
        descricao: document.getElementById('inputDescricao').value.trim(),
        categoria: document.getElementById('inputCategoria').value,
        smartEntry: window.GastosSmartEntry?.getSubmissionMeta(estavaEditando) || null
      };

      try {
        const saveResult = await ctx.api.enviarGasto(payload);
        cancelEdit();
        ctx.showToast(estavaEditando ? 'Despesa atualizada!' : 'Despesa lançada!');
        if (!estavaEditando) {
          window.GastosSmartEntry?.afterExpenseSaved(saveResult, payload.smartEntry);
        }
        const mesDoGasto = ctx.extractMonthFromIso(dataInputStr);
        await ctx.reloadMonths(mesDoGasto);
      } catch (error) {
        ctx.showToast(error?.message || 'Erro ao salvar gasto.', true);
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  }

  window.GastosExpenses = {
    init,
    renderTable,
    applyFilters,
    duplicate,
    remove,
    edit,
    cancelEdit,
    isEditing: () => Boolean(editId)
  };

  window.aplicarFiltros = applyFilters;
  window.duplicarGasto = duplicate;
  window.deletarGasto = remove;
  window.prepararEdicao = edit;
  window.cancelarEdicao = cancelEdit;
})();
