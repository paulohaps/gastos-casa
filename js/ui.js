const AppUI = (() => {
  let toastTimer = null;

  function toast(message, type = 'success') {
    const toastEl = document.getElementById('toast');
    const msgEl = document.getElementById('toastMsg');
    if (!toastEl || !msgEl) return;

    const icon = toastEl.querySelector('i');
    msgEl.textContent = message;
    toastEl.classList.toggle('toast--error', type === 'error');
    if (icon) icon.className = type === 'error' ? 'fa-solid fa-circle-xmark' : 'fa-solid fa-circle-check';

    toastEl.classList.add('toast--visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('toast--visible'), 3200);
  }

  function setConnectionStatus(state) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;
    el.classList.remove('hidden');

    const config = {
      loading: ['Sincronizando', 'status-pill--loading'],
      online: ['Conectado', 'status-pill--online'],
      error: ['Atenção', 'status-pill--error']
    }[state] || ['Status', ''];

    el.className = 'status-pill ' + config[1];
    el.innerHTML = '<span class="status-pill__dot"></span>' + config[0];
  }

  function confirmAction({
    title = 'Confirmar ação',
    message = 'Tem certeza?',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar'
  } = {}) {
    const backdrop = document.getElementById('confirmDialog');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const accept = document.getElementById('confirmAccept');
    const cancel = document.getElementById('confirmCancel');

    if (!backdrop || !titleEl || !messageEl || !accept || !cancel) {
      return Promise.resolve(window.confirm(message));
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    accept.textContent = confirmLabel;
    cancel.textContent = cancelLabel;
    backdrop.classList.remove('hidden');

    return new Promise(resolve => {
      const finish = value => {
        backdrop.classList.add('hidden');
        accept.onclick = null;
        cancel.onclick = null;
        backdrop.onclick = null;
        document.removeEventListener('keydown', onKeydown);
        resolve(value);
      };
      const onKeydown = event => {
        if (event.key === 'Escape') finish(false);
      };

      accept.onclick = () => finish(true);
      cancel.onclick = () => finish(false);
      backdrop.onclick = event => {
        if (event.target === backdrop) finish(false);
      };
      document.addEventListener('keydown', onKeydown);
      setTimeout(() => cancel.focus(), 0);
    });
  }

  function clearModuleErrors() {
    document.querySelectorAll('[data-module-error]').forEach(el => {
      el.innerHTML = '';
      el.classList.add('hidden');
    });
  }

  function setModuleError(key, message, retry) {
    const el = document.querySelector('[data-module-error="' + key + '"]');
    if (!el) return;
    el.classList.remove('hidden');
    el.innerHTML = '<span>' + String(message || 'Não foi possível carregar este módulo.') + '</span>' +
      '<button type="button">Tentar novamente</button>';
    const btn = el.querySelector('button');
    if (btn && typeof retry === 'function') btn.onclick = retry;
  }

  function showVersionNotice(registration) {
    if (!registration?.waiting || document.querySelector('.version-notice')) return;
    const el = document.createElement('div');
    el.className = 'version-notice';
    el.innerHTML = '<span>Nova versão disponível.</span><button type="button" class="btn btn--tertiary btn--compact">Atualizar</button>';
    el.querySelector('button').onclick = () => {
      registration.waiting.postMessage('SKIP_WAITING');
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    };
    document.body.appendChild(el);
  }

  function monitorServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(registration => {
      showVersionNotice(registration);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showVersionNotice(registration);
        });
      });
    }).catch(() => {});
  }

  function enhanceNavigation() {
    const links = [...document.querySelectorAll('.nav-link, .mobile-nav a')];
    links.forEach(link => link.addEventListener('click', () => {
      links.forEach(item => item.removeAttribute('aria-current'));
      link.setAttribute('aria-current', 'page');
    }));
  }

  document.addEventListener('DOMContentLoaded', () => { enhanceNavigation(); monitorServiceWorker(); });

  return { toast, setConnectionStatus, confirmAction, clearModuleErrors, setModuleError };
})();
window.AppUI = AppUI;
