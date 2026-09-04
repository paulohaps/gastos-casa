const API_URL = 'https://ep-damp-meadow-acm7ggxa.apirest.sa-east-1.aws.neon.tech/gastos_casa/rest/v1';

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

async function neonFetch(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const detalhe = await response.text();
        throw new Error(`Neon API ${response.status}: ${detalhe}`);
    }

    if (response.status === 204) return null;
    const texto = await response.text();
    return texto ? JSON.parse(texto) : null;
}

const api = {
    async fetchMeses() {
        const rows = await neonFetch('/gastos?select=data&order=data.desc');
        return [...new Set((rows || []).map(row => {
            const [ano, mes] = row.data.split('-');
            return `${mes}/${ano}`;
        }))];
    },

    async fetchGastosPorMes(mes) {
        if (!mes) {
            const rows = await neonFetch('/gastos?select=*&order=data.desc,created_at.desc');
            return (rows || []).map(normalizarGasto);
        }

        const [mm, yyyy] = mes.split('/').map(Number);
        const inicio = `${yyyy}-${String(mm).padStart(2, '0')}-01`;
        const proximoMes = mm === 12
            ? `${yyyy + 1}-01-01`
            : `${yyyy}-${String(mm + 1).padStart(2, '0')}-01`;

        const path = `/gastos?select=*&data=gte.${inicio}&data=lt.${proximoMes}&order=data.desc,created_at.desc`;
        const rows = await neonFetch(path);
        return (rows || []).map(normalizarGasto);
    },

    async enviarGasto(payload) {
        if (payload.action === 'delete') {
            await neonFetch(`/gastos?id=eq.${encodeURIComponent(payload.id)}`, {
                method: 'DELETE',
                headers: { 'Prefer': 'return=minimal' }
            });
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
            const rows = await neonFetch(`/gastos?id=eq.${encodeURIComponent(payload.id)}`, {
                method: 'PATCH',
                headers: { 'Prefer': 'return=representation' },
                body: JSON.stringify(registro)
            });
            return { success: true, data: rows?.[0] || null };
        }

        const rows = await neonFetch('/gastos', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(registro)
        });
        return { success: true, data: rows?.[0] || null };
    }
};