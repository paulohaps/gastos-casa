(function () {
  'use strict';

  const VIEWS = {
    resumo: {
      title: 'Resumo',
      description: 'Visão rápida do mês, divisão, orçamento e sinais importantes.'
    },
    lancar: {
      title: 'Lançar gasto',
      description: 'Registre uma despesa por voz, texto inteligente ou preenchimento manual.'
    },
    movimentacoes: {
      title: 'Movimentações',
      description: 'Consulte, filtre, edite e revise os lançamentos do mês.'
    },
    mais: {
      title: 'Mais',
      description: 'Gerencie recorrentes, orçamento, usuários e aprendizado do aplicativo.'
    }
  };

  let activeView = 'resumo';

  function assignSections() {
    const main = document.querySelector('main.page');
    if (!main) return;

    main.querySelector('.page-heading')?.setAttribute('data-app-section', 'resumo');
    main.querySelector('.metric-grid')?.setAttribute('data-app-section', 'resumo');
    main.querySelector('.overview-grid')?.setAttribute('data-app-section', 'resumo');
    document.getElementById('radar-financeiro')?.setAttribute('data-app-section', 'resumo');

    const workspace = document.getElementById('lancamentos');
    workspace?.setAttribute('data-app-container', 'workspace');

    const sidebar = workspace?.querySelector('.workspace-sidebar');
    const sidebarCards = sidebar ? Array.from(sidebar.children) : [];
    if (sidebarCards[0]) sidebarCards[0].setAttribute('data-app-section', 'lancar');
    if (sidebarCards[1]) sidebarCards[1].setAttribute('data-app-section', 'lancar');
    document.getElementById('recorrentes')?.setAttribute('data-app-section', 'mais');

    workspace?.querySelector('.history-card')?.setAttribute('data-app-section', 'movimentacoes');
    document.getElementById('orcamentoPanel')?.setAttribute('data-app-section', 'mais');
    document.getElementById('configuracoes')?.setAttribute('data-app-section', 'mais');
  }

  function resolveView(hash) {
    const requested = String(hash || '').replace(/^#/, '').toLowerCase();
    if (VIEWS[requested]) return requested;

    const legacy = {
      'visao-geral': 'resumo',
      'lancamentos': 'lancar',
      'recorrentes': 'mais',
      'configuracoes': 'mais',
      'orcamentoPanel': 'mais'
    };
    return legacy[requested] || 'resumo';
  }

  function updateHeader(view) {
    const header = document.getElementById('appViewHeader');
    const eyebrow = document.getElementById('appViewEyebrow');
    const title = document.getElementById('appViewTitle');
    const description = document.getElementById('appViewDescription');
    if (!header || !title || !description) return;

    const config = VIEWS[view];
    header.classList.toggle('hidden', view === 'resumo');
    if (eyebrow) eyebrow.textContent = view === 'mais' ? 'Configurações e automações' : 'Gastos Casa';
    title.textContent = config.title;
    description.textContent = config.description;
  }

  function updateNavigation(view) {
    document.querySelectorAll('[data-app-nav]').forEach(link => {
      const selected = link.getAttribute('data-app-nav') === view;
      link.classList.toggle('is-active', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function updateWorkspace(view) {
    const workspace = document.querySelector('[data-app-container="workspace"]');
    if (!workspace) return;

    workspace.classList.toggle('app-workspace-hidden', view === 'resumo');

    const sidebar = workspace.querySelector('.workspace-sidebar');
    if (sidebar) {
      const visibleCards = Array.from(sidebar.children).filter(child =>
        child.getAttribute('data-app-section') === view
      );
      sidebar.classList.toggle('app-column-hidden', visibleCards.length === 0);
    }

    const history = workspace.querySelector('.history-card');
    if (history) {
      workspace.classList.toggle('workspace-grid--single', view !== 'lancar');
    }
  }

  function showView(view, options) {
    options = options || {};
    activeView = VIEWS[view] ? view : 'resumo';
    document.body.dataset.appView = activeView;

    document.querySelectorAll('[data-app-section]').forEach(section => {
      section.classList.toggle('app-section-hidden', section.getAttribute('data-app-section') !== activeView);
    });

    updateWorkspace(activeView);
    updateHeader(activeView);
    updateNavigation(activeView);

    if (!options.skipHash) {
      const target = '#' + activeView;
      if (location.hash !== target) history.replaceState(null, '', target);
    }

    if (!options.preserveScroll) {
      window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
    }

    window.dispatchEvent(new CustomEvent('gastos:viewchange', { detail: { view: activeView } }));
  }

  function handleNavigation(event) {
    const link = event.target.closest('[data-app-nav]');
    if (!link) return;
    event.preventDefault();
    showView(link.getAttribute('data-app-nav'));
  }

  function init() {
    assignSections();
    document.addEventListener('click', handleNavigation);
    window.addEventListener('hashchange', () => showView(resolveView(location.hash), {
      skipHash: true,
      instant: true
    }));

    showView(resolveView(location.hash), {
      skipHash: false,
      preserveScroll: true,
      instant: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.GastosNavigation = {
    show: showView,
    current: () => activeView
  };
})();