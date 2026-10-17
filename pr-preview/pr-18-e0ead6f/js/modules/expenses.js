(function () {
  'use strict';

  let ctx = null;
  let editId = null;
  let originalUser = null;
  let saveInFlight=false;
  let pendingAttempt=null;

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
      pessoa.className = 'person-badge ' + (gasto.usuario === 'Paulo Henrique' ? 'person-badge--paulo' : gasto.usuario === 'Fernando Gustavo' ? 'person-badge--fernando' : '');
      pessoa.textContent = gasto.usuario || 'Pessoa não informada';
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

    const selectedUser = usuarioEl.value;
    const names = [...new Set(ctx.getCurrentExpenses().map(item => item.usuario).filter(Boolean))];
    usuarioEl.replaceChildren(new Option('Pessoas', ''), ...names.map(name => new Option(name, name)));
    usuarioEl.value = names.includes(selectedUser) ? selectedUser : '';
    const busca = ctx.normalizeText(buscaEl.value);
    const categoria = catEl.value;
    const usuario = usuarioEl.value;
    const forma = formaEl.value;
    if (window.GastosNavigation?.current() === 'casa' && window.GastosNavigation?.houseTab?.() === 'despesas') {
      window.GastosExperience?.filters.set({ query: buscaEl.value, category: categoria, person: usuario, method: forma, type: 'house' });
    }

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
    document.getElementById('inputData').value = window.GastosCalendar.localDate();
    document.getElementById('inputDescricao').value = gasto.descricao || '';
    document.getElementById('inputValor').value = Number(gasto.valor) || '';
    document.getElementById('inputFormaPagamento').value = gasto.formaPagamento || 'Dinheiro';
    document.getElementById('inputCategoria').value = gasto.categoria || 'Outros';
    window.GastosNavigation?.showAndReveal('lancar', '#formGasto', {
      focusSelector: '#inputValor',
      block: 'start'
    });
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
    window.GastosNavigation?.showAndReveal('lancar', '#formGasto', {
      focusSelector: '#inputValor',
      block: 'start'
    });
  }

  function cancelEdit() {
    editId = null;
    originalUser = null;
    const form = document.getElementById('formGasto');
    if (form) form.reset();
    const data = document.getElementById('inputData');
    if (data) data.value = window.GastosCalendar.localDate();

    const usuario = document.getElementById('inputUsuario');
    if (usuario && window.usuarioLogadoNome) usuario.value = window.usuarioLogadoNome;

    const btnSubmit = document.getElementById('btnSubmit');
    if (btnSubmit) {
      btnSubmit.classList.remove('is-editing');
      btnSubmit.innerHTML = '<span>Lançar Despesa</span> <i class="fa-solid fa-paper-plane"></i>';
    }
    document.getElementById('btnCancelarEdicao')?.classList.add('hidden');
  }

  function showPendingAttempt() {
    if(document.getElementById('expensePendingAttempt')) return;
    const notice=document.createElement('div');notice.id='expensePendingAttempt';notice.className='expense-pending';
    const text=document.createElement('p');text.setAttribute('role','status');text.textContent='Envio sem confirmação. Repita com os mesmos dados ou confira o histórico antes de lançar novamente. Recarregar a aba perde esta tentativa.';
    const history=document.createElement('button');history.type='button';history.className='btn btn--ghost';history.textContent='Conferir histórico';
    history.onclick=()=>{const month=ctx.extractMonthFromIso(pendingAttempt?.date),select=document.getElementById('seletorMes');if(month&&select&&select.value!==month){if(![...select.options].some(o=>o.value===month))select.add(new Option(month,month));select.value=month;select.dispatchEvent(new Event('change',{bubbles:true}));}window.GastosNavigation?.show('casa');window.GastosNavigation?.showHouse('despesas');};
    const restart=document.createElement('button');restart.type='button';restart.className='btn btn--ghost';restart.textContent='Novo lançamento';
    restart.onclick=async()=>{if(saveInFlight)return;const confirmed=await ctx.ui.confirmAction({title:'Iniciar outro lançamento?',message:'O envio anterior pode ter sido salvo. Confira o histórico para evitar duplicidade. Deseja iniciar outro lançamento?',confirmLabel:'Iniciar novo'});if(confirmed&&!saveInFlight){pendingAttempt=null;notice.remove();cancelEdit();}};
    const actions=document.createElement('div');actions.className='expense-pending__actions';actions.append(history,restart);notice.append(text,actions);document.getElementById('btnSubmit').before(notice);
  }

  function bindForm() {
    const form = document.getElementById('formGasto');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if(saveInFlight) return;

      const valorInput = Number(document.getElementById('inputValor').value);
      const dataInputStr = document.getElementById('inputData').value;
      try {const amount=window.GastosSettlementCore.cents(valorInput);if(amount<1||amount>999999999999) throw new Error();}
      catch {return ctx.showToast('Informe um valor positivo com até duas casas decimais.',true);}


      const btn = document.getElementById('btnSubmit');
      const originalText = btn.innerHTML;
      const estavaEditando = Boolean(editId);
      let saved=false;
      saveInFlight=true;

      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
      btn.disabled = true;

      try {
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
        smartEntry: window.GastosSmartEntry?.getSubmissionMeta(estavaEditando) || null,
        receipt: !estavaEditando ? (window.GastosReceiptImport?.getSubmissionMeta() || null) : null
      };

        if(!estavaEditando) {
          const fingerprint=JSON.stringify([payload.usuario,payload.dataGasto,payload.valor,payload.descricao,payload.categoria,payload.formaPagamento]);
          if(pendingAttempt&&pendingAttempt.fingerprint!==fingerprint) throw new Error('Há um envio sem confirmação. Repita os mesmos dados ou confira o histórico antes de iniciar outro lançamento.');
          pendingAttempt ||= {fingerprint,date:payload.dataGasto,key:crypto.randomUUID()};
          payload.idempotencyKey=pendingAttempt.key;
        }
        const saveResult = await ctx.api.enviarGasto(payload);
        saved=true;
        if(!estavaEditando) {pendingAttempt=null;document.getElementById("expensePendingAttempt")?.remove();}
        cancelEdit();
        ctx.showToast(estavaEditando ? 'Despesa atualizada!' : 'Despesa lançada!');
        if (!estavaEditando) {
          window.GastosSmartEntry?.afterExpenseSaved(saveResult, payload.smartEntry);
          window.GastosReceiptImport?.afterExpenseSaved(saveResult, payload.receipt);
        }
        const mesDoGasto = ctx.extractMonthFromIso(dataInputStr);
        await ctx.reloadMonths(mesDoGasto);
      } catch (error) {
        if(!saved&&!estavaEditando&&pendingAttempt) showPendingAttempt();
        ctx.showToast(saved?'Despesa salva. Não foi possível atualizar a tela. Atualize o histórico antes de lançar novamente.':error?.message || 'Erro ao salvar gasto.', true);
      } finally {
        if(!saved) btn.innerHTML = originalText;
        btn.disabled = false;
        saveInFlight=false;
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
