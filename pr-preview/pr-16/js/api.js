const GASTOS_BACKEND_URL = 'https://br-lucky-firefly-a50tfkjv-gastospwa.compute.c-1.us-east-2.aws.neon.tech';
const SESSION_TOKEN_KEY = 'gastos_pwa_session_token_v2';
const SESSION_USER_KEY = 'gastos_pwa_session_user_v2';

let authReadyPromise = null;
let currentSession = null;
let sessionGeneration = 0;
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

function normalizarAcerto(row) {
    return {
        id: row.id,
        competencia: row.competencia,
        dataPagamento: formatarDataBr(row.data_pagamento),
        pagador: row.pagador,
        recebedor: row.recebedor,
        formaPagamento: row.forma_pagamento,
        valor: Number(row.valor),
        observacao: row.observacao || ''
    };
}

function lerTokenLocal() {
    return localStorage.getItem(SESSION_TOKEN_KEY);
}

function salvarSessao(token, user) {
    sessionGeneration += 1;
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    currentSession = { token, user };
}

function limparSessaoLocal() {
    sessionGeneration += 1;
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem('gastos_pwa_session_token');
    localStorage.removeItem('gastos_pwa_session_user');
    localStorage.removeItem('gastos_pwa_session_cookie_name');
    currentSession = null;
    window.usuarioLogadoNome = null;
    if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent('gastos:sessioncleared'));
}

function handleSessionError(error, generation, path) {
    if (generation !== sessionGeneration || ![401, 403].includes(error.status)) return;
    limparSessaoLocal();
    // Session restoration already owns the login promise; keep its callers together.
    if (path !== '/session') {
        authReadyPromise = null;
        queueMicrotask(() => ensureAuthenticated().catch(console.error));
    }
}

