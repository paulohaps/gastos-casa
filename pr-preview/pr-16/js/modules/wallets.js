(function () {
  'use strict';
  let ctx, wallets = [], items = [], selected = '', plan = null, aiConfigured = false, generation = 0, expenseEdit = null;
  const el = id => document.getElementById(id);
  const money = n => ctx.formatCurrency(Number(n) || 0);
  const month = () => el('walletMonth').value;
  const wallet = () => wallets.find(w => w.id === selected);
  function message(text, error = false) { el('walletStatus').textContent = text; if (error) ctx.showToast(text, true); }
  function clearExpense() {
    expenseEdit = null;
    el('walletExpenseForm').reset();
    el('walletExpenseDate').valueAsDate = new Date();
    el('walletExpenseSubmit').textContent = 'Salvar gasto pessoal';
    el('walletExpenseCancel').hidden = true;
  }
  function render() {
    const current = wallet();
    el('walletControls').hidden = !current;
    el('walletManageName').value = current?.nome || '';
    el('walletManageLimit').value = current?.limite_mensal || 0;
    el('walletSummary').textContent = plan ? `Gastos: ${money(plan.spent)} · Limite: ${plan.budget ? money(plan.budget) : 'não definido'} · Disponível: ${plan.remaining === null ? 'defina um limite' : money(plan.remaining)}` : '';
    el('walletDaily').textContent = plan?.daily !== null && plan?.daily !== undefined ? `${money(plan.daily)} por dia até o fim do mês. Referência de orçamento, não saldo bancário.` : 'O limite diário aparece no mês atual quando há um orçamento definido.';
    const signals = el('walletSignals'); signals.replaceChildren();
    (plan?.signals || []).forEach(signal => {
      const row = document.createElement('p');
      const labels = { over_budget: 'Limite ultrapassado em ', fast_pace: 'Ritmo elevado · referência diária: ', delivery_opportunity: 'Simulação de economia com delivery: ' };
      row.textContent = labels[signal.type] + money(signal.amount) + '. ' + signal.action;
      signals.appendChild(row);
    });
    if (plan && !plan.signals.length) signals.textContent = 'Sem sinais relevantes com os dados disponíveis.';
    el('walletAiButton').disabled = !aiConfigured || !plan?.signals.length;
    el('walletAiStatus').textContent = aiConfigured ? 'Explicação opcional. Os cálculos acima usam regras e não consomem tokens.' : 'Recomendações por regras ativas. Explicação por IA disponível após configuração no servidor.';
    const list = el('walletExpenseList'); list.replaceChildren();
    if (!items.length) list.textContent = 'Nenhum gasto pessoal neste mês.';
    items.forEach(item => {
      const row = document.createElement('div'); row.className = 'wallet-expense';
      const copy = document.createElement('span');
      copy.textContent = `${item.data.split('-').reverse().join('/')} · ${item.descricao} · ${item.categoria} · ${money(item.valor)}`;
      const actions = document.createElement('div'); actions.className = 'form-actions';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn--ghost btn--compact'; edit.textContent = 'Editar';
      edit.setAttribute('aria-label', 'Editar ' + item.descricao);
      edit.onclick = () => {
        expenseEdit = item.id;
        el('walletExpenseDate').value = item.data; el('walletExpenseValue').value = item.valor;
        el('walletExpenseDescription').value = item.descricao; el('walletExpenseCategory').value = item.categoria;
        el('walletExpenseSubmit').textContent = 'Salvar edição pessoal'; el('walletExpenseCancel').hidden = false;
        el('walletExpenseForm').scrollIntoView({ block: 'center', behavior: 'smooth' });
      };
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn--ghost btn--compact'; remove.textContent = 'Excluir';
      remove.setAttribute('aria-label', 'Excluir ' + item.descricao);
      remove.onclick = async () => {
        const id = selected;
        if (!await ctx.ui.confirmAction({ title: 'Excluir gasto pessoal?', message: item.descricao, confirmLabel: 'Excluir', danger: true })) return;
        remove.disabled = true;
        try { await ctx.api.saveWalletExpense({ action: 'delete', id: item.id, walletId: id }); clearExpense(); await loadExpenses(); }
        catch (e) { message(e.message, true); } finally { remove.disabled = false; }
      };
      actions.append(edit, remove); row.append(copy, actions); list.appendChild(row);
    });
  }
  async function loadExpenses() {
    const turn = ++generation, id = selected, period = month();
    items = []; plan = null; aiConfigured = false; el('walletAiText').textContent = ''; render();
    if (!id || !period) return;
    message('Carregando carteira...');
    try {
      const data = await ctx.api.fetchWalletExpenses(id, period);
      if (turn !== generation) return;
      items = data.expenses || []; plan = data.plan; aiConfigured = data.aiConfigured === true; render(); message('Carteira privada · visível apenas para você.');
    } catch (e) { if (turn === generation) message(e.message, true); }
  }
  async function load() {
    message('Carregando carteiras...');
    try {
      wallets = await ctx.api.fetchWallets();
      if (!wallets.some(w => w.id === selected)) selected = wallets[0]?.id || '';
      el('walletSelect').replaceChildren();
      if (!wallets.length) el('walletSelect').add(new Option('Crie sua primeira carteira', ''));
      wallets.forEach(w => el('walletSelect').add(new Option(w.nome, w.id)));
      el('walletSelect').value = selected;
      await loadExpenses();
      if (!wallets.length) message('Crie uma carteira para organizar seus gastos pessoais.');
    } catch (e) { message(e.message, true); }
  }
  function bindForm(id, action) {
    el(id).addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.submitter || el(id).querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      try { await action(); } catch (e) { message(e.message || 'Não foi possível salvar.', true); }
      finally { button.disabled = false; }
    });
  }
  function init(options) {
    ctx = options;
    el('walletMonth').value = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'); clearExpense();
    el('walletSelect').onchange = () => { selected = el('walletSelect').value; clearExpense(); loadExpenses(); };
    el('walletMonth').onchange = () => { clearExpense(); loadExpenses(); };
    el('walletRefresh').onclick = load;
    el('walletExpenseCancel').onclick = clearExpense;
    bindForm('walletCreateForm', async () => {
      const result = await ctx.api.saveWallet({ action: 'add', nome: el('walletName').value.trim(), limiteMensal: Number(el('walletLimit').value) });
      selected = result.wallets[0].id; el('walletCreateForm').reset(); await load();
    });
    bindForm('walletManageForm', async () => {
      await ctx.api.saveWallet({ action: 'update', id: selected, nome: el('walletManageName').value.trim(), limiteMensal: Number(el('walletManageLimit').value) }); await load();
    });
    el('walletDelete').onclick = async () => {
      const id = selected;
      if (!id || !await ctx.ui.confirmAction({ title: 'Excluir carteira vazia?', message: 'Carteiras com lançamentos precisam ter os gastos removidos antes.', confirmLabel: 'Excluir', danger: true })) return;
      el('walletDelete').disabled = true;
      try { await ctx.api.saveWallet({ action: 'delete', id }); clearExpense(); await load(); }
      catch (e) { message(e.message, true); } finally { el('walletDelete').disabled = false; }
    };
    bindForm('walletExpenseForm', async () => {
      if (!selected) throw new Error('Escolha uma carteira.');
      await ctx.api.saveWalletExpense({ action: expenseEdit ? 'update' : 'add', id: expenseEdit, walletId: selected, dataGasto: el('walletExpenseDate').value,
        valor: Number(el('walletExpenseValue').value), descricao: el('walletExpenseDescription').value.trim(), categoria: el('walletExpenseCategory').value });
      clearExpense(); await loadExpenses();
    });
    el('walletAiButton').onclick = async () => {
      const turn = generation, id = selected, period = month();
      el('walletAiButton').disabled = true;
      try {
        const data = await ctx.api.explainWallet(id, period);
        if (turn !== generation) return;
        const answer = data.explanation;
        el('walletAiText').textContent = answer.text;
        el('walletAiStatus').textContent = answer.source === 'ai'
          ? `Explicação por IA${answer.cached ? ' reutilizada' : ''}. ${answer.usage && !answer.cached ? 'Tokens: ' + answer.usage.input + ' entrada / ' + answer.usage.output + ' saída.' : ''} Revise as sugestões antes de decidir.`
          : 'Explicação por regras. A IA não foi acionada ou está indisponível.';
      } catch (e) { if (turn === generation) message(e.message, true); }
      finally { if (turn === generation) el('walletAiButton').disabled = !aiConfigured || !plan?.signals.length; }
    };
    let loaded = false;
    const maybeLoad = view => { if (view === 'mais' && !loaded) { loaded = true; load(); } };
    window.addEventListener('gastos:viewchange', event => maybeLoad(event.detail.view));
    maybeLoad(window.GastosNavigation?.current()); render();
  }
  window.GastosWallets = { init, load };
})();
