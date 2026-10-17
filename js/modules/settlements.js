(function () {
  'use strict';

  let ctx = null;
  let items = [];
  let lastExpenses = [];
  let balances = {};
  let pendingPayment = null;
  let atomic = false;
  let complete = false;

  function init(options) {
    ctx = options;
    document.getElementById('settlementForm')?.addEventListener('submit', submit);
    document.getElementById('settlementCancel')?.addEventListener('click', closeForm);

  }

  function setItems(nextItems) {
    items = Array.isArray(nextItems) ? nextItems : null;
    atomic = nextItems?.atomic === true;
    complete = nextItems?.complete === true;
  }

  function getItems() {
    return items;
  }

  function balanceText(balance) {
    if (balance.isSettled) return 'Tudo quite!';
    return `${balance.debtor.split(' ')[0]} deve ${ctx.formatCurrency(balance.remaining)} a ${balance.creditor.split(' ')[0]}`;
  }

  function renderBalance(box, balance, icon) {
    if (!box) return;
    box.replaceChildren();

    const line = document.createElement('p');
    line.className = 'settlement ' + (balance.isSettled ? 'settlement--success' : 'settlement--warning');
    const kind = document.createElement('span');
    kind.className = 'settlement-kind';
    const marker = document.createElement('i');
    marker.className = 'fa-solid ' + icon;
    marker.setAttribute('aria-hidden', 'true');
    const method = document.createElement('strong');
    method.textContent = balance.paymentMethod;
    kind.append(marker, method);
    const summary = document.createElement('span');
    summary.className = 'settlement-summary';
    summary.textContent = balanceText(balance);
    line.append(kind, summary);
    box.appendChild(line);

    if (balance.gross > 0) {
      const detail = document.createElement('p');
      detail.className = 'settlement-breakdown';
      detail.textContent = `Original ${ctx.formatCurrency(balance.gross)} · Pago ${ctx.formatCurrency(balance.settled)} · Falta ${ctx.formatCurrency(balance.remaining)}`;
      box.appendChild(detail);
    }

    if (atomic && !balance.isSettled && balance.debtor === window.usuarioLogadoNome) {
      const actions = document.createElement('div');
      actions.className = 'settlement-actions';
      const partial = document.createElement('button');
      partial.type = 'button';
      partial.className = 'btn btn--settlement';
      partial.textContent = 'Registrar pagamento';
      partial.onclick = () => openForm(balance.paymentMethod, false);
      const full = document.createElement('button');
      full.type = 'button';
      full.className = 'btn btn--settlement-quiet';
      full.textContent = 'Quitar restante';
      full.onclick = () => openForm(balance.paymentMethod, true);
      actions.append(partial, full);
      box.appendChild(actions);
    }
  }

  function unavailable(message) {
    balances = {};
    for (const id of ['boxAcertoDinheiro', 'boxAcertoVale', 'settlementHistoryList']) {
      document.getElementById(id)?.replaceChildren();
    }
    renderOverview(null, message);
    window.AppUI.setModuleError('acertos', message, () => ctx.reloadMonth(ctx.getSelectedMonth()));
    return balances;
  }

  function renderOverview(summary, error = '') {
    const box = document.getElementById('houseDebtOverview');
    if (!box) return;
    box.replaceChildren();
    document.getElementById('houseDebtPeriod').textContent = ctx.getSelectedMonth() + ' · após pagamentos registrados';
    if (!summary) {
      const text = document.createElement('p'); text.textContent = error; box.append(text);
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn--ghost'; retry.textContent = 'Tentar novamente';
      retry.onclick = () => ctx.reloadMonth(ctx.getSelectedMonth()); box.append(retry); return;
    }
    const list = document.createElement('ul'); list.className = 'balance-summary__rows';
    for (const row of summary.balances.filter(row => row.amountCents > 0)) {
      const line = document.createElement('li');
      const label = document.createElement('span'); label.textContent = row.direction === 'payable' ? 'Você deve a ' + summary.otherPerson.split(' ')[0] : summary.otherPerson.split(' ')[0] + ' deve a você';
      const amount = document.createElement('strong'); amount.textContent = ctx.formatCurrency(row.amountCents / 100);
      const method = document.createElement('span'); method.textContent = row.method;
      line.append(label, amount, method); list.append(line);
    }
    if (!list.childElementCount) { const empty = document.createElement('p'); empty.textContent = 'Ninguém deve neste mês. Tudo quite.'; box.append(empty); }
    else box.append(list);
  }

  function render(expenses) {
    lastExpenses = expenses || [];
    if (!items) {
      return unavailable('Pagamentos indisponíveis. Não é possível confirmar o saldo.');
    }
    if (!atomic) {
      unavailable('Registro de pagamentos indisponível até a atualização financeira do servidor.');
      renderHistory();
      return balances;
    }
    if (!complete) {
      unavailable('Pagamentos incompletos. Não é possível confirmar o saldo. Tente novamente.');
      renderHistory();
      return balances;
    }
    try {
    balances = {
      Dinheiro: window.GastosSettlementCore.calculate(lastExpenses, items, 'Dinheiro'),
      Vale: window.GastosSettlementCore.calculate(lastExpenses, items, 'Vale')
    };
    } catch (error) {
      return unavailable(error.message);
    }
    try {
      renderOverview(window.GastosSettlementCore.summarize(lastExpenses, items, { owner: window.usuarioLogadoNome, months: [ctx.getSelectedMonth().split('/').reverse().join('-')] }));
    } catch (error) { return unavailable(error.message); }
    renderBalance(document.getElementById('boxAcertoDinheiro'), balances.Dinheiro, 'fa-money-bill-transfer');
    renderBalance(document.getElementById('boxAcertoVale'), balances.Vale, 'fa-ticket');
    renderHistory();
    return balances;
  }

  function renderHistory() {
    const list = document.getElementById('settlementHistoryList');
    const count = document.getElementById('settlementHistoryCount');
    if (!list || !count) return;
    count.textContent = items.length ? `${items.length} ${items.length === 1 ? 'registro' : 'registros'}` : 'Nenhum pagamento';
    list.replaceChildren();

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state-inline';
      empty.textContent = 'Os pagamentos parciais e quitações desta competência aparecerão aqui.';
      list.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const row = document.createElement('article');
      row.className = 'settlement-history__item';
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${item.pagador.split(' ')[0]} → ${item.recebedor.split(' ')[0]} · ${ctx.formatCurrency(item.valor)}`;
      const meta = document.createElement('span');
      meta.textContent = `${item.formaPagamento} · ${item.dataPagamento}${item.observacao ? ' · ' + item.observacao : ''}`;
      content.append(title, meta);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-btn';
      remove.title = 'Excluir pagamento';
      remove.setAttribute('aria-label', `Excluir pagamento de ${ctx.formatCurrency(item.valor)}`);
      remove.innerHTML = '<i class="fa-solid fa-trash"></i>';
      remove.onclick = () => removeItem(item);
      row.append(content, remove);
      list.appendChild(row);
    });
  }

  function openForm(method, full) {
    if (!atomic) { ctx.showToast('Servidor ainda não confirmou pagamentos seguros.', true); return; }
    const balance = balances[method];
    if (!balance || balance.isSettled || balance.debtor !== window.usuarioLogadoNome) return;
    document.getElementById('settlementMethod').value = method;
    document.getElementById('settlementPayer').textContent = balance.debtor;
    document.getElementById('settlementReceiver').textContent = balance.creditor;
    document.getElementById('settlementAmount').value = full ? balance.remaining.toFixed(2) : '';
    document.getElementById('settlementAmount').max = balance.remaining.toFixed(2);
    document.getElementById('settlementRemaining').textContent = `Saldo disponível: ${ctx.formatCurrency(balance.remaining)}`;
    document.getElementById('settlementDate').value = window.GastosCalendar.localDate();
    document.getElementById('settlementNote').value = '';
    document.getElementById('settlementStatus').textContent = '';
    pendingPayment = null;
    window.AppUI.openModal('settlementDialog', '#settlementAmount');
  }

  function closeForm() {
    window.AppUI.closeModal('settlementDialog');
  }

  async function submit(event) {
    event.preventDefault();
    const method = document.getElementById('settlementMethod').value;
    const balance = balances[method];
    const button = document.getElementById('settlementSubmit');
    if (button.disabled) return;
    button.disabled = true;
    window.AppUI.setModalBusy('settlementDialog', true);
    try {
      const payload = {
        month: ctx.getSelectedMonth(),
        dataPagamento: document.getElementById('settlementDate').value,
        recebedor: balance.creditor,
        formaPagamento: method,
        valor: Number(document.getElementById('settlementAmount').value),
        observacao: document.getElementById('settlementNote').value
      };
      const signature = JSON.stringify(payload);
      if (pendingPayment?.signature !== signature) pendingPayment = { signature, key: crypto.randomUUID() };
      await ctx.api.salvarAcerto({ ...payload, idempotencyKey: pendingPayment.key });
      window.AppUI.setModalBusy('settlementDialog', false);
      closeForm();
      ctx.showToast('Pagamento registrado no acerto.');
      await ctx.reloadMonth(ctx.getSelectedMonth());
    } catch (error) {
      document.getElementById('settlementStatus').textContent = error?.message || 'Não foi possível registrar o pagamento.';
    } finally {
      button.disabled = false;
      window.AppUI.setModalBusy('settlementDialog', false);
    }
  }

  async function removeItem(item) {
    const confirmed = await window.AppUI.confirmAction({
      title: 'Excluir pagamento?',
      message: `O saldo de ${item.formaPagamento} será recalculado sem este registro.`,
      confirmLabel: 'Excluir pagamento'
    });
    if (!confirmed) return;
    try {
      await ctx.api.excluirAcerto(item.id);
      ctx.showToast('Pagamento excluído.');
      await ctx.reloadMonth(ctx.getSelectedMonth());
    } catch (error) {
      ctx.showToast(error?.message || 'Não foi possível excluir o pagamento.', true);
    }
  }

  function summaryText() {
    return ['Dinheiro', 'Vale'].map(method => {
      const balance = balances[method];
      return balance ? `${method}: ${balanceText(balance)}` : `${method}: —`;
    }).join('\n👉 ');
  }

  window.GastosSettlements = { init, setItems, getItems, render, summaryText, openForm };
})();
