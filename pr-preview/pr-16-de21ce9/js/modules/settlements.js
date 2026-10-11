(function () {
  'use strict';

  let ctx = null;
  let items = [];
  let lastExpenses = [];
  let balances = {};

  function init(options) {
    ctx = options;
    document.getElementById('settlementForm')?.addEventListener('submit', submit);
    document.getElementById('settlementCancel')?.addEventListener('click', closeForm);
    document.getElementById('settlementDialog')?.addEventListener('click', event => {
      if (event.target.id === 'settlementDialog') closeForm();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.getElementById('settlementDialog')?.classList.contains('hidden')) closeForm();
    });
  }

  function setItems(nextItems) {
    items = Array.isArray(nextItems) ? nextItems : [];
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
    line.innerHTML = `<i class="fa-solid ${icon}"></i> <strong>${balance.paymentMethod}:</strong> `;
    line.append(document.createTextNode(' ' + balanceText(balance)));
    box.appendChild(line);

    if (balance.gross > 0) {
      const detail = document.createElement('p');
      detail.className = 'settlement-breakdown';
      detail.textContent = `Original ${ctx.formatCurrency(balance.gross)} · Pago ${ctx.formatCurrency(balance.settled)} · Falta ${ctx.formatCurrency(balance.remaining)}`;
      box.appendChild(detail);
    }

    if (!balance.isSettled && balance.debtor === window.usuarioLogadoNome) {
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

  function render(expenses) {
    lastExpenses = expenses || [];
    balances = {
      Dinheiro: window.GastosSettlementCore.calculate(lastExpenses, items, 'Dinheiro'),
      Vale: window.GastosSettlementCore.calculate(lastExpenses, items, 'Vale')
    };
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
    const balance = balances[method];
    if (!balance || balance.isSettled || balance.debtor !== window.usuarioLogadoNome) return;
    document.getElementById('settlementMethod').value = method;
    document.getElementById('settlementPayer').textContent = balance.debtor;
    document.getElementById('settlementReceiver').textContent = balance.creditor;
    document.getElementById('settlementAmount').value = full ? balance.remaining.toFixed(2) : '';
    document.getElementById('settlementAmount').max = balance.remaining.toFixed(2);
    document.getElementById('settlementRemaining').textContent = `Saldo disponível: ${ctx.formatCurrency(balance.remaining)}`;
    document.getElementById('settlementDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('settlementNote').value = '';
    document.getElementById('settlementDialog').classList.remove('hidden');
    document.body.classList.add('dialog-open');
    setTimeout(() => document.getElementById('settlementAmount').focus(), 0);
  }

  function closeForm() {
    document.getElementById('settlementDialog')?.classList.add('hidden');
    document.body.classList.remove('dialog-open');
  }

  async function submit(event) {
    event.preventDefault();
    const method = document.getElementById('settlementMethod').value;
    const balance = balances[method];
    const button = document.getElementById('settlementSubmit');
    button.disabled = true;
    try {
      await ctx.api.salvarAcerto({
        month: ctx.getSelectedMonth(),
        dataPagamento: document.getElementById('settlementDate').value,
        recebedor: balance.creditor,
        formaPagamento: method,
        valor: Number(document.getElementById('settlementAmount').value),
        observacao: document.getElementById('settlementNote').value
      });
      closeForm();
      ctx.showToast('Pagamento registrado no acerto.');
      await ctx.reloadMonth(ctx.getSelectedMonth());
    } catch (error) {
      ctx.showToast(error?.message || 'Não foi possível registrar o pagamento.', true);
    } finally {
      button.disabled = false;
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
