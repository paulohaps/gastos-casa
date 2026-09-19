(function () {
  'use strict';

  let ctx = null;
  let items = [];

  function init(options) {
    ctx = options;
    bindForm();
  }

  function toggleForm(forceOpen) {
    const form = document.getElementById('formMembro');
    if (!form) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : form.classList.contains('hidden');
    form.classList.toggle('hidden', !shouldOpen);
    if (shouldOpen) setTimeout(() => document.getElementById('membroNome')?.focus({ preventScroll: true }), 0);
    else form.reset();
  }

  async function load() {
    const lista = document.getElementById('listaMembros');
    if (!lista) return;
    try {
      items = await ctx.api.fetchMembros();
      render();
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      lista.replaceChildren();
      const box = document.createElement('div');
      box.className = 'module-error';
      const span = document.createElement('span');
      span.textContent = error?.message || 'Não foi possível carregar os usuários.';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Tentar novamente';
      button.onclick = load;
      box.append(span, button);
      lista.appendChild(box);
    }
  }

  function render() {
    const lista = document.getElementById('listaMembros');
    if (!lista) return;
    if (!items.length) {
      lista.innerHTML = '<div class="recurring-empty"><i class="fa-solid fa-users"></i><span>Nenhum usuário autorizado encontrado.</span></div>';
      return;
    }

    lista.innerHTML = '';
    items.forEach(membro => {
      const item = document.createElement('div');
      item.className = 'member-item';
      item.innerHTML =
        '<span class="member-avatar"><i class="fa-solid fa-user"></i></span>' +
        '<div class="member-item__content">' +
          '<strong>' + ctx.escapeHTML(membro.nome || 'Usuário') + '</strong>' +
          '<span>' + ctx.escapeHTML(membro.email || 'E-mail não informado') + '</span>' +
        '</div>' +
        '<span class="status-badge ' + (membro.ativo === false ? 'status-badge--warning' : 'status-badge--success') + '">' +
          (membro.ativo === false ? 'Inativo' : 'Ativo') +
        '</span>';
      lista.appendChild(item);
    });
  }

  function bindForm() {
    const form = document.getElementById('formMembro');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const payload = {
        name: document.getElementById('membroNome').value.trim(),
        email: document.getElementById('membroEmail').value.trim(),
        password: document.getElementById('membroSenha').value
      };
      const submit = form.querySelector('button[type="submit"]');
      const original = submit.innerHTML;
      submit.disabled = true;
      submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando...';
      try {
        await ctx.api.adicionarMembro(payload);
        form.reset();
        form.classList.add('hidden');
        await load();
        ctx.showToast('Usuário cadastrado e autorizado!');
      } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        ctx.showToast(error?.message || 'Erro ao cadastrar usuário.', true);
      } finally {
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });
  }

  window.GastosMembers = { init, load, render, toggleForm };
  window.carregarMembros = load;
  window.toggleMembroForm = toggleForm;
})();