async function backendFetch(path, options = {}, autenticado = true) {
    const generation = sessionGeneration;
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

    let data;
    try {
        data = await window.GastosHttp.requestJson(`${GASTOS_BACKEND_URL}${path}`, {
            ...options, headers, cache: 'no-store'
        });
    } catch (error) {
        if (autenticado) handleSessionError(error, generation, path);
        throw error;
    }
    window.GastosApiContracts.envelope(data);
    if (autenticado && generation === sessionGeneration && lerTokenLocal() && !options.signal?.aborted && data?.token) {
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
    const badge = document.getElementById('usuarioAtualBadge');
    if (badge) badge.textContent = nome;
}

function garantirAuthOverlay() {
    let overlay = document.getElementById('authDialog');
    if (overlay) return overlay;

    overlay = document.createElement('dialog');
    overlay.id = 'authDialog';
    overlay.className = 'auth-dialog';
    overlay.setAttribute('aria-labelledby', 'authTitle');
    overlay.setAttribute('aria-describedby', 'authSubtitle');
    overlay.addEventListener('cancel', event => event.preventDefault());
    overlay.innerHTML = `
        <div id="authOverlay"><div class="auth-card">
            <div class="auth-brand">
                <span class="brand__mark auth-brand__mark"><i class="fa-solid fa-wallet"></i></span>
                <div>
                    <p class="eyebrow">Acesso seguro</p>
                    <h2 id="authTitle">Verificando acesso...</h2>
                    <p id="authSubtitle">Aguarde um instante.</p>
                </div>
            </div>

            <div id="authLoading" class="auth-loading"><span class="spinner"></span><span>Validando sessão...</span></div>

            <div id="authConnectionError" class="hidden" role="alert">
                <p id="authConnectionMessage"></p>
                <button id="authRetry" type="button" class="btn btn--primary">Tentar novamente</button>
            </div>
            <form id="authForm" class="form-stack hidden">
                <label class="field">
                    <span>E-mail</span>
                    <input id="authEmail" type="email" required autocomplete="email" placeholder="voce@email.com">
                </label>
                <label class="field">
                    <span>Senha</span>
                    <div class="password-field">
                        <input id="authSenha" type="password" required minlength="8" autocomplete="current-password" placeholder="Sua senha">
                        <button id="authMostrarSenha" type="button" class="icon-btn" title="Mostrar senha" aria-label="Mostrar senha"><i class="fa-regular fa-eye"></i></button>
                    </div>
                </label>
                <p id="authErro" class="form-error hidden" role="alert"></p>
                <button id="authSubmit" type="submit" class="btn btn--primary btn--block">Entrar</button>
            </form>

            <p class="auth-footnote">Acesso restrito aos usuários autorizados da casa.</p>
        </div></div>`;

    document.body.appendChild(overlay);
    window.AppUI.openModal(overlay);
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

    const alvo = document.querySelector('.header-actions');
    if (!alvo) return;

    const wrap = document.createElement('div');
    wrap.id = 'usuarioLogadoWrap';
    wrap.className = 'user-menu';
    wrap.innerHTML = `
        <span data-user-name class="user-menu__name"></span>
        <button id="btnLogout" type="button" class="icon-btn user-menu__logout" aria-label="Sair" title="Sair">
            <svg class="ui-icon" aria-hidden="true"><use href="#i-exit"></use></svg><span>Sair</span>
        </button>`;
    wrap.querySelector('[data-user-name]').textContent = user?.name || user?.email || 'Usuário';
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
            throw new Error('Não foi possível validar a resposta da sessão. Tente novamente.');
        }
        const tokenAtualizado = data.token || token;
        window.GastosApiContracts.user(data.user);
        salvarSessao(tokenAtualizado, data.user);
        return { token: tokenAtualizado, user: data.user, session: data.session || null };
    } catch (e) {
        console.warn('Sessão salva não pôde ser restaurada:', e);
        if ([401, 403].includes(e.status)) return null;
        throw e;
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
    email.focus();

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

                window.GastosApiContracts.user(data.user);
                salvarSessao(data.token, data.user);
                window.AppUI.closeModal(overlay);
                overlay.remove();
                window.dispatchEvent(new CustomEvent('gastos:authenticated'));
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
        let sessao;
        while (true) {
            try { sessao = await recuperarSessaoSalva(); break; }
            catch (error) {
                overlay.querySelector('#authLoading').classList.add('hidden');
                overlay.querySelector('#authConnectionError').classList.remove('hidden');
                overlay.querySelector('#authConnectionMessage').textContent = error.message;
                const retry = overlay.querySelector('#authRetry');
                retry.disabled = false;
                retry.focus();
                await new Promise(resolve => { retry.onclick = resolve; });
                retry.onclick = null;
                retry.disabled = true;
                overlay.querySelector('#authConnectionError').classList.add('hidden');
                overlay.querySelector('#authLoading').classList.remove('hidden');
            }
        }

        if (sessao?.user) {
            window.AppUI.closeModal(overlay);
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
    async fetchConversation(context, options = {}) {
        await ensureAuthenticated();
        return backendFetch('/assistant/conversation?' + new URLSearchParams(context), options);
    },
    async deleteConversation(context, conversation, options = {}) {
        await ensureAuthenticated();
        return backendFetch('/assistant/conversation?' + new URLSearchParams(context), { ...options, method: 'DELETE', body: JSON.stringify(conversation) });
    },
    async streamAssistant(payload, { signal, onEvent }) {
        await ensureAuthenticated();
        signal?.throwIfAborted();
        const generation = sessionGeneration;
        const controller = new AbortController();
        const cancel = () => controller.abort(signal.reason);
        signal?.addEventListener('abort', cancel, { once: true });
        const timer = setTimeout(() => controller.abort(new Error('A resposta demorou demais. Tente novamente.')), 55000);
        let completed = false;
        try {
            const response = await fetch(GASTOS_BACKEND_URL + '/assistant/chat', {
                method: 'POST', cache: 'no-store', signal: controller.signal,
                headers: { authorization: 'Bearer ' + lerTokenLocal(), 'content-type': 'application/json', accept: 'text/event-stream' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                const error = new Error(data.message || 'Não foi possível conversar. Tente novamente.');
                error.status = response.status; error.code = data.code || data.error;
                throw error;
            }
            if (!response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('O servidor não retornou uma conversa válida.');
            await window.GastosEventStream.consume(response, event => {
                if (generation !== sessionGeneration || !lerTokenLocal()) throw new DOMException('Sessão alterada.', 'AbortError');
                if (event.type === 'error') { const error = new Error(event.message || 'A IA não respondeu.'); error.code = event.code; throw error; }
                if (!['start', 'text', 'end'].includes(event.type) || (event.type === 'text' && typeof event.text !== 'string')) throw new Error('Resposta de conversa inválida.');
                if (event.type === 'end') {
                    completed = true;
                    if (typeof event.token === 'string' && event.token) {
                        localStorage.setItem(SESSION_TOKEN_KEY, event.token);
                        if (currentSession) currentSession.token = event.token;
                    }
                }
                onEvent(event);
            }, controller.signal);
            if (!completed) throw new Error('A conexão foi interrompida. Tente novamente.');
        } catch (error) {
            handleSessionError(error, generation, '/assistant/chat');
            if (controller.signal.aborted) throw controller.signal.reason;
            if (error instanceof TypeError) throw new Error('Sem conexão. Verifique sua internet e tente novamente.');
            throw error;
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
        }
    },
    async fetchAiSettings() { await ensureAuthenticated(); return backendFetch('/ai/settings'); },
    async saveAiSettings(payload) { await ensureAuthenticated(); return backendFetch('/ai/settings', { method: 'POST', body: JSON.stringify(payload) }); },
    async fetchWallets(options = {}) {
        await ensureAuthenticated();
        return window.GastosApiContracts.arrayField(await backendFetch('/wallets', options), 'wallets');
    },
    async saveWallet(payload) {
        await ensureAuthenticated();
        return backendFetch('/wallets', { method: 'POST', body: JSON.stringify(payload) });
    },
    async fetchWalletExpenses(walletId, month, options = {}) {
        await ensureAuthenticated();
        const data = await backendFetch('/wallets/expenses?walletId=' + encodeURIComponent(walletId) + '&month=' + encodeURIComponent(month), options);
        window.GastosApiContracts.arrayField(data, 'expenses');
        return data;
    },
    async saveWalletExpense(payload) {
        await ensureAuthenticated();
        return backendFetch('/wallets/expenses', { method: 'POST', body: JSON.stringify(payload) });
    },
    async saveWalletGoal(payload) { await ensureAuthenticated(); return backendFetch('/wallets/goal', { method: 'POST', body: JSON.stringify(payload) }); },
    async explainWallet(walletId, month) {
        await ensureAuthenticated();
        return backendFetch('/wallets/insights', { method: 'POST', body: JSON.stringify({ walletId, month }) });
    },

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

    async fetchFeatures() {
        const data = await backendFetch('/features', {}, false);
        return {
            smartEntry: data?.smartEntry === true,
            smartEntryLearning: data?.smartEntryLearning === true,
            smartEntryTelemetry: data?.smartEntryTelemetry === true,
            smartEntryParser: data?.smartEntryParser || null,
            smartEntryAiConfigured: data?.smartEntryAiConfigured === true
        };
    },

    async parseSmartEntry(text, inputMode = 'text') {
        await ensureAuthenticated();
        const allowedInputModes = ['text', 'voice', 'camera', 'qr', 'receipt'];
        const safeInputMode = allowedInputModes.includes(inputMode) ? inputMode : 'text';
        const maxLength = ['camera', 'receipt'].includes(safeInputMode) ? 12000 : 500;
        return backendFetch('/smart-entry/parse', {
            method: 'POST',
            body: JSON.stringify({
                text: String(text || '').slice(0, maxLength),
                inputMode: safeInputMode
            })
        });
    },

    async inspectReceipt(payload = {}) {
        await ensureAuthenticated();
        const data = await backendFetch('/receipts/inspect', {
            method: 'POST',
            body: JSON.stringify({
                qrPayload: String(payload.qrPayload || '').slice(0, 4000),
                ocrText: String(payload.ocrText || '').slice(0, 20000)
            })
        });
        return data?.receipt || null;
    },

    async fetchSmartMetrics(days = 30, options = {}) {
        await ensureAuthenticated();
        const safeDays = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
        const data = await backendFetch('/smart-entry/metrics?days=' + safeDays, options);
        return data?.metrics || null;
    },

    async fetchSmartRules() {
        await ensureAuthenticated();
        const data = await backendFetch('/smart-entry/rules');
        return window.GastosApiContracts.arrayField(data, 'rules');
    },

    async salvarRegraSmart(term, category) {
        await ensureAuthenticated();
        const data = await backendFetch('/smart-entry/rules', {
            method: 'POST',
            body: JSON.stringify({ action: 'set-manual', term, category })
        });
        return data?.rule || null;
    },

    async excluirRegraSmart(id) {
        await ensureAuthenticated();
        return backendFetch('/smart-entry/rules', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id })
        });
    },

    async excluirTermoSmart(term) {
        await ensureAuthenticated();
        return backendFetch('/smart-entry/rules', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete-term', term })
        });
    },

    async setRegraSmartAtiva(id, active) {
        await ensureAuthenticated();
        return backendFetch('/smart-entry/rules', {
            method: 'POST',
            body: JSON.stringify({ action: 'set-active', id, active: active === true })
        });
    },

    async fetchMeses() {
        await ensureAuthenticated();
        const data = await backendFetch('/months');
        if (data?.user) {
            currentSession.user = data.user;
            adicionarUsuarioNoHeader(data.user);
        }
        const meses = window.GastosApiContracts.arrayField(data, 'months');
        // Confere o histórico quando /months retorna apenas um mês.
        // A consulta sem filtro usa a mesma sessão e as mesmas regras RLS.
        if (meses.length <= 1) {
            try {
                const historico = await backendFetch('/expenses');
                const mesesDosGastos = window.GastosApiContracts.arrayField(historico, 'expenses', 'householdExpenses')
                    .map(gasto => String(gasto?.data || '').slice(0, 7))
                    .filter(valor => /^\d{4}-(0[1-9]|1[0-2])$/.test(valor))
                    .map(valor => valor.slice(5, 7) + '/' + valor.slice(0, 4));
                return [...new Set([...meses, ...mesesDosGastos])];
            } catch (error) {
                console.warn('[months] Não foi possível confirmar os meses via /expenses:', error);
            }
        }
        return meses;
    },

    async fetchGastosPorMes(mes, options = {}) {
        await ensureAuthenticated();
        const query = mes ? `?month=${encodeURIComponent(mes)}` : '';
        const data = await backendFetch(`/expenses${query}`, options);
        return window.GastosApiContracts.arrayField(data, 'expenses', 'householdExpenses').map(normalizarGasto);
    },

    async fetchAcertos(mes, options = {}) {
        await ensureAuthenticated();
        const data = await backendFetch('/settlements?month=' + encodeURIComponent(mes), options);
        return window.GastosApiContracts.arrayField(data, 'settlements').map(normalizarAcerto);
    },

    async salvarAcerto(payload) {
        await ensureAuthenticated();
        return backendFetch('/settlements', {
            method: 'POST',
            body: JSON.stringify({ action: 'add', ...payload })
        });
    },

    async excluirAcerto(id) {
        await ensureAuthenticated();
        return backendFetch('/settlements', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id })
        });
    },


    async fetchOrcamentos(mes, options = {}) {
        await ensureAuthenticated();
        const data = await backendFetch('/budgets?month=' + encodeURIComponent(mes), options);
        return window.GastosApiContracts.arrayField(data, 'budgets');
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
        return window.GastosApiContracts.arrayField(data, 'budgets');
    },

    async fetchMembros() {
        await ensureAuthenticated();
        const data = await backendFetch('/members');
        return window.GastosApiContracts.arrayField(data, 'members');
    },

    async adicionarMembro(payload) {
        await ensureAuthenticated();
        const data = await backendFetch('/members', {
            method: 'POST',
            body: JSON.stringify({
                action: 'add',
                name: payload.name,
                email: payload.email,
                password: payload.password
            })
        });
        return data?.member || null;
    },

    async fetchRecorrentes(options = {}) {
        await ensureAuthenticated();
        const data = await backendFetch('/recurring', options);
        return window.GastosApiContracts.arrayField(data, 'recurring');
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
