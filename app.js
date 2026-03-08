let chartPizzaInstance = null;
let resumoDados = { textoAcerto: "", detalhes: "" };
let mesAtualVigente = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`;
let idEmEdicao = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('Sem PWA por enquanto.'));
    });
}

window.onload = () => {
    document.getElementById('inputData').valueAsDate = new Date();
    carregarMesesDisponiveis();
};

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    const icon = toast.querySelector('i');
    icon.className = isError ? "fa-solid fa-circle-xmark text-red-400" : "fa-solid fa-circle-check text-emerald-400";
    document.getElementById('toastMsg').innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

function setStatusUi(state) {
    const el = document.getElementById('connectionStatus');
    el.classList.remove('hidden');
    el.className = 'flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full border transition-colors duration-300';
    if (state === 'loading') {
        el.classList.add('text-amber-500', 'bg-amber-50', 'border-amber-200');
        el.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Sincronizando...';
    } else if (state === 'online') {
        el.classList.add('text-emerald-600', 'bg-emerald-50', 'border-emerald-200');
        el.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Conectado';
    }
}

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
const escapeHTML = (str) => str ? str.toString().replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
const extrairMesAnoDeData = (dataStr) => dataStr ? `${dataStr.split('-')[1]}/${dataStr.split('-')[0]}` : null;

async function carregarMesesDisponiveis(mesFoco = null) {
    try {
        const meses = await api.fetchMeses();
        const seletor = document.getElementById('seletorMes');
        seletor.innerHTML = '';
        
        if(meses.length === 0) meses.push(mesAtualVigente);
        if(!meses.includes(mesAtualVigente)) meses.push(mesAtualVigente);

        meses.sort((a,b) => {
            const [ma, ya] = a.split('/');
            const [mb, yb] = b.split('/');
            return new Date(yb, mb-1) - new Date(ya, ma-1);
        });

        meses.forEach(mes => {
            const opt = document.createElement('option');
            opt.value = mes;
            opt.innerText = mes === mesAtualVigente ? `📅 ${mes} (Atual)` : mes;
            seletor.appendChild(opt);
        });

        if (mesFoco && meses.includes(mesFoco)) seletor.value = mesFoco;
        carregarDados(seletor.value);
    } catch (error) { 
        showToast("Erro de conexão", true); 
    }
}

function mudarMes() { carregarDados(document.getElementById('seletorMes').value); }

async function carregarDados(mesParam) {
    try {
        setStatusUi('loading');
        const btnIcon = document.querySelector('.fa-arrows-rotate');
        if(btnIcon) btnIcon.classList.add('fa-spin');
        
        const dados = await api.fetchGastosPorMes(mesParam);
        atualizarDashboards(dados);
        
        setStatusUi('online');
        if(btnIcon) btnIcon.classList.remove('fa-spin');
    } catch (error) { 
        showToast("Erro ao ler dados.", true); 
    }
}

async function deletarGasto(idGasto, btnElement) {
    if(!confirm("Tem certeza que deseja apagar este gasto?")) return;
    const mesSelecionado = document.getElementById('seletorMes').value;
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-slate-400"></i>';
    btnElement.disabled = true;

    try {
        await api.enviarGasto({ action: 'delete', id: idGasto, month: mesSelecionado });
        showToast("Gasto apagado!");
        carregarDados(mesSelecionado);
    } catch (error) {
        showToast("Erro ao apagar.", true);
        btnElement.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        btnElement.disabled = false;
    }
}

function prepararEdicao(id, dataStr, descricao, valor, usuario, forma, categoria) {
    idEmEdicao = id;
    
    const partesData = dataStr.split('/');
    if(partesData.length === 3) {
        document.getElementById('inputData').value = `${partesData[2]}-${partesData[1]}-${partesData[0]}`;
    }

    document.getElementById('inputDescricao').value = descricao;
    document.getElementById('inputValor').value = valor;
    document.getElementById('inputUsuario').value = usuario;
    document.getElementById('inputFormaPagamento').value = forma;
    document.getElementById('inputCategoria').value = categoria;

    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.classList.replace('bg-indigo-600', 'bg-amber-500');
    btnSubmit.classList.replace('hover:bg-indigo-700', 'hover:bg-amber-600');
    btnSubmit.innerHTML = `<span>Salvar Edição</span> <i class="fa-solid fa-pen"></i>`;
    
    document.getElementById('btnCancelarEdicao').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicao() {
    idEmEdicao = null;
    document.getElementById('formGasto').reset();
    document.getElementById('inputData').valueAsDate = new Date();
    
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.classList.replace('bg-amber-500', 'bg-indigo-600');
    btnSubmit.classList.replace('hover:bg-amber-600', 'hover:bg-indigo-700');
    btnSubmit.innerHTML = `<span>Lançar Despesa</span> <i class="fa-solid fa-paper-plane"></i>`;
    
    document.getElementById('btnCancelarEdicao').classList.add('hidden');
}

function atualizarDashboards(dados) {
    let pauloDinheiro = 0, pauloVale = 0;
    let gustavoDinheiro = 0, gustavoVale = 0;
    
    const tbody = document.getElementById('tabelaHistorico');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '';

    if(dados.length === 0) emptyState.classList.remove('hidden');
    else emptyState.classList.add('hidden');

    dados.forEach((gasto) => {
        const valor = parseFloat(gasto.valor);
        const forma = gasto.formaPagamento || 'Dinheiro'; 
        
        if(!isNaN(valor)) {
            if (gasto.usuario === 'Paulo Henrique') {
                if (forma === 'Vale') pauloVale += valor; else pauloDinheiro += valor;
            } else if (gasto.usuario === 'Fernando Gustavo') {
                if (forma === 'Vale') gustavoVale += valor; else gustavoDinheiro += valor;
            }

            const badgeUser = gasto.usuario === 'Paulo Henrique' ? 
                '<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider mr-1">Paulo</span>' : 
                '<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider mr-1">Fernando</span>';

            const badgeForma = forma === 'Vale' ?
                '<span class="text-xs text-orange-500"><i class="fa-solid fa-ticket"></i> iFood</span>' :
                '<span class="text-xs text-slate-400"><i class="fa-solid fa-money-bill-transfer"></i> Dinheiro</span>';

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition border-b border-slate-50";
            tr.innerHTML = `
                <td class="py-3 px-6 text-sm text-slate-500 whitespace-nowrap">${escapeHTML(gasto.data)}</td>
                <td class="py-3 px-6 text-sm text-slate-800 font-medium">
                    ${escapeHTML(gasto.descricao)} <br><span class="text-xs text-slate-400 font-normal">${escapeHTML(gasto.categoria || 'Outros')}</span>
                </td>
                <td class="py-3 px-6 text-sm flex flex-col items-start gap-1">
                    ${badgeUser} ${badgeForma}
                </td>
                <td class="py-3 px-6 text-sm text-slate-800 font-bold text-right">${formatarMoeda(valor)}</td>
                <td class="py-3 px-6 text-center flex justify-center gap-1">
                    <button onclick="prepararEdicao('${escapeHTML(gasto.id)}', '${escapeHTML(gasto.data)}', '${escapeHTML(gasto.descricao)}', ${valor}, '${escapeHTML(gasto.usuario)}', '${escapeHTML(forma)}', '${escapeHTML(gasto.categoria || 'Outros')}')" class="text-slate-300 hover:text-amber-500 hover:bg-amber-50 p-2 rounded transition" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="deletarGasto('${escapeHTML(gasto.id)}', this)" class="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded transition" title="Apagar">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });

    const totalDinheiro = pauloDinheiro + gustavoDinheiro;
    const totalVale = pauloVale + gustavoVale;
    const totalGeral = totalDinheiro + totalVale;
    const totalPaulo = pauloDinheiro + pauloVale;
    const totalGustavo = gustavoDinheiro + gustavoVale;

    document.getElementById('cardTotal').innerText = formatarMoeda(totalGeral);
    document.getElementById('cardSubtotalGeral').innerText = `(${formatarMoeda(totalDinheiro)} Dinheiro | ${formatarMoeda(totalVale)} Vale)`;
    document.getElementById('cardPaulo').innerText = formatarMoeda(totalPaulo);
    document.getElementById('cardSubtotalPaulo').innerText = `(${formatarMoeda(pauloDinheiro)} Dinh. | ${formatarMoeda(pauloVale)} Vale)`;
    document.getElementById('cardGustavo').innerText = formatarMoeda(totalGustavo);
    document.getElementById('cardSubtotalGustavo').innerText = `(${formatarMoeda(gustavoDinheiro)} Dinh. | ${formatarMoeda(gustavoVale)} Vale)`;

    const saldoPauloDinheiro = pauloDinheiro - (totalDinheiro / 2);
    const saldoPauloVale = pauloVale - (totalVale / 2);

    const boxDinh = document.getElementById('boxAcertoDinheiro');
    const boxVale = document.getElementById('boxAcertoVale');
    let txtResumoDinh = "", txtResumoVale = "";

    if (Math.abs(saldoPauloDinheiro) < 0.05) {
        boxDinh.innerHTML = `<p class="text-sm font-medium text-slate-300"><i class="fa-solid fa-money-bill-transfer w-4"></i> Dinheiro: <span class="text-white">Tudo quite!</span></p>`;
        txtResumoDinh = "Dinheiro: Tudo quite!";
    } else if (saldoPauloDinheiro < 0) {
        boxDinh.innerHTML = `<p class="text-sm font-medium text-red-400"><i class="fa-solid fa-money-bill-transfer w-4"></i> Dinheiro: Paulo deve ${formatarMoeda(Math.abs(saldoPauloDinheiro))} a Fernando</p>`;
        txtResumoDinh = `Dinheiro: Paulo deve transferir ${formatarMoeda(Math.abs(saldoPauloDinheiro))} para Fernando`;
    } else {
        boxDinh.innerHTML = `<p class="text-sm font-medium text-emerald-400"><i class="fa-solid fa-money-bill-transfer w-4"></i> Dinheiro: Fernando deve ${formatarMoeda(Math.abs(saldoPauloDinheiro))} a Paulo</p>`;
        txtResumoDinh = `Dinheiro: Fernando deve transferir ${formatarMoeda(Math.abs(saldoPauloDinheiro))} para Paulo`;
    }

    if (Math.abs(saldoPauloVale) < 0.05) {
        boxVale.innerHTML = `<p class="text-sm font-medium text-slate-300"><i class="fa-solid fa-ticket w-4"></i> Vale iFood: <span class="text-white">Tudo quite!</span></p>`;
        txtResumoVale = "Vale iFood: Tudo quite!";
    } else if (saldoPauloVale < 0) {
        boxVale.innerHTML = `<p class="text-sm font-medium text-orange-400"><i class="fa-solid fa-ticket w-4"></i> Vale iFood: Paulo deve pagar ${formatarMoeda(Math.abs(saldoPauloVale))} no iFood para Fernando</p>`;
        txtResumoVale = `Vale iFood: Paulo deve pagar ${formatarMoeda(Math.abs(saldoPauloVale))} de lanche para Fernando`;
    } else {
        boxVale.innerHTML = `<p class="text-sm font-medium text-orange-400"><i class="fa-solid fa-ticket w-4"></i> Vale iFood: Fernando deve pagar ${formatarMoeda(Math.abs(saldoPauloVale))} no iFood para Paulo</p>`;
        txtResumoVale = `Vale iFood: Fernando deve pagar ${formatarMoeda(Math.abs(saldoPauloVale))} de lanche para Paulo`;
    }

    resumoDados.textoAcerto = `👉 ${txtResumoDinh}\n👉 ${txtResumoVale}`;
    resumoDados.detalhes = `\n💰 *Total:* ${formatarMoeda(totalGeral)}\n👤 *Paulo:* ${formatarMoeda(totalPaulo)}\n🧑‍🚀 *Fernando:* ${formatarMoeda(totalGustavo)}\n`;

    renderizarGraficoPizza(totalPaulo, totalGustavo);
}

