const GASTOS_BACKEND_URL = 'https://br-polished-voice-a5flam43-gastospwa.compute.c-1.us-east-2.aws.neon.tech';
const SESSION_TOKEN_KEY = 'gastos_pwa_session_token_v2';
const SESSION_USER_KEY = 'gastos_pwa_session_user_v2';

let authReadyPromise = null;
let currentSession = null;
window.usuarioLogadoNome = null;

function formatarDataBr(dataIso) {
    if (!dataIso) return '';
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function normalizarGasto(row) {
    return {
        id: row.id,
        data: formatarDataBr(row.data),
        descricao: row.descricao,
        valor: Number(row.valor),
        usuario: row.usuario,
        formaPagamento: row.forma_pagamento,
        categoria: row.categoria
    };
}

function lerTokenLocal() {
    return localStorage.getItem(SESSION_TOKEN_KEY);
}

function salvarSessao(token, user) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    currentSession = { token, user };
}

function limparSessaoLocal() {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem('gastos_pwa_session_token');
    localStorage.removeItem('gastos_pwa_session_user');
    localStorage.removeItem('gastos_pwa_session_cookie_name');
    currentSession = null;
    window.usuarioLogadoNome = null;
}

async function backendFetch(path, options = {}, autenticado = true) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');

    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    if (autenticado) {
        const token = lerTokenLocal();
        if (!token) {
            const erro = new Error('Sua sessão expirou. Entre novamente.');
            erro.code = 'AUTH_REQUIRED';
            throw erro;
        }
        headers.set('Authorization', `Bearer ${token}`);
    }

    let response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
        response = await fetch(`${GASTOS_BACKEND_URL}${path}`, {
            ...options,
            headers,
            cache: 'no-store',
            signal: controller.signal
        });
    } catch (cause) {
        const mensagem = cause?.name === 'AbortError'
            ? 'O servidor demorou para responder. Tente novamente.'
            : 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
        const erro = new Error(mensagem);
        erro.cause = cause;
        throw erro;
    } finally {
        clearTimeout(timeoutId);
    }

    const text = await response.text();
    let data = null;
    if (text) {
        try { data = JSON.parse(text); }
        catch { data = { message: text }; }
    }

    if (response.status === 401) {
        limparSessaoLocal();
        authReadyPromise = null;
        const erro = new Error(data?.message || 'Sua sessão expirou. Entre novamente.');
        erro.code = data?.error || 'SESSION_EXPIRED';
        throw erro;
    }

    if (!response.ok) {
        const erro = new Error(data?.message || `Erro ${response.status}`);
        erro.code = data?.error || 'BACKEND_ERROR';
        erro.details = data?.details;
        throw erro;
    }

    if (autenticado && data?.token) {
        localStorage.setItem(SESSION_TOKEN_KEY, data.token);
        if (currentSession) currentSession.token = data.token;
    }

    return data;
}

function aplicarUsuarioNoFormulario(user) {
    const nome = user?.name?.trim();
    if (!nome) return;

    window.usuarioLogadoNome = nome;
    const select = document.getElementById('inputUsuario');
    if (!select) return;

    let option = [...select.options].find(opt => opt.value === nome);
    if (!option) {
        option = document.createElement('option');
        option.value = nome;
        option.textContent = nome;
        select.appendChild(option);
    }

    select.value = nome;
    select.disabled = true;
    select.title = 'O responsável pelo gasto é definido pelo usuário autenticado.';
}

