(function () {
  'use strict';
  const el = id => document.getElementById(id);
  let ctx;
  function renderHome() {
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
    const dialog = el('entryChoiceDialog');
    let opener;
    document.addEventListener('click', event => {
      const open = event.target.closest('[data-entry-open]');
      if (open) { opener = open; dialog.showModal(); return; }
      const target = event.target.closest('[data-entry-target]');
      if (target) {
        dialog.close();
        if (target.dataset.entryTarget === 'carteiras') {
          window.GastosNavigation.show('carteiras');
          window.GastosWallets.beginExpense();
        } else window.GastosNavigation.showAndReveal('lancar', '#formGasto');
      }
    });
    el('entryChoiceClose').onclick = () => dialog.close();
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
    el('assistantComposer').addEventListener('submit', async event => {
      event.preventDefault();
      const text = el('assistantText').value.trim();
      if (!text) return;
      const submit = el('assistantComposer').querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        window.GastosNavigation.show('lancar');
        el('smartEntryText').value = text;
        await window.GastosSmartEntry.interpretExternal(text, 'text');
        el('assistantComposerStatus').textContent = 'Confira a prévia antes de confirmar o lançamento na casa.';
      } catch (error) { ctx.showToast(error.message || 'Não foi possível interpretar.', true); }
      finally { submit.disabled = false; }
    });
    document.querySelectorAll('[data-assistant-action]').forEach(button => button.addEventListener('click', () => {
      const action = button.dataset.assistantAction;
      if (action === 'analyze') {
        el('assistantSignals').scrollIntoView({ behavior: 'smooth', block: 'start' });
        el('assistantComposerStatus').textContent = ctx.getBehaviorResult()?.signals.length
          ? 'Confira os sinais abaixo e abra os detalhes para entender os valores usados.'
          : 'Ainda não há sinais relevantes para a casa neste mês. Suas recomendações pessoais ficam em Carteiras.';
      } else {
        window.GastosNavigation.showAndReveal('lancar', '#smartEntryPanel');
        if (action === 'voice') el('btnFalarSmart').click();
        if (action === 'scan') window.GastosScanner.open('receipt');
      }
    }));
  }
  window.GastosExperience = { init, renderHome };
})();