function gerarResumo() {
    const mesStr = document.getElementById('seletorMes').value;
    const texto = `🧾 *Resumo de Gastos - ${mesStr}*${resumoDados.detalhes}\n⚖️ *Acerto de Contas:*\n${resumoDados.textoAcerto}`;
    navigator.clipboard.writeText(texto).then(() => alert("Resumo copiado!\n\n" + texto)).catch(() => alert(texto));
}

function renderizarGraficoPizza(v1, v2) {
    const ctx = document.getElementById('chartDivisao').getContext('2d');
    if (chartPizzaInstance) chartPizzaInstance.destroy();
    chartPizzaInstance = new Chart(ctx, {
        type: 'doughnut', data: { labels: ['Paulo Henrique', 'Fernando Gustavo'], datasets: [{ data: [v1, v2], backgroundColor: ['#4f46e5', '#10b981'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom' } } }
    });
}

document.getElementById('formGasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const valorInput = parseFloat(document.getElementById('inputValor').value);
    const dataInputStr = document.getElementById('inputData').value;
    
    if (valorInput <= 0 || isNaN(valorInput)) return showToast("Valor inválido!", true);

    const btn = document.getElementById('btnSubmit');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    const payload = { 
        action: idEmEdicao ? 'update' : 'add', 
        id: idEmEdicao, 
        month: document.getElementById('seletorMes').value,
        dataGasto: dataInputStr, 
        formaPagamento: document.getElementById('inputFormaPagamento').value, 
        usuario: document.getElementById('inputUsuario').value, 
        valor: valorInput, 
        descricao: document.getElementById('inputDescricao').value, 
        categoria: document.getElementById('inputCategoria').value 
    };

    try {
        await api.enviarGasto(payload);
        cancelarEdicao(); 
        showToast(idEmEdicao ? 'Despesa atualizada!' : 'Despesa lançada!');
        
        const mesDoGastoInserido = extrairMesAnoDeData(dataInputStr);
        await carregarMesesDisponiveis(mesDoGastoInserido); 
    } catch (error) { 
        showToast("Erro de conexão.", true); 
    } finally {
        btn.innerHTML = originalText; 
        btn.disabled = false;
    }
});