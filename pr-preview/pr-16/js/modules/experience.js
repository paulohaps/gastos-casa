(function () {
  'use strict';
  const el = id => document.getElementById(id);
  let ctx;
  let walletRequest;
  async function renderPersonalSummary() {
    walletRequest?.abort();
    const request = new AbortController(); walletRequest = request;
    const period = ctx.getSelectedMonth().split('/').reverse().join('-');
    el('homeWalletRemaining').textContent = '—'; el('homeWalletMeta').textContent = 'Consultando seu cofre';
    try {
      const wallets = await ctx.api.fetchWallets({ signal: request.signal });
      request.signal.throwIfAborted();
      if (!wallets.length) {
        el('homeWalletRemaining').textContent = 'Seu cofre';
        el('homeWalletMeta').textContent = 'Crie uma carteira e escolha um limite mensal.';
        return;
      }
      const selected = wallets.find(wallet => wallet.id === window.GastosWallets?.selectedWallet()) || wallets[0];
      const data = await ctx.api.fetchWalletExpenses(selected.id, period, { signal: request.signal });
      request.signal.throwIfAborted();
      if (!data.plan || (data.plan.remaining !== null && !Number.isFinite(data.plan.remaining))) throw new Error('Resumo pessoal inválido.');
      el('homeWalletRemaining').textContent = data.plan?.remaining == null ? 'Sem limite' : ctx.formatCurrency(data.plan.remaining);
      el('homeWalletMeta').textContent = selected.nome + ' · ' + period.split('-').reverse().join('/') + ' · orçamento pessoal';
    } catch {
      if (!request.signal.aborted) { el('homeWalletRemaining').textContent = 'Indisponível'; el('homeWalletMeta').textContent = 'Abra seu cofre para consultar novamente.'; }
    }
  }
  function renderHome() {
    renderPersonalSummary();
    const expenses = ctx.getCurrentExpenses();
    const signals = ctx.getBehaviorResult()?.signals || [];
    el('homeHouseTotal').textContent = ctx.formatCurrency(ctx.totalize(expenses));
    el('homeHouseMeta').textContent = expenses.length + (expenses.length === 1 ? ' gasto compartilhado' : ' gastos compartilhados') + ' neste mês';
    el('homePeriod').textContent = 'Casa · ' + ctx.getSelectedMonth();
    el('homeAttention').textContent = signals.length;
    const list = el('homeRecentExpenses'); list.replaceChildren();
    if (!expenses.length) { list.textContent = 'A casa ainda não tem gastos neste mês. Registre o primeiro em Novo gasto.'; return; }
    expenses.slice(0, 3).forEach(expense => {
      const row = document.createElement('div'); row.className = 'home-expense-row';
      const marker = document.createElement('span'); marker.className = 'home-expense-marker'; marker.textContent = String(expense.categoria || 'O').slice(0, 1);
      const copy = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = expense.descricao;
      const meta = document.createElement('small'); meta.textContent = expense.categoria + ' · ' + expense.data + ' · ' + expense.usuario;
      copy.append(title, meta);
      const value = document.createElement('strong'); value.className = 'home-expense-value'; value.textContent = ctx.formatCurrency(expense.valor);
      row.append(marker, copy, value); list.appendChild(row);
    });
  }
  function init(options) {
    ctx = options;
    window.addEventListener('gastos:viewchange', event => { if (event.detail.view === 'resumo') renderPersonalSummary(); });
    window.addEventListener('gastos:sessioncleared', () => {
      walletRequest?.abort(); el('homeWalletRemaining').textContent = '—'; el('homeWalletMeta').textContent = '';
    });
    const dialog = el('entryChoiceDialog');
    document.addEventListener('click', event => {
      const open = event.target.closest('[data-entry-open]');
      if (open) { window.AppUI.openModal(dialog); return; }
      const target = event.target.closest('[data-entry-target]');
      if (target) {
        window.AppUI.closeModal(dialog);
        if (target.dataset.entryTarget === 'carteiras') {
          window.GastosNavigation.show('carteiras');
          window.GastosWallets.beginExpense();
        } else window.GastosNavigation.show('lancar');
      }
    });
    el('entryChoiceClose').onclick = () => window.AppUI.closeModal(dialog);

  }
  window.GastosExperience = { init, renderHome };
})();
