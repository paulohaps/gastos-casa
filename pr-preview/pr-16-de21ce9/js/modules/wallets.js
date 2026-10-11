(function () {
  'use strict';
  let ctx, wallets = [], items = [], selected = '', plan = null, aiConfigured = false, generation = 0, expenseEdit = null, loading = null;
  const el = id => document.getElementById(id);
  const money = n => ctx.formatCurrency(Number(n) || 0);
  const month = () => el('walletMonth').value;
  const wallet = () => wallets.find(w => w.id === selected);
  function message(text, error = false) {
    el('walletStatus').textContent = text;
    if (error) {
      const status = document.querySelector('.wallet-form-dialog[open] [data-wallet-status]');
      if (status) status.textContent = text;
      else ctx.showToast(text, true);
    }
  }
  function openDialog(id) {
    el(id).querySelector('[data-wallet-status]').textContent = '';
    el(id).showModal();
  }
  function openCreate() { openDialog('walletCreateDialog'); }
  function openExpense() {
    if (!wallet()) return openCreate();
    el('walletExpenseContext').textContent = wallet().nome + ' · só você';
    el('walletExpenseDialogTitle').textContent = expenseEdit ? 'Editar gasto pessoal' : 'Novo gasto pessoal';
    openDialog('walletExpenseDialog');
  }
  async function beginExpense() { await load(); clearExpense(); openExpense(); }
  function clearExpense() {
    expenseEdit = null;
    el('walletExpenseForm').reset();
    el('walletExpenseDate').valueAsDate = new Date();
    el('walletExpenseSubmit').textContent = 'Salvar gasto pessoal';
    el('walletExpenseCancel').hidden = true;
  }
  function render() {
    const current = wallet();
    const tiles = el('walletTiles'); tiles.replaceChildren();
    wallets.forEach(item => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'wallet-tile';
      button.classList.toggle('is-selected', item.id === selected); button.setAttribute('aria-pressed', String(item.id === selected));
      const label = document.createElement('span'); label.textContent = 'CARTEIRA PRIVADA';
      const name = document.createElement('strong'); name.textContent = item.nome;
      const limit = document.createElement('small'); limit.textContent = Number(item.limite_mensal) ? 'Limite mensal · ' + money(item.limite_mensal) : 'Seu ritmo, sem limite definido';
      button.append(label, name, limit); button.onclick = () => { selected = item.id; el('walletSelect').value = selected; clearExpense(); loadExpenses(); }; tiles.appendChild(button);
    });
    el('walletEmptyView').hidden = Boolean(wallets.length);
    el('walletCreateToggle').hidden = !wallets.length;
    el('walletSelectedName').textContent = current?.nome || '';
    el('walletSelection').hidden = !current;
    tiles.hidden = wallets.length < 2;
    el('walletSelect').closest('label').hidden = wallets.length < 2;
    el('walletControls').hidden = !current;
    el('walletManageName').value = current?.nome || '';
    el('walletManageLimit').value = current?.limite_mensal || 0;
    el('walletSummary').textContent = plan ? `Gastos: ${money(plan.spent)} · Limite: ${plan.budget ? money(plan.budget) : 'não definido'} · Disponível: ${plan.remaining === null ? 'defina um limite' : money(plan.remaining)}` : '';
    el('walletSpent').textContent = plan ? money(plan.spent) : '—';
    el('walletRemaining').textContent = plan?.remaining != null ? money(plan.remaining) : 'Sem limite';
    el('walletRemaining').classList.toggle('is-negative', Number(plan?.remaining) < 0);
    el('walletDailyValue').textContent = plan?.daily != null ? money(plan.daily) : '—';
    el('walletExpenseCount').textContent = items.length + (items.length === 1 ? ' lançamento neste mês' : ' lançamentos neste mês');
    el('walletBudgetLabel').textContent = plan?.budget ? 'De um limite de ' + money(plan.budget) : 'Defina um limite para acompanhar';
    const percent = plan?.budget ? Math.round(plan.spent / plan.budget * 100) : 0;
    el('walletProgress').value = Math.min(percent, 100);
    el('walletProgress').classList.toggle('is-over', percent > 100);
    el('walletProgressLabel').textContent = plan?.budget ? percent + '% do limite utilizado' : 'Você ainda não definiu um limite mensal';
    el('walletDaily').textContent = plan?.daily !== null && plan?.daily !== undefined ? `${money(plan.daily)} por dia até o fim do mês. Referência de orçamento, não saldo bancário.` : 'O limite diário aparece no mês atual quando há um orçamento definido.';
    const signals = el('walletSignals'); signals.replaceChildren();
    (plan?.signals || []).forEach(signal => {
      const row = document.createElement('p');
      const labels = { over_budget: 'Limite ultrapassado em ', fast_pace: 'Ritmo elevado · referência diária: ', delivery_opportunity: 'Simulação de economia com delivery: ' };
      row.textContent = labels[signal.type] + money(signal.amount) + '. ' + signal.action;
      signals.appendChild(row);
    });
    if (plan && !plan.signals.length) signals.textContent = 'Sem sinais relevantes com os dados disponíveis.';
    el('walletAiButton').disabled = !plan?.signals.length;
    el('walletAiButton').textContent = aiConfigured ? 'Aprofundar com IA' : 'Entender as recomendações';
    el('walletAiStatus').textContent = aiConfigured ? 'Análise automática com explicação opcional por IA. Você decide o próximo passo.' : 'Recomendações automáticas, baseadas nos seus lançamentos.';
    const list = el('walletExpenseList'); list.replaceChildren();
    if (!items.length) { const empty = document.createElement('div'); empty.className = 'vault-expense-empty'; empty.textContent = 'Nenhum gasto pessoal neste mês. Toque em Registrar gasto para começar.'; list.appendChild(empty); }
    items.forEach(item => {
      const row = document.createElement('div'); row.className = 'wallet-expense';
      const copy = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = item.descricao;
      const meta = document.createElement('small'); meta.textContent = item.data.split('-').reverse().join('/') + ' · ' + item.categoria;
      copy.append(title, meta);
      const value = document.createElement('strong'); value.className = 'vault-expense-value'; value.textContent = money(item.valor);
      const actions = document.createElement('div'); actions.className = 'form-actions';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn--ghost btn--compact'; edit.textContent = 'Editar';
      edit.setAttribute('aria-label', 'Editar ' + item.descricao);
      edit.onclick = () => {
        expenseEdit = item.id;
        el('walletExpenseDate').value = item.data; el('walletExpenseValue').value = item.valor;
        el('walletExpenseDescription').value = item.descricao; el('walletExpenseCategory').value = item.categoria;
        el('walletExpenseSubmit').textContent = 'Salvar edição pessoal'; el('walletExpenseCancel').hidden = false;
        openExpense();
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
      actions.append(edit, remove); row.append(copy, value, actions); list.appendChild(row);
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
      items = data.expenses || []; plan = data.plan; aiConfigured = data.aiConfigured === true; render(); message('Visível apenas para você.');
    } catch (e) { if (turn === generation) message(e.message, true); }
  }
  function load() {
    if (loading) return loading;
    loading = loadWallets().finally(() => { loading = null; });
    return loading;
  }
  async function loadWallets() {
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
    el('walletCreateToggle').onclick = openCreate;
    el('walletEmptyCreate').onclick = openCreate;
    el('walletAddExpense').onclick = () => { clearExpense(); openExpense(); };
    el('walletEditLimit').onclick = () => { openDialog('walletSettings'); el('walletManageLimit').focus(); };
    el('walletViewExpenses').onclick = () => { el('walletMovements').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); el('walletMovements').focus({ preventScroll: true }); };
    document.querySelectorAll('[data-wallet-close]').forEach(button => button.onclick = () => el(button.dataset.walletClose).close());
    el('walletExpenseCancel').onclick = clearExpense;
    bindForm('walletCreateForm', async () => {
      const result = await ctx.api.saveWallet({ action: 'add', nome: el('walletName').value.trim(), limiteMensal: Number(el('walletLimit').value) });
      selected = result.wallets[0].id; el('walletCreateForm').reset(); el('walletCreateDialog').close(); await load();
    });
    bindForm('walletManageForm', async () => {
      await ctx.api.saveWallet({ action: 'update', id: selected, nome: el('walletManageName').value.trim(), limiteMensal: Number(el('walletManageLimit').value) }); el('walletSettings').close(); await load();
    });
    el('walletDelete').onclick = async () => {
      const id = selected;
      if (!id) return;
      el('walletSettings').close();
      if (!await ctx.ui.confirmAction({ title: 'Excluir carteira vazia?', message: 'Carteiras com lançamentos precisam ter os gastos removidos antes.', confirmLabel: 'Excluir', danger: true })) {
        openDialog('walletSettings'); el('walletDelete').focus(); return;
      }
      el('walletDelete').disabled = true;
      try { await ctx.api.saveWallet({ action: 'delete', id }); clearExpense(); await load(); }
      catch (e) { message(e.message, true); } finally { el('walletDelete').disabled = false; }
    };
    bindForm('walletExpenseForm', async () => {
      if (!selected) throw new Error('Escolha uma carteira.');
      await ctx.api.saveWalletExpense({ action: expenseEdit ? 'update' : 'add', id: expenseEdit, walletId: selected, dataGasto: el('walletExpenseDate').value,
        valor: Number(el('walletExpenseValue').value), descricao: el('walletExpenseDescription').value.trim(), categoria: el('walletExpenseCategory').value });
      el('walletMonth').value = el('walletExpenseDate').value.slice(0, 7);
      el('walletExpenseDialog').close(); clearExpense(); await loadExpenses();
    });
    el('walletAiButton').onclick = async () => {
      const turn = generation, id = selected, period = month();
      el('walletAiButton').disabled = true;
      el('walletAiStatus').textContent = 'Preparando sua análise…';
      try {
        const data = await ctx.api.explainWallet(id, period);
        if (turn !== generation) return;
        const answer = data.explanation;
        el('walletAiText').textContent = answer.text;
        el('walletAiStatus').textContent = answer.source === 'ai'
          ? 'Explicação por IA · confira as sugestões antes de decidir.'
          : (answer.reason === 'provider_unavailable' ? 'O provedor não respondeu. Confira sua conexão em Ajustes. Mantivemos a recomendação automática.' : answer.reason === 'cooldown' ? 'Aguarde um minuto para pedir outra análise. Esta recomendação foi calculada pelos seus gastos.' : 'Recomendação automática · baseada nos seus lançamentos.');
      } catch (e) { if (turn === generation) message(e.message, true); }
      finally { if (turn === generation) {
        el('walletAiButton').disabled = !plan?.signals.length;
        el('walletAiButton').textContent = aiConfigured ? 'Aprofundar com IA' : 'Entender as recomendações';
      } }
    };
    let loaded = false;
    const maybeLoad = view => { if (view === 'carteiras' && !loaded) { loaded = true; load(); } };
    window.addEventListener('gastos:viewchange', event => { maybeLoad(event.detail.view); if (event.detail.view !== 'carteiras') { el('walletExpenseDialog').close(); el('walletCreateDialog').close(); el('walletSettings').close(); } });
    window.addEventListener('gastos:aichange', () => { if (selected) loadExpenses(); });
    maybeLoad(window.GastosNavigation?.current()); render();
  }
  window.GastosWallets = { init, load, beginExpense };
})();
