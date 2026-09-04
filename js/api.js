const NEON_AUTH_URL = 'https://ep-damp-meadow-acm7ggxa.neonauth.sa-east-1.aws.neon.tech/gastos_casa/auth';
const NEON_DATA_API_URL = 'https://ep-damp-meadow-acm7ggxa.apirest.sa-east-1.aws.neon.tech/gastos_casa/rest/v1';

const neonClientPromise = import('https://esm.sh/@neondatabase/neon-js@0.7.0-beta.4').then(({ createClient }) =>
    createClient({
        auth: { url: NEON_AUTH_URL },
        dataApi: { url: NEON_DATA_API_URL }
    })
);

let authReadyPromise = null;

async function getClient() {
    return await neonClientPromise;
}

function throwIfError(error) {
    if (error) {
        console.error('Neon:', error);
        throw new Error(error.message || 'Erro na Neon Data API');
    }
}

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
                <div id="authNomeBox" class="hidden">
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
            <button id="authToggle" type="button" class="hidden w-full mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700">Criar uma conta</button>
            <p class="text-[11px] text-slate-400 text-center mt-5 leading-relaxed">Senha protegida pelo Neon Auth/Better Auth. Nenhuma senha é salva em Base64 ou no JavaScript.</p>
        </div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function adicionarUsuarioNoHeader(user) {
    if (document.getElementById('btnLogout')) return;
    const alvo = document.querySelector('header .max-w-7xl > div:last-child');
    if (!alvo) return;

    const wrap = document.createElement('div');
    wrap.className = 'flex items-center gap-2 whitespace-nowrap';
    wrap.innerHTML = `
        <span class="hidden md:inline text-xs text-slate-500 max-w-[150px] truncate">${user?.name || user?.email || 'Usuário'}</span>
        <button id="btnLogout" type="button" class="bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 text-sm font-medium px-3 py-2 rounded-lg transition" title="Sair">
            <i class="fa-solid fa-right-from-bracket"></i>
        </button>`;
    alvo.appendChild(wrap);

    document.getElementById('btnLogout').addEventListener('click', async () => {
        try {
            const client = await getClient();
            await client.auth.signOut();
        } finally {
            location.reload();
        }
    });
}

async function mostrarLogin(client, overlay) {
    const loading = overlay.querySelector('#authLoading');
    const form = overlay.querySelector('#authForm');
    const toggle = overlay.querySelector('#authToggle');
    const title = overlay.querySelector('#authTitle');
    const subtitle = overlay.querySelector('#authSubtitle');
    const nomeBox = overlay.querySelector('#authNomeBox');
    const nome = overlay.querySelector('#authNome');
    const email = overlay.querySelector('#authEmail');
    const senha = overlay.querySelector('#authSenha');
    const erro = overlay.querySelector('#authErro');
    const submit = overlay.querySelector('#authSubmit');

    loading.classList.add('hidden');
    form.classList.remove('hidden');
    toggle.classList.remove('hidden');

    let cadastro = false;
    function atualizarModo() {
        nomeBox.classList.toggle('hidden', !cadastro);
        nome.required = cadastro;
        senha.autocomplete = cadastro ? 'new-password' : 'current-password';
        title.textContent = cadastro ? 'Criar conta' : 'Entrar no Gastos';
        subtitle.textContent = cadastro ? 'Cadastre seu acesso ao sistema.' : 'Use seu e-mail e senha para continuar.';
        submit.textContent = cadastro ? 'Criar conta e entrar' : 'Entrar';
        toggle.textContent = cadastro ? 'Já tenho uma conta' : 'Criar uma conta';
    }
    atualizarModo();

    return await new Promise((resolve) => {
        toggle.onclick = () => {
            cadastro = !cadastro;
            erro.classList.add('hidden');
            atualizarModo();
        };

        form.onsubmit = async (event) => {
            event.preventDefault();
            erro.classList.add('hidden');
            submit.disabled = true;
            submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aguarde...';

            try {
                const result = cadastro
                    ? await client.auth.signUp.email({ name: nome.value.trim(), email: email.value.trim(), password: senha.value })
                    : await client.auth.signIn.email({ email: email.value.trim(), password: senha.value });

                throwIfError(result?.error);

                const sessao = await client.auth.getSession();
                throwIfError(sessao?.error);
                if (!sessao?.data?.session) throw new Error('Login realizado, mas a sessão não foi criada.');

                overlay.remove();
                adicionarUsuarioNoHeader(sessao.data.user);
                resolve(sessao.data);
            } catch (e) {
                console.error('Erro de autenticação:', e);
                erro.textContent = e.message || 'Não foi possível autenticar.';
                erro.classList.remove('hidden');
            } finally {
                submit.disabled = false;
                atualizarModo();
            }
        };
    });
}

