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

  const modalOpeners = new WeakMap();
  function modalElement(target) {
    return typeof target === 'string' ? document.getElementById(target) : target;
  }
  function syncModalLock() {
    document.body.classList.toggle('dialog-open', Boolean(document.querySelector('dialog[open]')));
  }
  function initModal(dialog) {
    if (!dialog || dialog.dataset.modalBound) return;
    dialog.dataset.modalBound = 'true';
    dialog.addEventListener('cancel', event => {
      if (dialog.getAttribute('aria-busy') === 'true') event.preventDefault();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    dialog.addEventListener('click', event => {
      if (dialog.dataset.backdropClose !== 'true' || event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(dialog);
    });
    dialog.addEventListener('close', () => {
      syncModalLock();
      if (dialog.open) return;
      const opener = modalOpeners.get(dialog);
      if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true });
    });
  }
  function openModal(target, focusSelector) {
    const dialog = modalElement(target);
    if (!dialog || dialog.open) return;
    initModal(dialog);
    modalOpeners.set(dialog, document.activeElement);
    dialog.showModal();
    syncModalLock();
    if (focusSelector) dialog.querySelector(focusSelector)?.focus({ preventScroll: true });
  }
  function closeModal(target) {
    const dialog = modalElement(target);
    if (dialog?.open && dialog.getAttribute('aria-busy') !== 'true') dialog.close();
    syncModalLock();
  }
  function setModalBusy(target, busy) {
    const dialog = modalElement(target);
    if (!dialog) return;
    dialog.setAttribute('aria-busy', String(busy));
    dialog.querySelectorAll('[data-modal-close], [data-wallet-close], .modal-close, #settlementCancel').forEach(button => { button.disabled = busy; });
  }
  function confirmAction({ title = 'Confirmar ação', message = 'Tem certeza?', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'danger' } = {}) {
    const dialog = document.getElementById('confirmDialog');
    if (!dialog) return Promise.resolve(window.confirm(message));
    if (activeDialogClose) activeDialogClose(false);
    const accept = document.getElementById('confirmAccept');
    const cancel = document.getElementById('confirmCancel');
    const safeVariant = ['danger', 'primary', 'warning'].includes(variant) ? variant : 'danger';
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    accept.textContent = confirmLabel;
    accept.className = 'btn ' + (safeVariant === 'danger' ? 'btn--danger' : 'btn--primary');
    cancel.textContent = cancelLabel;
    dialog.dataset.variant = safeVariant;
    openModal(dialog, '#confirmCancel');
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        dialog.removeEventListener('close', onClose);
        accept.onclick = cancel.onclick = null;
        activeDialogClose = null;
        closeModal(dialog);
        resolve(value);
      };
      const onClose = () => { if (!dialog.open) finish(false); };
      dialog.addEventListener('close', onClose);
      accept.onclick = () => finish(true);
      cancel.onclick = () => finish(false);
      activeDialogClose = finish;
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

  document.addEventListener('DOMContentLoaded', () => {
    enhanceNavigation(); monitorServiceWorker();
    document.querySelectorAll('dialog.app-modal').forEach(initModal);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.querySelector('dialog[open][aria-busy="true"]')) {
        event.preventDefault(); event.stopPropagation();
      }
    }, true);
    document.addEventListener('click', event => {
      const close = event.target.closest('[data-modal-close]');
      if (close) closeModal(close.dataset.modalClose);
    });
  });

  return { toast, setConnectionStatus, confirmAction, openModal, closeModal, setModalBusy, clearModuleErrors, setModuleError };
})();
window.AppUI = AppUI;
