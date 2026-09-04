const NEON_DATABASE_URL = 'https://ep-damp-meadow-acm7ggxa.sa-east-1.aws.neon.tech/gastos_casa';

const neonClientPromise = import('https://esm.sh/@neondatabase/neon-js').then(({ createClient }) =>
    createClient(NEON_DATABASE_URL)
);

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

async function getClient() {
    return await neonClientPromise;
}

function throwIfError(error) {
    if (error) {
        console.error('Neon:', error);
        throw new Error(error.message || 'Erro na Neon Data API');
    }
}

const api = {
    async getSession() {
        const client = await getClient();
        const result = await client.auth.getSession();
        if (result?.error) return null;
        return result?.data?.session ? result.data : null;
    },

    async login(email, password) {
        const client = await getClient();
        const result = await client.auth.signIn.email({ email, password });
        throwIfError(result?.error);
        return result?.data;
    },

    async cadastrar(nome, email, password) {
        const client = await getClient();
        const result = await client.auth.signUp.email({ name: nome, email, password });
        throwIfError(result?.error);
        return result?.data;
    },

    async logout() {
        const client = await getClient();
        const result = await client.auth.signOut();
        throwIfError(result?.error);
        return true;
    },

    async fetchMeses() {
        const client = await getClient();
        const { data: rows, error } = await client
            .from('gastos')
            .select('data')
            .order('data', { ascending: false });
        throwIfError(error);
        return [...new Set((rows || []).map(row => {
            const [ano, mes] = row.data.split('-');
            return `${mes}/${ano}`;
        }))];
    },

    async fetchGastosPorMes(mes) {
        const client = await getClient();
        let query = client
            .from('gastos')
            .select('*')
            .order('data', { ascending: false })
            .order('created_at', { ascending: false });

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