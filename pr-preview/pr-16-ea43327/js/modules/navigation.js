(function () {
  'use strict';
  const VIEWS = {
    resumo: { title: 'Início', eyebrow: 'Seu espaço', description: 'Uma visão conectada das suas finanças.' },
    casa: { title: 'Sua casa, em sintonia.', eyebrow: 'Espaço compartilhado', description: 'Despesas, divisão e planejamento. Tudo o que vocês organizam juntos.' },
    carteiras: { title: 'Seu dinheiro. Seu espaço.', eyebrow: 'Carteiras pessoais', description: 'Organize seus gastos e limites em carteiras privadas. Só você tem acesso.' },
    assistente: { title: 'Assistente', eyebrow: 'Inteligência financeira', description: 'Análises com evidências e recomendações para agir.' },
    ajustes: { title: 'Tudo do seu jeito.', eyebrow: 'Ajustes', description: 'Gerencie os membros da casa e o aprendizado dos lançamentos.' },
    lancar: { title: 'Um novo gasto na casa.', eyebrow: 'Lançamento compartilhado', description: 'Use texto, voz ou comprovante. Confira os campos antes de confirmar.' }
  };
  const LEGACY = { 'visao-geral': 'resumo', lancamentos: 'lancar', movimentacoes: 'casa', mais: 'ajustes', configuracoes: 'ajustes', recorrentes: 'casa', orcamentopanel: 'casa' };
  let activeView = 'resumo', houseTab = 'visao';
  function resolveView(value) {
    const key = String(value || '').replace(/^#/, '').toLowerCase();
    return VIEWS[key] ? key : (LEGACY[key] || 'resumo');
  }
  function applyHouseTab() {
    document.querySelectorAll('[data-house-section]').forEach(section => section.classList.toggle('house-section-hidden', section.dataset.houseSection !== houseTab));
    document.querySelectorAll('[data-house-tab]').forEach(button => {
      const active = button.dataset.houseTab === houseTab;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
  }
  function showView(view, options = {}) {
    const requested = String(view || '').replace(/^#/, '').toLowerCase();
    activeView = resolveView(requested);
    if (requested === 'movimentacoes') houseTab = 'despesas';
    if (requested === 'recorrentes' || requested === 'orcamentopanel') houseTab = 'planejamento';
    document.body.dataset.appView = activeView;
    document.querySelectorAll('[data-app-section]').forEach(section => {
      if (section.id === 'appViewHeader') return;
      section.classList.toggle('app-section-hidden', section.dataset.appSection !== activeView);
    });
    const config = VIEWS[activeView];
    const header = document.getElementById('appViewHeader');
    header?.classList.toggle('hidden', activeView === 'resumo' || activeView === 'assistente');
    document.getElementById('appViewTitle').textContent = config.title;
    document.getElementById('appViewDescription').textContent = config.description;
    document.getElementById('appViewEyebrow').textContent = config.eyebrow;
    document.getElementById('topbarTitle').textContent = activeView === 'casa' ? 'Casa' : activeView === 'carteiras' ? 'Carteiras' : activeView === 'ajustes' ? 'Ajustes' : activeView === 'lancar' ? 'Novo gasto' : config.title;
    document.querySelectorAll('[data-app-nav]').forEach(link => {
      const active = link.dataset.appNav === activeView || (activeView === 'lancar' && link.dataset.appNav === 'casa');
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    document.getElementById('lancamentos')?.classList.toggle('app-workspace-hidden', activeView !== 'lancar');
    document.querySelector('.month-picker')?.classList.toggle('hidden', ['carteiras', 'ajustes'].includes(activeView));
    document.querySelector('.header-actions .btn--secondary')?.classList.toggle('hidden', !['resumo', 'casa'].includes(activeView));
    applyHouseTab();
    if (!options.skipHash && location.hash !== '#' + activeView) history.replaceState(null, '', '#' + activeView);
    if (!options.preserveScroll) window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
    window.dispatchEvent(new CustomEvent('gastos:viewchange', { detail: { view: activeView, houseTab } }));
  }
  function showHouse(tab = 'visao', options = {}) {
    houseTab = ['visao', 'despesas', 'acertos', 'planejamento'].includes(tab) ? tab : 'visao';
    showView('casa', options);
  }
  function showAndReveal(view, selector, options = {}) {
    if (selector === '#orcamentoPanel' || selector === '#recorrentes') { houseTab = 'planejamento'; view = 'casa'; }
    if (selector === '.history-card' || selector === '#tabelaHistorico') { houseTab = 'despesas'; view = 'casa'; }
    showView(view, { preserveScroll: true, ...options });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = selector ? document.querySelector(selector) : null;
      target?.scrollIntoView({ behavior: options.instant ? 'auto' : 'smooth', block: options.block || 'start' });
      if (options.focusSelector && !window.matchMedia('(max-width: 900px)').matches) document.querySelector(options.focusSelector)?.focus({ preventScroll: true });
    }));
  }
  function init() {
    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-house-tab]');
      if (tab) { showHouse(tab.dataset.houseTab, { preserveScroll: true }); return; }
      const link = event.target.closest('[data-app-nav]');
      if (!link) return;
      event.preventDefault();
      if (link.dataset.houseLink) showHouse(link.dataset.houseLink);
      else showView(link.dataset.appNav);
    });
    window.addEventListener('hashchange', () => showView(location.hash, { skipHash: true, instant: true }));
    showView(location.hash, { preserveScroll: true, instant: true });
  }
  window.GastosNavigation = { show: showView, showHouse, showAndReveal, current: () => activeView, houseTab: () => houseTab };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
