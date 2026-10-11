(function () {
  'use strict';
  const el = id => document.getElementById(id);
  let ctx, providers = [], settings = null, loaded = false, busy = false, sessionVersion = 0;
  function updateModels(model) {
    const provider = providers.find(p => p.id === el('aiProvider').value);
    el('aiModel').replaceChildren();
    (provider?.models || []).forEach(m => el('aiModel').add(new Option(m.name + (m.recommended ? ' · recomendado' : ''), m.id)));
    el('aiModel').add(new Option('Outro modelo…', 'custom'));
    if (model && !provider?.models.some(m => m.id === model)) { el('aiModel').value = 'custom'; el('aiCustomModel').value = model; }
    else if (model) el('aiModel').value = model;
    el('aiKeyLink').href = provider?.keyUrl || '#';
    el('aiKeyLink').textContent = 'Obter uma chave no ' + (provider?.name || 'provedor') + ' ↗';
    updateHint();
  }
  function updateHint() {
    const custom = el('aiModel').value === 'custom';
    el('aiCustomModelField').hidden = !custom; el('aiCustomModel').required = custom;
    const provider = providers.find(p => p.id === el('aiProvider').value);
    el('aiModelHint').textContent = custom ? 'Confira se sua chave tem acesso a esse modelo.' : (provider?.models.find(m => m.id === el('aiModel').value)?.description || '');
    const saved = settings?.hasKey && settings.provider === el('aiProvider').value;
    el('aiApiKey').required = !saved;
    el('aiApiKey').placeholder = saved ? 'Chave salva · deixe vazio para manter' : 'Cole a chave deste provedor';
  }
  function render() {
    el('aiConnectionBadge').textContent = settings?.hasKey ? 'Chave salva' : 'Não conectada';
    el('aiConnectionBadge').classList.toggle('is-connected', Boolean(settings?.hasKey));
    el('aiRemove').hidden = !settings?.hasKey;
    if (settings) el('aiProvider').value = settings.provider;
    updateModels(settings?.model);
  }
  async function load() {
    const turn = sessionVersion;
    try {
      const data = await ctx.api.fetchAiSettings();
      if (turn !== sessionVersion) return;
      providers = data.providers; settings = data.settings; loaded = true; render();
      el('aiSave').disabled = !data.storageReady;
      if (!data.storageReady) el('aiSettingsStatus').textContent = 'A configuração de IA ainda não está disponível neste ambiente.';
    } catch (e) { if (turn === sessionVersion) el('aiSettingsStatus').textContent = e.message || 'Não foi possível carregar a configuração.'; }
  }
  async function act(action) {
    if (busy || (action !== 'delete' && !el('aiSettingsForm').reportValidity())) return;
    busy = true; el('aiSettingsForm').querySelectorAll('input, select').forEach(field => { field.disabled = true; }); el('aiSave').disabled = true; el('aiTest').disabled = true; el('aiRemove').disabled = true;
    el('aiSettingsStatus').textContent = action === 'test' ? 'Testando uma chamada curta ao modelo…' : 'Salvando…';
    try {
      const data = await ctx.api.saveAiSettings({ action, provider: el('aiProvider').value, model: el('aiModel').value === 'custom' ? el('aiCustomModel').value.trim() : el('aiModel').value,
        ...(el('aiApiKey').value.trim() ? { apiKey: el('aiApiKey').value.trim() } : {}) });
      if (action === 'test') el('aiSettingsStatus').textContent = 'Conexão confirmada. Salve a configuração para usar nas análises.';
      else {
        settings = data.settings; el('aiApiKey').value = ''; render();
        el('aiSettingsStatus').textContent = action === 'delete' ? 'Chave removida. As recomendações automáticas continuam disponíveis.' : 'Configuração salva. Você já pode conversar com o Assistente.';
        window.dispatchEvent(new CustomEvent('gastos:aichange'));
      }
    } catch (e) { el('aiSettingsStatus').textContent = e.message || 'Não foi possível concluir. Tente novamente.'; }
    finally { busy = false; el('aiSettingsForm').querySelectorAll('input, select').forEach(field => { field.disabled = false; }); el('aiSave').disabled = false; el('aiTest').disabled = false; el('aiRemove').disabled = false; }
  }
  function init(options) {
    ctx = options;
    el('aiSettingsForm').onsubmit = event => { event.preventDefault(); act('save'); };
    el('aiProvider').onchange = () => { el('aiApiKey').value = ''; updateModels(); el('aiSettingsStatus').textContent = ''; };
    el('aiModel').onchange = updateHint;
    el('aiTest').onclick = () => act('test');
    el('aiRemove').onclick = async () => { if (await ctx.ui.confirmAction({ title: 'Remover chave de IA?', message: 'Você pode conectar outra chave depois.', confirmLabel: 'Remover chave' })) act('delete'); };
    document.addEventListener('click', event => {
      if (!event.target.closest('[data-ai-open]')) return;
      window.GastosNavigation.showAndReveal('ajustes', '#aiSettingsPanel', { focusSelector: '#aiProvider' });
    });
    window.addEventListener('gastos:viewchange', event => {
      if (event.detail.view === 'ajustes' && !loaded) load();
      if (event.detail.view !== 'ajustes') el('aiApiKey').value = '';
    });
    window.addEventListener('gastos:sessioncleared', () => {
      sessionVersion++; settings = null; loaded = false;
      el('aiApiKey').value = ''; el('aiCustomModel').value = ''; el('aiSettingsStatus').textContent = ''; render();
    });
    window.addEventListener('gastos:authenticated', () => { if (window.GastosNavigation.current() === 'ajustes') load(); });
    if (window.GastosNavigation.current() === 'ajustes') load();
  }
  window.GastosAiSettings = { init };
})();
