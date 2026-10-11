const AppUI = (() => {
  let toastTimer = null;
  let activeDialogClose = null;

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
    cancelLabel = 'Cancelar',
    variant = 'danger'
  } = {}) {
    const backdrop = document.getElementById('confirmDialog');
    const dialog = backdrop?.querySelector('.dialog');
    const iconWrap = backdrop?.querySelector('.dialog__icon');
    const icon = iconWrap?.querySelector('i');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const accept = document.getElementById('confirmAccept');
    const cancel = document.getElementById('confirmCancel');

    if (!backdrop || !dialog || !titleEl || !messageEl || !accept || !cancel) {
      return Promise.resolve(window.confirm(message));
    }

    if (typeof activeDialogClose === 'function') activeDialogClose(false);

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const safeVariant = ['danger','primary','warning'].includes(variant) ? variant : 'danger';
    const variantConfig = {
      danger: { button: 'btn--danger', icon: 'fa-triangle-exclamation' },
      primary: { button: 'btn--primary', icon: 'fa-circle-question' },
      warning: { button: 'btn--tertiary', icon: 'fa-circle-exclamation' }
    }[safeVariant];

    titleEl.textContent = title;
    messageEl.textContent = message;
    accept.textContent = confirmLabel;
    cancel.textContent = cancelLabel;
    accept.className = 'btn ' + variantConfig.button;
    if (icon) icon.className = 'fa-solid ' + variantConfig.icon;
    dialog.dataset.variant = safeVariant;
    backdrop.classList.remove('hidden');
    document.body.classList.add('dialog-open');

    return new Promise(resolve => {
      let settled = false;
      const focusable = () => [...dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter(el => el.offsetParent !== null);

      const finish = value => {
        if (settled) return;
        settled = true;
        backdrop.classList.add('hidden');
        document.body.classList.remove('dialog-open');
        accept.onclick = null;
        cancel.onclick = null;
        backdrop.onclick = null;
        document.removeEventListener('keydown', onKeydown);
        activeDialogClose = null;
        if (previousFocus?.isConnected) {
          requestAnimationFrame(() => previousFocus.focus({ preventScroll: true }));
        }
        resolve(value);
      };

      const onKeydown = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
          return;
        }
        if (event.key !== 'Tab') return;
        const items = focusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };

      activeDialogClose = finish;
      accept.onclick = () => finish(true);
      cancel.onclick = () => finish(false);
      backdrop.onclick = event => {
        if (event.target === backdrop) finish(false);
      };
      document.addEventListener('keydown', onKeydown);
      requestAnimationFrame(() => cancel.focus({ preventScroll: true }));
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
    el.replaceChildren();
    const text = document.createElement('span');
    text.textContent = String(message || 'Não foi possível carregar este módulo.');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Tentar novamente';
    if (typeof retry === 'function') btn.onclick = retry;
    el.append(text, btn);
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
