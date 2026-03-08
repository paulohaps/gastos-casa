// URL EXATA QUE VOCÊ ME PASSOU
const API_URL = 'https://script.google.com/macros/s/AKfycbxVQpIEx_SLhW6BXmS0K4Fvxk5P67rju2_ofPCrQ30Qso7Xmr8SSMGm1jpd72xXwcnnhw/exec';

const api = {
    async fetchMeses() {
        const response = await fetch(`${API_URL}?action=get_months`);
        return await response.json();
    },

    async fetchGastosPorMes(mes) {
        const urlCompleta = mes ? `${API_URL}?month=${mes}` : API_URL;
        const response = await fetch(urlCompleta);
        return await response.json();
    },

    async enviarGasto(payload) {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return await response.json();
    }
};