async function ensureAuthenticated() {
    if (authReadyPromise) return authReadyPromise;

    authReadyPromise = (async () => {
        const overlay = garantirAuthOverlay();
        const client = await getClient();

        try {
            const sessao = await client.auth.getSession();
            if (sessao?.data?.session) {
                overlay.remove();
                adicionarUsuarioNoHeader(sessao.data.user);
                return sessao.data;
            }
        } catch (e) {
            console.warn('Não foi possível recuperar sessão anterior; exibindo login.', e);
        }

        return await mostrarLogin(client, overlay);
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
        await ensureAuthenticated();
        const client = await getClient();
        const result = await client.auth.getSession();
        return result?.data?.session ? result.data : null;
    },

    async logout() {
        const client = await getClient();
        const result = await client.auth.signOut();
        throwIfError(result?.error);
        return true;
    },

    async fetchMeses() {
        await ensureAuthenticated();
        const client = await getClient();
        const { data: rows, error } = await client.from('gastos').select('data').order('data', { ascending: false });
        throwIfError(error);
        return [...new Set((rows || []).map(row => {
            const [ano, mes] = row.data.split('-');
            return `${mes}/${ano}`;
        }))];
    },

    async fetchGastosPorMes(mes) {
        await ensureAuthenticated();
        const client = await getClient();
        let query = client.from('gastos').select('*').order('data', { ascending: false }).order('created_at', { ascending: false });

        if (mes) {
            const [mm, yyyy] = mes.split('/').map(Number);
            const inicio = `${yyyy}-${String(mm).padStart(2, '0')}-01`;
            const proximoMes = mm === 12 ? `${yyyy + 1}-01-01` : `${yyyy}-${String(mm + 1).padStart(2, '0')}-01`;
            query = query.gte('data', inicio).lt('data', proximoMes);
        }

        const { data: rows, error } = await query;
        throwIfError(error);
        return (rows || []).map(normalizarGasto);
    },

    async enviarGasto(payload) {
        await ensureAuthenticated();
        const client = await getClient();

        if (payload.action === 'delete') {
            const { error } = await client.from('gastos').delete().eq('id', payload.id);
            throwIfError(error);
            return { success: true };
        }

        const registro = {
            data: payload.dataGasto,
            usuario: payload.usuario,
            valor: Number(payload.valor),
            descricao: payload.descricao,
            categoria: payload.categoria || 'Outros',
            forma_pagamento: payload.formaPagamento || 'Dinheiro',
            updated_at: new Date().toISOString()
        };

        if (payload.action === 'update' && payload.id) {
            const { data, error } = await client.from('gastos').update(registro).eq('id', payload.id).select();
            throwIfError(error);
            return { success: true, data: data?.[0] || null };
        }

        const { data, error } = await client.from('gastos').insert(registro).select();
        throwIfError(error);
        return { success: true, data: data?.[0] || null };
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureAuthenticated().catch(console.error));
} else {
    ensureAuthenticated().catch(console.error);
}
