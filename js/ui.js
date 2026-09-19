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
      loading: ['Sincronizando', '#d97706', '#fffbeb', '#fde68a', true],
      online: ['Conectado', '#059669', '#ecfdf5', '#a7f3d0', false],
      error: ['Atenção', '#dc2626', '#fef2f2', '#fecaca', false]
    }[state] || ['Status', '#64748b', '#f8fafc', '#e2e8f0', false];

    el.style.color = config[1];
    el.style.background = config[2];
    el.style.borderColor = config[3];
    el.innerHTML = '<span style="width:7px;height:7px;border-radius:999px;background:currentColor;display:inline-block;' +
      (config[4] ? 'animation:pulse 1s infinite;' : '') + '"></span>' + config[0];
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

  function enhanceNavigation() {
    const links = [...document.querySelectorAll('.nav-link, .mobile-nav a')];
    links.forEach(link => link.addEventListener('click', () => {
      links.forEach(item => item.removeAttribute('aria-current'));
      link.setAttribute('aria-current', 'page');
    }));
  }

  document.addEventListener('DOMContentLoaded', enhanceNavigation);

  return { toast, setConnectionStatus, confirmAction };
})();
window.AppUI = AppUI;
