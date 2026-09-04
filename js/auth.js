(async function () {
    function criarTelaAuth() {
        const overlay = document.createElement('div');
        overlay.id = 'authOverlay';
        overlay.className = 'fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4';
        overlay.innerHTML = `
            <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8">
                <div class="text-center mb-6">
                    <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-lg shadow-indigo-200">
                        <i class="fa-solid fa-wallet text-2xl"></i>
                    </div>
                    <h2 id="authTitle" class="text-2xl font-bold text-slate-800">Entrar no Gastos</h2>
                    <p id="authSubtitle" class="text-sm text-slate-500 mt-1">Acesse com seu e-mail e senha.</p>
                </div>

                <form id="authForm" class="space-y-4">
                    <div id="campoNome" class="hidden">
                        <label class="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                        <input id="authNome" type="text" autocomplete="name" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Seu nome">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                        <input id="authEmail" type="email" required autocomplete="email" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="voce@email.com">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                        <input id="authSenha" type="password" required minlength="8" autocomplete="current-password" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Mínimo 8 caracteres">
                    </div>
                    <p id="authErro" class="hidden text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2"></p>
                    <button id="authSubmit" type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-indigo-200">Entrar</button>
                </form>

                <button id="authToggle" type="button" class="w-full mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700">Criar uma conta</button>
                <p class="text-[11px] text-slate-400 text-center mt-5 leading-relaxed">Sua senha não é salva no código nem em Base64. A autenticação é gerenciada pelo Neon Auth/Better Auth.</p>
            </div>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    async function carregarApp(usuario) {
        const overlay = document.getElementById('authOverlay');
        if (overlay) overlay.remove();

        const headerActions = document.querySelector('header .max-w-7xl > div:last-child');
        if (headerActions && !document.getElementById('btnLogout')) {
            const userWrap = document.createElement('div');
            userWrap.className = 'flex items-center gap-2 whitespace-nowrap';
            userWrap.innerHTML = `
                <span class="hidden md:inline text-xs text-slate-500 max-w-[160px] truncate" title="${usuario?.email || ''}">${usuario?.name || usuario?.email || 'Usuário'}</span>
                <button id="btnLogout" class="bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 text-sm font-medium px-3 py-2 rounded-lg transition" title="Sair">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>`;
            headerActions.appendChild(userWrap);
            document.getElementById('btnLogout').addEventListener('click', async () => {
                await api.logout();
                location.reload();
            });
        }

        if (!document.querySelector('script[data-app-loaded]')) {
            const script = document.createElement('script');
            script.src = `js/app.js?v=${Date.now()}`;
            script.dataset.appLoaded = '1';
            document.body.appendChild(script);
        }
    }

    try {
        const sessao = await api.getSession();
        if (sessao?.session) {
            await carregarApp(sessao.user);
            return;
        }
    } catch (e) {
        console.error('Falha ao verificar sessão:', e);
    }

    const overlay = criarTelaAuth();
    let modoCadastro = false;
    const form = overlay.querySelector('#authForm');
    const campoNome = overlay.querySelector('#campoNome');
    const nome = overlay.querySelector('#authNome');
    const email = overlay.querySelector('#authEmail');
    const senha = overlay.querySelector('#authSenha');
    const erro = overlay.querySelector('#authErro');
    const submit = overlay.querySelector('#authSubmit');
    const toggle = overlay.querySelector('#authToggle');
    const title = overlay.querySelector('#authTitle');
    const subtitle = overlay.querySelector('#authSubtitle');

    function renderModo() {
        campoNome.classList.toggle('hidden', !modoCadastro);
        nome.required = modoCadastro;
        senha.autocomplete = modoCadastro ? 'new-password' : 'current-password';
        title.textContent = modoCadastro ? 'Criar conta' : 'Entrar no Gastos';
        subtitle.textContent = modoCadastro ? 'Cadastre seu acesso ao sistema.' : 'Acesse com seu e-mail e senha.';
        submit.textContent = modoCadastro ? 'Criar conta e entrar' : 'Entrar';
        toggle.textContent = modoCadastro ? 'Já tenho uma conta' : 'Criar uma conta';
        erro.classList.add('hidden');
    }

    toggle.addEventListener('click', () => {
        modoCadastro = !modoCadastro;
        renderModo();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        erro.classList.add('hidden');
        submit.disabled = true;
        submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aguarde...';
        try {
            let data;
            if (modoCadastro) {
                data = await api.cadastrar(nome.value.trim(), email.value.trim(), senha.value);
            } else {
                data = await api.login(email.value.trim(), senha.value);
            }
            const sessao = await api.getSession();
            await carregarApp(sessao?.user || data?.user);
        } catch (e) {
            console.error('Erro de autenticação:', e);
            erro.textContent = e.message || 'Não foi possível autenticar.';
            erro.classList.remove('hidden');
        } finally {
            submit.disabled = false;
            renderModo();
        }
    });
})();