function garantirAuthOverlay() {
    let overlay = document.getElementById('authOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'authOverlay';
    overlay.className = 'fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-7 sm:p-8">
            <div class="text-center mb-6">
                <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-lg shadow-indigo-200">
                    <i class="fa-solid fa-wallet text-2xl"></i>
                </div>
                <h2 id="authTitle" class="text-2xl font-bold text-slate-800">Verificando acesso...</h2>
                <p id="authSubtitle" class="text-sm text-slate-500 mt-1">Aguarde um instante.</p>
            </div>

            <div id="authLoading" class="py-8 flex justify-center">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-indigo-600"></i>
            </div>

            <form id="authForm" class="space-y-4 hidden">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                    <input id="authEmail" type="email" required autocomplete="email" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="voce@email.com">
                </div>

                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                    <div class="relative">
                        <input id="authSenha" type="password" required minlength="8" autocomplete="current-password" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Sua senha">
                        <button id="authMostrarSenha" type="button" class="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-indigo-600 transition" title="Mostrar senha" aria-label="Mostrar senha">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                    </div>
                </div>

                <p id="authErro" class="hidden text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2"></p>
                <button id="authSubmit" type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-indigo-200">Entrar</button>
            </form>

            <p class="text-[11px] text-slate-400 text-center mt-5 leading-relaxed">Acesso restrito aos usuários autorizados da casa.</p>
        </div>`;

    document.body.appendChild(overlay);
    return overlay;
}

function adicionarUsuarioNoHeader(user) {
    aplicarUsuarioNoFormulario(user);

    const existente = document.getElementById('usuarioLogadoWrap');
    if (existente) {
        const texto = existente.querySelector('[data-user-name]');
        if (texto) texto.textContent = user?.name || user?.email || 'Usuário';
        return;
    }

    const alvo = document.querySelector('header .max-w-7xl > div:last-child');
    if (!alvo) return;

    const wrap = document.createElement('div');
    wrap.id = 'usuarioLogadoWrap';
    wrap.className = 'flex items-center gap-2 whitespace-nowrap';
    wrap.innerHTML = `
        <span data-user-name class="hidden md:inline text-xs text-slate-500 max-w-[150px] truncate">${user?.name || user?.email || 'Usuário'}</span>
        <button id="btnLogout" type="button" class="bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 text-sm font-medium px-3 py-2 rounded-lg transition" title="Sair">
            <i class="fa-solid fa-right-from-bracket"></i>
        </button>`;
    alvo.appendChild(wrap);

    document.getElementById('btnLogout').onclick = async () => {
        try {
            if (lerTokenLocal()) {
                await backendFetch('/logout', { method: 'POST', body: '{}' });
            }
        } catch (e) {
            console.warn('Não foi possível encerrar a sessão no servidor:', e);
        } finally {
            limparSessaoLocal();
            location.reload();
        }
    };
}

async function recuperarSessaoSalva() {
    const token = lerTokenLocal();
    if (!token) return null;

    try {
        const data = await backendFetch('/session');
        if (!data?.user) {
            limparSessaoLocal();
            return null;
        }
        const tokenAtualizado = data.token || token;
        salvarSessao(tokenAtualizado, data.user);
        return { token: tokenAtualizado, user: data.user, session: data.session || null };
    } catch (e) {
        console.warn('Sessão salva não pôde ser restaurada:', e);
        limparSessaoLocal();
        return null;
    }
}

async function mostrarLogin(overlay) {
    const loading = overlay.querySelector('#authLoading');
    const form = overlay.querySelector('#authForm');
    const title = overlay.querySelector('#authTitle');
    const subtitle = overlay.querySelector('#authSubtitle');
    const email = overlay.querySelector('#authEmail');
    const senha = overlay.querySelector('#authSenha');
    const mostrarSenha = overlay.querySelector('#authMostrarSenha');
    const erro = overlay.querySelector('#authErro');
    const submit = overlay.querySelector('#authSubmit');

    loading.classList.add('hidden');
    form.classList.remove('hidden');
    title.textContent = 'Entrar no Gastos';
    subtitle.textContent = 'Use seu e-mail e senha para continuar.';

    mostrarSenha.onclick = () => {
        const mostrando = senha.type === 'text';
        senha.type = mostrando ? 'password' : 'text';
        mostrarSenha.innerHTML = `<i class="fa-regular ${mostrando ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
        mostrarSenha.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
        mostrarSenha.title = mostrando ? 'Mostrar senha' : 'Ocultar senha';
    };

    return new Promise(resolve => {
        form.onsubmit = async event => {
            event.preventDefault();
            erro.classList.add('hidden');
            submit.disabled = true;
            submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';

            try {
                const data = await backendFetch('/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: email.value.trim(),
                        password: senha.value
                    })
                }, false);

                if (!data?.token || !data?.user) {
                    throw new Error('O servidor não retornou uma sessão válida.');
                }

                salvarSessao(data.token, data.user);
                overlay.remove();
                adicionarUsuarioNoHeader(data.user);
                resolve({ token: data.token, user: data.user });
            } catch (e) {
                console.error('Erro de autenticação:', e);
                erro.textContent = e.message || 'Não foi possível autenticar.';
                erro.classList.remove('hidden');
            } finally {
                submit.disabled = false;
                submit.textContent = 'Entrar';
            }
        };
    });
}

async function ensureAuthenticated() {
    if (currentSession?.user && lerTokenLocal()) return currentSession;
    if (authReadyPromise) return authReadyPromise;

    authReadyPromise = (async () => {
        const overlay = garantirAuthOverlay();
        const sessao = await recuperarSessaoSalva();

        if (sessao?.user) {
            overlay.remove();
            adicionarUsuarioNoHeader(sessao.user);
            return sessao;
        }

        return mostrarLogin(overlay);
    })();

    try {
        return await authReadyPromise;
    } catch (e) {
        authReadyPromise = null;
        throw e;
    }
}


const api = {
    ready: ensureAuthenticated,

    async getSession() {
        return ensureAuthenticated();
    },

    async health() {
        return backendFetch('/health', {}, false);
    },

    async logout() {
        try {
            if (lerTokenLocal()) await backendFetch('/logout', { method: 'POST', body: '{}' });
        } finally {
            limparSessaoLocal();
            authReadyPromise = null;
        }
        return true;
    },

    async fetchMeses() {
        await ensureAuthenticated();
        const data = await backendFetch('/months');
        if (data?.user) {
            currentSession.user = data.user;
            adicionarUsuarioNoHeader(data.user);
        }
        return data?.months || [];
    },

    async fetchGastosPorMes(mes) {
        await ensureAuthenticated();
        const query = mes ? `?month=${encodeURIComponent(mes)}` : '';
        const data = await backendFetch(`/expenses${query}`);
        return (data?.expenses || []).map(normalizarGasto);
    },


    async fetchOrcamentos(mes) {
        await ensureAuthenticated();
        const data = await backendFetch('/budgets?month=' + encodeURIComponent(mes));
        return data?.budgets || [];
    },

    async salvarOrcamentos(mes, items) {
        await ensureAuthenticated();
        const data = await backendFetch('/budgets', {
            method: 'POST',
            body: JSON.stringify({
                month: mes,
                items: (items || []).map(item => ({
                    categoria: item.categoria,
                    valorLimite: Number(item.valorLimite || 0)
                }))
            })
        });
        return data?.budgets || [];
    },

    async fetchRecorrentes() {
        await ensureAuthenticated();
        const data = await backendFetch('/recurring');
        return data?.recurring || [];
    },

    async salvarRecorrente(payload) {
        await ensureAuthenticated();
        return backendFetch('/recurring', {
            method: 'POST',
            body: JSON.stringify({
                action: payload.id ? 'update' : 'add',
                id: payload.id || null,
                descricao: payload.descricao,
                valor: Number(payload.valor),
                categoria: payload.categoria || 'Outros',
                formaPagamento: payload.formaPagamento || 'Dinheiro',
                diaVencimento: Number(payload.diaVencimento),
                ativo: payload.ativo !== false
            })
        });
    },

    async excluirRecorrente(id) {
        await ensureAuthenticated();
        return backendFetch('/recurring', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id })
        });
    },

    async enviarGasto(payload) {
        await ensureAuthenticated();
        return backendFetch('/expenses', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureAuthenticated().catch(console.error));
} else {
    ensureAuthenticated().catch(console.error);
}
