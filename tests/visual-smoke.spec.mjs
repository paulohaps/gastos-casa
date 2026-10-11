import { AI_PROVIDERS } from '../backend/services/ai-settings.mjs';
import { test, expect } from '@playwright/test';
async function fillField(locator, value) {
  await locator.fill(value);
  if (await locator.inputValue() === value) return;
  // Fallback para o Chromium do ambiente sem inserção nativa de texto.
  await locator.evaluate((element, next) => {
    element.value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}


const BACKEND = 'https://br-polished-voice-a5flam43-gastospwa.compute.c-1.us-east-2.aws.neon.tech';

const viewports = [
  { name: 'mobile-small', width: 360, height: 740 },
  { name: 'mobile-large', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'notebook', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 }
];

async function mockBackend(page, options = {}) {
  await page.clock.setFixedTime(new Date('2026-09-22T12:00:00Z'));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', route => route.abort());
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());

  await page.addInitScript(() => {
    localStorage.setItem('gastos_pwa_session_token_v2', 'visual-test-token');

    class FakeSpeechRecognition {
      constructor() {
        this.lang = 'pt-BR';
        this.interimResults = true;
        this.continuous = false;
        this.maxAlternatives = 1;
      }
      start() {
        setTimeout(() => {
          this.onstart?.();
          const result = [{ transcript: 'Paguei 87,50 no mercado hoje no PIX' }];
          result.isFinal = true;
          this.onresult?.({ resultIndex: 0, results: [result] });
          this.onend?.();
        }, 10);
      }
      stop() { this.onend?.(); }
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    window.webkitSpeechRecognition = FakeSpeechRecognition;
  });

  await page.route(BACKEND + '/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const respond = body => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });

    if (path === '/ai/settings') return respond({ storageReady: true, settings: null, providers: [
      { id: 'gemini', name: 'Google Gemini', keyUrl: 'https://aistudio.google.com/api-keys', models: [{ id: 'gemini-3.5-flash-lite', name: 'Gemini Flash-Lite', description: 'Rápido e econômico', recommended: true }] },
      { id: 'deepseek', name: 'DeepSeek', keyUrl: 'https://platform.deepseek.com/api_keys', models: [{ id: 'deepseek-flash', name: 'DeepSeek Flash', description: 'Rápido e econômico', recommended: true }] }
    ] });
    if (path === '/wallets') return respond({ wallets: [] });
    if (path === '/features') return respond({
      smartEntry: true,
      smartEntryLearning: true,
      smartEntryTelemetry: true,
      smartEntryParser: 'rules-learning-history-v4',
      smartEntryAiConfigured: false
    });
    if (path === '/receipts/inspect') return respond({
      receipt: {
        kind:'nfce',
        fiscalStatus:'identified_official_qr',
        confidence:'high',
        accessKey:'11260904082624000822650100009174851071923795',
        duplicateKey:'11260904082624000822650100009174851071923795',
        key:{ validCheckDigit:true, uf:'RO', issuerCnpj:'04082624000822' },
        issuer:{ name:'Irmãos Gonçalves', cnpj:'04082624000822' },
        issueDate:'2026-09-19',
        total:14.01,
        evidence:[
          {code:'ACCESS_KEY_44',label:'Chave de acesso encontrada',ok:true},
          {code:'ACCESS_KEY_DV',label:'Dígito verificador da chave válido',ok:true},
          {code:'OFFICIAL_QR_DOMAIN',label:'QR aponta para domínio fiscal oficial',ok:true},
          {code:'TOTAL_FOUND',label:'Valor total identificado',ok:true}
        ],
        verification:{
          mode:'assisted-url',
          url:'https://www.nfce.sefin.ro.gov.br/',
          captchaExpected:true,
          verifiedByAuthority:false
        },
        source:{qr:true,ocr:true},
        duplicate:{found:false}
      }
    });
    if (path === '/smart-entry/metrics') return respond({
      metrics: {
        days: 30,
        interpretations: 12,
        expenseInterpretations: 11,
        unsupported: 1,
        confirmed: 9,
        unconfirmed: 2,
        confirmationRate: 81.8,
        noCorrection: 7,
        noCorrectionRate: 77.8,
        corrected: 2,
        correctedRate: 22.2,
        reviewSuggested: 3,
        reviewSuggestedRate: 27.3,
        avgConfirmSeconds: 18.4,
        learningRecorded: 6,
        corrections: {
          value:{count:0,rate:0},
          description:{count:1,rate:11.1},
          category:{count:1,rate:11.1},
          payment:{count:0,rate:0},
          date:{count:0,rate:0}
        },
        sources: {'learned-rule':4,rules:4,history:2,fallback:1},
        learningImpact: {
          learnedConfirmed: 4,
          learnedCategoryCorrectionRate: 0,
          baselineConfirmed: 5,
          baselineCategoryCorrectionRate: 20,
          improvementPp: 20
        }
      }
    });
    if (path === '/smart-entry/rules') return respond({
      rules: [
        { id:'sr1', termo_normalizado:'posto trevo', categoria:'Contas', confirmacoes:3, manual:false, ativo:true }
      ]
    });
    if (path === '/smart-entry/parse') return respond({
      intent: 'expense',
      parserVersion: 'rules-learning-history-v4',
      telemetryId: 'telemetry-1',
      draft: {
        valor: 87.5,
        descricao: 'Mercado',
        categoria: 'Mercado',
        formaPagamento: 'Dinheiro',
        data: '2026-09-19'
      },
      confidence: {
        valor: .99, descricao: .9, categoria: .97, formaPagamento: .97, data: .99
      },
      needsReview: false,
      warnings: [],
      source: { parser: 'rules-learning-history-v4', categoria: 'rules', descricao: 'template-purpose', pagamento: 'rules', data: 'relative' }
    });
    if (path === '/session') return respond({
      token: 'visual-test-token',
      user: { name: 'Paulo Henrique', email: 'paulo@example.com' }
    });
    if (path === '/months') return respond({
      months: ['09/2026', '08/2026'],
      user: { name: 'Paulo Henrique', email: 'paulo@example.com' }
    });
    if (path === '/expenses') {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON();
        options.onExpensePost?.(payload);
        return respond({
          expense: {
            id:'manual-test',
            data:payload.dataGasto,
            usuario:'Paulo Henrique',
            valor:payload.valor,
            descricao:payload.descricao,
            categoria:payload.categoria,
            forma_pagamento:payload.formaPagamento
          }
        });
      }
      const month = url.searchParams.get('month');
      const current = month === '09/2026';
      return respond({ expenses: current ? [
        { id:'1', data:'2026-09-18', usuario:'Paulo Henrique', valor:120.00, descricao:'Mercado da semana', categoria:'Mercado', forma_pagamento:'Dinheiro' },
        { id:'2', data:'2026-09-12', usuario:'Fernando Gustavo', valor:180.50, descricao:'Internet', categoria:'Contas', forma_pagamento:'Dinheiro' },
        { id:'3', data:'2026-09-07', usuario:'Paulo Henrique', valor:65.90, descricao:'iFood', categoria:'Ifood', forma_pagamento:'Vale' }
      ] : [
        { id:'4', data:'2026-08-18', usuario:'Fernando Gustavo', valor:290.00, descricao:'Mercado', categoria:'Mercado', forma_pagamento:'Dinheiro' }
      ] });
    }
    if (path === '/budgets') return respond({ budgets: [
      { id:'b1', mes:'2026-09', categoria:'Mercado', valor_limite:700 },
      { id:'b2', mes:'2026-09', categoria:'Contas', valor_limite:400 },
      { id:'b3', mes:'2026-09', categoria:'Ifood', valor_limite:250 }
    ] });
    if (path === '/recurring') return respond({ recurring: [
      { id:'r1', descricao:'Internet', valor:120, categoria:'Contas', forma_pagamento:'Dinheiro', dia_vencimento:12, ativo:true },
      { id:'r2', descricao:'Aluguel', valor:900, categoria:'Aluguel', forma_pagamento:'Dinheiro', dia_vencimento:5, ativo:true }
    ] });
    if (path === '/settlements') return respond({ settlements: [
      { id:'s1', competencia:'2026-09-01', data_pagamento:'2026-09-20', pagador:'Paulo Henrique', recebedor:'Fernando Gustavo', forma_pagamento:'Dinheiro', valor:10, observacao:'PIX parcial' }
    ] });
    if (path === '/members') return respond({ members: [
      { auth_user_id:'u1', nome:'Paulo Henrique', email:'paulo@example.com', ativo:true },
      { auth_user_id:'u2', nome:'Fernando Gustavo', email:'fernando@example.com', ativo:true }
    ] });
    if (path === '/health') return respond({ ok:true });
    return route.fulfill({ status: 404, contentType:'application/json', body:'{}' });
  });
}

for (const viewport of viewports) {
  test(viewport.name + ' sem overflow e com layout ativo', async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockBackend(page);
    await page.goto('/index.html');
    await expect(page.locator('#cardTotal')).not.toHaveText('R$ 0,00', { timeout: 10000 });
    await expect(page.locator('#homeView')).toBeVisible();
    await page.screenshot({ path: 'test-results/home-' + viewport.name + '.png', fullPage: true });
    await page.locator('nav [data-app-nav="casa"]:visible').first().click();
    await expect(page.locator('.metric-grid')).toBeVisible();
    await expect(page.locator('.metric-card')).toHaveCount(4);
    const metricOrder = await page.locator('.metric-grid > .metric-card').evaluateAll(cards =>
      cards.map(card => card.textContent.replace(/\s+/g, ' ').trim())
    );
    expect(metricOrder[0]).toContain('Total do mês');
    expect(metricOrder[1]).toContain('Acerto de contas');
    expect(metricOrder[2]).toContain('Fernando Gustavo');
    expect(metricOrder[3]).toContain('Paulo Henrique');
    await expect(page.locator('#seletorMes')).toHaveValue('09/2026');
    await expect(page.locator('#boxAcertoDinheiro')).toContainText('Falta R$ 20,25');
    await page.locator('[data-house-tab="acertos"]').click();
    await expect(page.locator('#settlementHistoryList')).toContainText('PIX parcial');
    await page.locator('[data-house-tab="visao"]').click();
    await page.locator('#boxAcertoDinheiro button', { hasText: 'Registrar pagamento' }).click();
    await expect(page.locator('#settlementDialog')).toBeVisible();
    await expect(page.locator('#settlementRemaining')).toContainText('R$ 20,25');
    await page.locator('#settlementCancel').click();
    await expect(page.locator('#settlementDialog')).toBeHidden();
    if (viewport.name === 'mobile-large' || viewport.name === 'desktop') {
      await page.screenshot({ path: 'test-results/settlements-' + viewport.name + '.png', fullPage: true });
    }

    const headerLayout = await page.evaluate(() => {
      const picker = document.querySelector('.month-picker')?.getBoundingClientRect();
      const select = document.querySelector('#seletorMes')?.getBoundingClientRect();
      const refresh = document.querySelector('.summary-refresh')?.getBoundingClientRect();
      return {
        picker: picker ? { left:picker.left, right:picker.right, width:picker.width } : null,
        select: select ? { left:select.left, right:select.right, width:select.width } : null,
        refresh: refresh ? { width:refresh.width, height:refresh.height } : null
      };
    });
    expect(headerLayout.picker).not.toBeNull();
    expect(headerLayout.select).not.toBeNull();
    expect(headerLayout.picker.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(headerLayout.select.right).toBeLessThanOrEqual(viewport.width + 1);
    if (viewport.width <= 680) {
      expect(headerLayout.select.width).toBeGreaterThanOrEqual(92);
      await expect(page.locator('.topbar-create span')).toBeVisible();
      await expect(page.locator('.topbar-create')).toHaveText('Novo gasto');
    }

    await expect(page.locator('.metric-grid')).toBeVisible();
    await page.locator('nav [data-app-nav="assistente"]:visible').first().click();
    await expect(page.locator('#radar-financeiro')).toBeVisible();
    await page.screenshot({ path: 'test-results/assistant-' + viewport.name + '.png', fullPage: true });
    await expect(page.locator('#projecaoMesValor')).not.toHaveText('—');
    await expect(page.locator('#insightsLista')).toBeVisible();
    const insightItems = page.locator('#insightsLista .behavior-insight');
    await expect(insightItems).toHaveCount(1);
    await expect(page.locator('#insightsCount')).toContainText('1 sinal');
    await expect(insightItems.first()).toContainText('Aluguel ainda não apareceu');
    const insightToggle = insightItems.first().locator('.behavior-insight__summary');
    await insightToggle.click();
    await expect(insightToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(insightItems.first().locator('.behavior-insight__details')).toBeVisible();
    await expect(insightItems.first().locator('.behavior-insight__details')).toContainText('Confiança');
    await insightToggle.click();
    await expect(insightToggle).toHaveAttribute('aria-expanded', 'false');

    await page.locator('[data-entry-open]:visible').last().click();
    await expect(page.locator('#entryChoiceDialog')).toBeVisible();
    await page.locator('[data-entry-target="lancar"]').click();
    await expect(page.locator('.metric-grid')).toBeHidden();
    await expect(page.locator('.overview-grid')).toBeHidden();
    await expect(page.locator('#radar-financeiro')).toBeHidden();
    await expect(page.locator('#smartEntryPanel')).toBeVisible();
    await expect(page.locator('#btnSmartScanner')).toBeVisible();
    await page.evaluate(() => window.GastosScanner.open('receipt'));
    await expect(page.locator('#smartScannerBackdrop')).toBeVisible();
    await expect(page.locator('#smartScannerModeReceipt')).toHaveClass(/is-active/);
    await page.evaluate(() => window.GastosScanner.previewReceiptText(
      'MERCADO CENTRAL LTDA\nARROZ TIPO 1 25,90\nFEIJAO CARIOCA 8,50\nLEITE INTEGRAL 6,49\nVALOR TOTAL R$ 40,89\n19/09/2026'
    ));
    await expect(page.locator('#smartScannerResult')).toBeVisible();
    await expect(page.locator('#smartScannerResultTitle')).toHaveText('Cupom interpretado');
    await expect(page.locator('#smartScannerItems .scanner-item-row')).toHaveCount(3);
    await expect(page.locator('#smartScannerItems')).toContainText('ARROZ TIPO 1');
    await expect(page.locator('#smartScannerGallery')).toBeVisible();
    await expect(page.locator('#smartScannerContinue')).toBeVisible();
    if (viewport.name === 'mobile-large' || viewport.name === 'desktop') {
      await page.screenshot({ path: 'test-results/scanner-' + viewport.name + '.png', fullPage: true });
    }
    await page.locator('#smartScannerContinue').click();
    await expect(page.locator('#smartScannerBackdrop')).toBeHidden();
    await expect(page.locator('#smartEntryPreview')).toBeVisible();
    await expect(page.locator('#smartEntryDescricao')).toHaveText('Itens: ARROZ TIPO 1; FEIJAO CARIOCA; LEITE INTEGRAL');
    await expect(page.locator('#smartEntryValor')).toContainText('40,89');
    await expect(page.locator('#smartEntryEstabelecimento')).toHaveText('MERCADO CENTRAL LTDA');

    await fillField(page.locator('#smartEntryText'), '');
    await page.locator('#btnFalarSmart').click();
    await expect(page.locator('#smartEntryText')).toHaveValue(/87,50/);
    await expect(page.locator('#smartEntryPreview')).toBeVisible();
    await expect(page.locator('#smartEntryValor')).toHaveText(/87,50/);
    await expect(page.locator('#smartEntryDescricao')).toHaveText('Mercado');

    await page.evaluate(async () => {
      await window.GastosReceiptImport.inspect({
        qrPayload:'https://www.nfce.sefin.ro.gov.br/?p=11260904082624000822650100009174851071923795'
      });
    });
    await expect(page.locator('#receiptEvidencePanel')).toBeVisible();
    await expect(page.locator('#receiptEvidenceStatus')).toContainText('QR fiscal');
    await expect(page.locator('#receiptEvidenceIssuer')).toContainText('Irmãos Gonçalves');
    await expect(page.locator('#receiptVerifyButton')).toBeVisible();
    if (viewport.name === 'mobile-large' || viewport.name === 'desktop') {
      await page.screenshot({ path: 'test-results/receipt-evidence-' + viewport.name + '.png', fullPage: true });
    }

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      font: getComputedStyle(document.body).fontFamily,
      cardRadius: getComputedStyle(document.querySelector('.surface-card')).borderRadius,
      primaryMinHeight: parseFloat(getComputedStyle([...document.querySelectorAll('.btn--primary')].find(el => el.offsetParent !== null)).minHeight),
      iconButtonSize: parseFloat(getComputedStyle([...document.querySelectorAll('.icon-btn')].find(el => el.offsetParent !== null)).width),
      toolbarRadius: parseFloat(getComputedStyle(document.querySelector('.header-actions')).borderRadius),
      toolbarDisplay: getComputedStyle(document.querySelector('.header-actions')).display,
      smartInputFontSize: parseFloat(getComputedStyle(document.querySelector('#smartEntryText')).fontSize),
      manualInputFontSize: parseFloat(getComputedStyle(document.querySelector('#inputDescricao')).fontSize)
    }));

    await page.locator('nav [data-app-nav="ajustes"]:visible').first().click();
    await expect(page.locator('.metric-grid')).toBeHidden();
    await expect(page.locator('.overview-grid')).toBeHidden();
    await expect(page.locator('#radar-financeiro')).toBeHidden();
    await expect(page.locator('#configuracoes')).toBeVisible();
    await expect(page.locator('#listaSmartRules')).toContainText('posto trevo');
    await page.locator('nav [data-app-nav="assistente"]:visible').first().click();
    await expect(page.locator('#smartMetricInterpretacoes')).toHaveText('12');
    await expect(page.locator('#smartMetricSemCorrecao')).toContainText('77,8');

    await page.locator('nav [data-app-nav="casa"]:visible').first().click();
    await page.locator('[data-house-tab="planejamento"]').click();
    const recurringUse = page.locator('button[title="Lançar agora"]').first();
    await expect(recurringUse).toBeVisible();
    await recurringUse.click();
    await expect(page.locator('body')).toHaveAttribute('data-app-view', 'lancar');
    await expect(page.locator('#formGasto')).toBeVisible();
    await expect(page.locator('#inputValor')).not.toHaveValue('');

    await page.locator('nav [data-app-nav="casa"]:visible').first().click();
    await page.locator('[data-house-tab="despesas"]').click();
    await expect(page.locator('.metric-grid')).toBeHidden();
    await expect(page.locator('.overview-grid')).toBeHidden();
    await expect(page.locator('#radar-financeiro')).toBeHidden();
    await expect(page.locator('.history-card')).toBeVisible();

    const editAction = page.locator('.history-card button[title="Editar"]:visible').first();
    await expect(editAction).toBeVisible();
    await editAction.click();
    await expect(page.locator('body')).toHaveAttribute('data-app-view', 'lancar');
    await expect(page.locator('#formGasto')).toBeVisible();
    await expect(page.locator('#btnSubmit')).toContainText('Salvar Edição');
    await expect(page.locator('#inputDescricao')).not.toHaveValue('');
    await expect(page.locator('#btnCancelarEdicao')).toBeVisible();
    await page.locator('#btnCancelarEdicao').click();

    await page.locator('nav [data-app-nav="casa"]:visible').first().click();
    const duplicateAction = page.locator('.history-card button[title="Duplicar"]:visible').first();
    await expect(duplicateAction).toBeVisible();
    await duplicateAction.click();
    await expect(page.locator('body')).toHaveAttribute('data-app-view', 'lancar');
    await expect(page.locator('#formGasto')).toBeVisible();
    await expect(page.locator('#inputDescricao')).not.toHaveValue('');

    await page.locator('nav [data-app-nav="casa"]:visible').first().click();
    const dangerAction = page.locator('.table-action--danger').first();
    if (await dangerAction.isVisible()) {
      await dangerAction.click();
      const dialog = page.locator('#confirmDialog');
      await expect(dialog).toBeVisible();
      await expect(page.locator('#confirmCancel')).toBeFocused();
      const dialogRect = await page.locator('#confirmDialog .dialog').boundingBox();
      expect(dialogRect).not.toBeNull();
      expect(dialogRect.width).toBeLessThanOrEqual(viewport.width);
      expect(dialogRect.height).toBeLessThanOrEqual(viewport.height);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.font.toLowerCase()).toMatch(/manrope/);
    expect(parseFloat(metrics.cardRadius)).toBeGreaterThan(8);
    expect(metrics.primaryMinHeight).toBeGreaterThanOrEqual(42);
    expect(metrics.iconButtonSize).toBeGreaterThanOrEqual(38);
    expect(metrics.toolbarRadius).toBeGreaterThanOrEqual(0);
    expect(metrics.toolbarDisplay).toBe(viewport.width <= 900 ? 'contents' : 'flex');

    if (viewport.width <= 900) {
      expect(metrics.smartInputFontSize).toBeGreaterThanOrEqual(16);
      expect(metrics.manualInputFontSize).toBeGreaterThanOrEqual(16);
      await expect(page.locator('.mobile-nav')).toBeVisible();
      await page.locator('.mobile-nav a[data-app-nav="ajustes"]').click();
      await expect(page.locator('#configuracoes')).toBeVisible();
    }

    await page.screenshot({ path: 'test-results/' + viewport.name + '.png', fullPage: true });
  });
}


test('lançamento manual anterior continua salvando sem depender do scanner', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let posted = null;
  await mockBackend(page, { onExpensePost: payload => { posted = payload; } });
  await page.goto('/index.html');
  await expect(page.locator('#cardTotal')).not.toHaveText('R$ 0,00', { timeout: 10000 });
  await page.locator('[data-entry-open]:visible').last().click();
    await expect(page.locator('#entryChoiceDialog')).toBeVisible();
    await page.locator('[data-entry-target="lancar"]').click();

  await fillField(page.locator('#inputData'), '2026-09-22');
  await fillField(page.locator('#inputValor'), '42.50');
  await fillField(page.locator('#inputDescricao'), 'Compra manual de teste');
  await page.locator('#inputCategoria').selectOption({ label:'Mercado' });
  await page.locator('#inputFormaPagamento').selectOption('Dinheiro');
  await page.locator('#btnSubmit').click();

  await expect.poll(() => posted).not.toBeNull();
  expect(posted).toMatchObject({
    dataGasto:'2026-09-22',
    valor:42.5,
    descricao:'Compra manual de teste',
    categoria:'Mercado',
    formaPagamento:'Dinheiro'
  });
  expect(posted.receipt).toBeNull();
});


test('login permanece centralizado no mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', route => route.abort());
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());

  await page.route(BACKEND + '/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const respond = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
    if (path === '/features') return respond({
      smartEntry: true,
      smartEntryLearning: true,
      smartEntryTelemetry: true,
      smartEntryParser: 'rules-learning-history-v4',
      smartEntryAiConfigured: false
    });
    if (path === '/health') return respond({ ok:true });
    if (path === '/login') return respond({ message:'Credenciais inválidas.' }, 401);
    return respond({ message:'Não autenticado.' }, 401);
  });

  await page.goto('/index.html');
  const overlay = page.locator('#authOverlay');
  const card = page.locator('#authOverlay .auth-card');
  await expect(overlay).toBeVisible();
  await expect(card).toBeVisible();

  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  const centerY = box.y + box.height / 2;
  expect(Math.abs(centerY - 844 / 2)).toBeLessThan(70);
  expect(box.y).toBeGreaterThan(12);
  expect(box.y + box.height).toBeLessThan(844 - 12);

  const emailSize = await page.locator('#authEmail').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(emailSize).toBeGreaterThanOrEqual(16);
  await page.screenshot({ path:'test-results/login-mobile.png', fullPage:true });
});

for (const width of [390, 1366]) {
  test('carteira privada CRUD sem misturar com casa ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockBackend(page);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let wallets = [], expenses = [], personalPost = null, sharedWrites = 0, rejectLimit = false;
    await page.route(url => url.origin === new URL(BACKEND).origin && url.pathname.startsWith('/wallets'), async route => {
      const url = new URL(route.request().url());
      const payload = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
      let answer;
      if (url.pathname === '/wallets' && payload?.action === 'update' && rejectLimit) {
        rejectLimit = false;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Não foi possível salvar o limite. Tente novamente.' }) });
        return;
      }
      if (url.pathname === '/wallets') {
        if (payload?.action === 'add') wallets = [{ id: 'w1', nome: payload.nome, limite_mensal: payload.limiteMensal }];
        if (payload?.action === 'update') wallets[0] = { ...wallets[0], nome: payload.nome, limite_mensal: payload.limiteMensal };
        if (payload?.action === 'delete') wallets = [];
        answer = { wallets };
      } else if (url.pathname === '/wallets/insights') answer = { explanation: { source: 'ai', cached: true, text: 'Revise o delivery desta semana.', usage: null } };
      else if (payload) {
        personalPost = payload;
        if (payload.action === 'add') expenses = [{ id: 'e1', data: payload.dataGasto, valor: payload.valor, descricao: payload.descricao, categoria: payload.categoria }];
        if (payload.action === 'update') expenses[0] = { ...expenses[0], data: payload.dataGasto, valor: payload.valor, descricao: payload.descricao, categoria: payload.categoria };
        if (payload.action === 'delete') expenses = [];
        answer = { expenses };
      } else answer = { expenses, aiConfigured: true, plan: { spent: expenses.reduce((n, e) => n + e.valor, 0), budget: wallets[0]?.limite_mensal || 0, remaining: (wallets[0]?.limite_mensal || 0) - expenses.reduce((n, e) => n + e.valor, 0), daily: 15, signals: expenses.length ? [{ type: 'delivery_opportunity', amount: 40, action: 'Simule reduzir delivery.' }] : [] } };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
    });
    page.on('request', request => { if (request.url() === BACKEND + '/expenses' && request.method() === 'POST') sharedWrites++; });
    await page.goto('/index.html');
    await expect(page.locator('#cardTotal')).not.toHaveText('R$ 0,00');
    const sharedTotal = await page.locator('#homeHouseTotal').textContent();
    await page.locator('nav [data-app-nav="carteiras"]:visible').first().click();
    await expect(page.locator('#personalWallets')).toBeVisible();
    await page.locator('#walletEmptyCreate').click();
    await fillField(page.locator('#walletName'), 'Dia a dia'); await fillField(page.locator('#walletLimit'), '500');
    await page.locator('#walletCreateForm [type="submit"]').click();
    await expect(page.locator('#walletControls')).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    if (width === 390) {
      const remaining = await page.locator('#walletRemaining').boundingBox();
      const register = await page.locator('#walletAddExpense').boundingBox();
      expect(remaining.y + remaining.height).toBeLessThan(764);
      expect(register.y + register.height).toBeLessThan(764);
    }
    await page.locator('#walletAddExpense').click();
    await fillField(page.locator('#walletExpenseDate'), '2026-10-11'); await fillField(page.locator('#walletExpenseValue'), '200');
    await fillField(page.locator('#walletExpenseDescription'), 'Minha compra pessoal'); await page.locator('#walletExpenseCategory').selectOption('Ifood');
    await page.locator('#walletExpenseSubmit').click();
    await expect(page.locator('#walletExpenseList')).toContainText('Minha compra pessoal');
    expect(personalPost.walletId).toBe('w1'); expect(sharedWrites).toBe(0);
    await expect(page.locator('.vault-advisor')).not.toHaveAttribute('open', '');
    await page.locator('#walletViewExpenses').click();
    await expect(page.locator('#walletMovements')).toBeFocused();
    await page.locator('#walletEditLimit').click();
    await expect(page.locator('#walletSettings')).toBeVisible();
    await fillField(page.locator('#walletManageLimit'), '600');
    rejectLimit = true;
    await page.locator('#walletManageForm [type=submit]').click();
    await expect(page.locator('#walletSettings [data-wallet-status]')).toContainText('Não foi possível salvar');
    await expect(page.locator('#walletSettings')).toBeVisible();
    expect(wallets[0].limite_mensal).toBe(500);
    await page.locator('#walletManageForm [type=submit]').click();
    await expect(page.locator('#walletSettings')).toBeHidden();
    expect(wallets[0].limite_mensal).toBe(600);
    await page.locator('.vault-advisor summary').click();
    await page.locator('#walletAiButton').click(); await expect(page.locator('#walletAiText')).toContainText('Revise o delivery');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: 'test-results/cofre-filled-' + width + '.png', fullPage: true });
    await page.locator('#walletExpenseList button', { hasText: 'Editar' }).click();
    await fillField(page.locator('#walletExpenseValue'), '180'); await page.locator('#walletExpenseSubmit').click();
    await expect(page.locator('#walletExpenseList')).toContainText('180,00');
    await page.locator('#walletExpenseList button', { hasText: 'Excluir' }).click();
    await expect(page.locator('#confirmDialog')).toBeVisible(); await page.locator('#confirmAccept').click();
    await expect(page.locator('#walletExpenseList')).toContainText('Nenhum gasto');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: 'test-results/wallets-' + width + '.png', fullPage: true });
    await page.locator('#walletEditLimit').click();
    await page.locator('#walletDelete').click();
    await expect(page.locator('#walletSettings')).toBeHidden();
    await expect(page.locator('#confirmDialog')).toBeVisible();
    await page.locator('#confirmCancel').click();
    await expect(page.locator('#walletSettings')).toBeVisible();
    await expect(page.locator('#walletDelete')).toBeFocused();
    await page.locator('#walletDelete').click();
    await page.locator('#confirmAccept').click();
    await expect(page.locator('#walletEmptyView')).toBeVisible();
    await expect(page.locator('#walletSettings')).toBeHidden();
    await page.locator('nav [data-app-nav="resumo"]:visible').first().click();
    await expect(page.locator('#personalWallets')).toBeHidden(); await expect(page.locator('#homeHouseTotal')).toHaveText(sharedTotal);
    expect(errors).toEqual([]);
  });
}

test('assistente interpreta com revisão e links antigos encontram a nova área', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  await page.goto('/index.html#movimentacoes');
  await expect(page.locator('.history-card')).toBeVisible();
  await expect(page.locator('#homeView')).toBeHidden();
  await page.locator('nav [data-app-nav="assistente"]:visible').first().click();
  await fillField(page.locator('#assistantText'), 'Paguei 87,50 no mercado hoje no PIX');
  await page.locator('#assistantComposer [type="submit"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-view', 'lancar');
  await expect(page.locator('#smartEntryPreview')).toBeVisible();
  await expect(page.locator('#smartEntryValor')).toContainText('87,50');
  await page.locator('[data-entry-open]:visible').last().click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#entryChoiceDialog')).toBeHidden();
  await page.evaluate(() => { location.hash = 'mais'; });
  await expect(page.locator('#configuracoes')).toBeVisible();
  await expect(page.locator('#personalWallets')).toBeHidden();
});

for (const width of [390, 1366]) {
  test('configuração individual Gemini e DeepSeek com teste e remoção ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await mockBackend(page);
    let settings = null; const posts = []; const key = 'fake-key-for-ui-testing';
    await page.route(url => url.origin === new URL(BACKEND).origin && url.pathname === '/ai/settings', async route => {
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
      let result;
      if (!body) result = { settings, providers: AI_PROVIDERS, storageReady: true };
      else {
        posts.push(body);
        if (body.action === 'test') result = { connection: { ok: true } };
        else {
          settings = body.action === 'delete' ? null : { provider: body.provider, model: body.model, hasKey: true };
          result = { settings };
        }
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    });
    await page.goto('/index.html#ajustes');
    await expect(page.locator('#aiModel')).toHaveValue(AI_PROVIDERS[0].models[0].id);
    await fillField(page.locator('#aiApiKey'), key);
    await page.locator('#aiTest').click(); await expect(page.locator('#aiSettingsStatus')).toContainText('Conexão confirmada');
    expect(settings).toBeNull();
    await page.locator('#aiSave').click(); await expect(page.locator('#aiConnectionBadge')).toHaveText('Chave salva');
    await expect(page.locator('#aiApiKey')).toHaveValue('');
    await page.locator('#aiModel').selectOption(AI_PROVIDERS[0].models[1].id);
    await page.locator('#aiSave').click();
    await expect.poll(() => settings?.model).toBe(AI_PROVIDERS[0].models[1].id);
    expect(posts.at(-1)).not.toHaveProperty('apiKey');
    await page.locator('#aiProvider').selectOption('deepseek');
    await expect(page.locator('#aiModel')).toHaveValue('deepseek-flash');
    await expect(page.locator('#aiApiKey')).toHaveAttribute('required', '');
    await fillField(page.locator('#aiApiKey'), key + '-deepseek'); await page.locator('#aiSave').click();
    await expect.poll(() => settings?.provider).toBe('deepseek');
    expect(await page.evaluate(secret => Object.values(localStorage).some(v => v.includes(secret)), key)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: 'test-results/ai-settings-' + width + '.png', fullPage: true });
    await page.locator('#aiRemove').click(); await page.locator('#confirmAccept').click();
    await expect(page.locator('#aiConnectionBadge')).toHaveText('Não conectada'); expect(settings).toBeNull();
    await page.locator('[data-entry-open]:visible').last().click(); await page.locator('[data-entry-target="carteiras"]').click();
    await expect(page.locator('#walletCreateDialog')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('#walletCreateDialog')).toBeHidden();
  });
}


for (const width of [320, 640]) {
  test('ações legíveis e contraste no espaço compacto ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await mockBackend(page);
    await page.goto('/index.html');
    await expect(page.locator('#homeHouseTotal')).not.toHaveText('—');
    await expect(page.locator('.topbar-create span')).toBeVisible();
    const measurements = await page.evaluate(() => {
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const nav = document.querySelector('.mobile-nav [data-app-nav="ajustes"]');
      return {
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        actionHeight: document.querySelector('.topbar-create').getBoundingClientRect().height,
        actionFont: parseFloat(getComputedStyle(document.querySelector('.topbar-create')).fontSize),
        bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
        navFont: parseFloat(getComputedStyle(nav.querySelector('span')).fontSize),
        navContrast: 1.05 / (luminance(getComputedStyle(nav).color) + .05)
      };
    });
    expect(measurements.overflow).toBe(false);
    expect(measurements.actionHeight).toBeGreaterThanOrEqual(48);
    expect(measurements.actionFont).toBeGreaterThanOrEqual(16);
    expect(measurements.bodyFont).toBeGreaterThanOrEqual(16);
    expect(measurements.navFont).toBeGreaterThanOrEqual(12);
    expect(measurements.navContrast).toBeGreaterThanOrEqual(4.5);
    await page.locator('.topbar-create').click();
    await expect(page.locator('#entryChoiceDialog')).toBeVisible();
    await page.locator('#entryChoiceClose').click();
    await expect(page.locator('#entryChoiceDialog')).toBeHidden();
    await expect(page.locator('.topbar-create')).toBeFocused();
    // Static guidance stays readable while monthly values are loading.
    const guidance = page.locator('.home-heading .view-panel-description');
    await page.evaluate(() => document.body.classList.add('app-loading'));
    await expect(guidance).toBeVisible();
    expect(await guidance.evaluate(node => getComputedStyle(node).color)).not.toBe('rgba(0, 0, 0, 0)');
    await page.evaluate(() => document.body.classList.remove('app-loading'));
    for (const view of ['resumo', 'casa', 'carteiras', 'assistente', 'ajustes', 'lancar']) {
      await page.evaluate(view => GastosNavigation.show(view, { instant: true }), view);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), view).toBe(true);
    }
    await page.evaluate(() => GastosNavigation.showAndReveal('lancar', '#formGasto', { instant: true }));
    await expect.poll(() => page.evaluate(() => {
      const top = document.querySelector('[data-app-section="lancar"]').getBoundingClientRect().top;
      const toolbarBottom = document.querySelector('.app-header').getBoundingClientRect().bottom;
      return top >= toolbarBottom && top <= toolbarBottom + 32;
    })).toBe(true);
    for (const id of ['btnFalarSmart', 'btnSmartScanner', 'btnInterpretarSmart']) {
      const button = page.locator('#' + id);
      await expect(button).toBeVisible();
      expect(await button.evaluate(node => node.scrollWidth <= node.clientWidth + 1), id).toBe(true);
      await expect(button.locator('svg use')).toHaveAttribute('href', /^#i-/);
    }
    await page.screenshot({ path: 'test-results/readable-' + width + '.png', fullPage: true });
  });
}

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 600 }, { width: 1366, height: 768 }]) {
  test(`todos os modais com foco, Escape, rolagem e bloqueio ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport); await mockBackend(page); await page.goto('/index.html');
    await expect(page.locator('#homeHouseTotal')).toContainText('366');
    const ids = await page.locator('dialog.app-modal').evaluateAll(nodes => nodes.map(node => node.id));
    expect(ids.sort()).toEqual(['chartDetailsDialog', 'confirmDialog', 'entryChoiceDialog', 'settlementDialog', 'smartScannerBackdrop', 'walletCreateDialog', 'walletExpenseDialog', 'walletSettings', 'walletSimulatorDialog'].sort());
    for (const id of ids) {
      await page.locator('[data-entry-open]:visible').first().focus();
      await page.evaluate(id => AppUI.openModal(id), id);
      const dialog = page.locator('#' + id);
      await expect(dialog).toBeVisible();
      const metrics = await dialog.evaluate(node => {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, overflow: node.scrollWidth > node.clientWidth + 1,
          focusInside: node.contains(document.activeElement), labelled: Boolean(document.getElementById(node.getAttribute('aria-labelledby'))), locked: document.body.classList.contains('dialog-open') };
      });
      expect(metrics.x).toBeGreaterThanOrEqual(0); expect(metrics.y).toBeGreaterThanOrEqual(0);
      expect(metrics.right).toBeLessThanOrEqual(viewport.width + 1); expect(metrics.bottom).toBeLessThanOrEqual(viewport.height + 1);
      expect(metrics.overflow).toBe(false); expect(metrics.focusInside).toBe(true); expect(metrics.labelled).toBe(true); expect(metrics.locked).toBe(true);
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
      await page.evaluate(id => AppUI.setModalBusy(id, true), id);
      await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
      await page.evaluate(id => AppUI.setModalBusy(id, false), id);
      await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
      await expect(page.locator('[data-entry-open]:visible').first()).toBeFocused();
      await expect(page.locator('body')).not.toHaveClass(/dialog-open/);
    }
    await page.evaluate(() => GastosScanner.open('receipt'));
    await expect(page.locator('#smartScannerBackdrop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#smartScannerBackdrop')).toBeHidden();
    expect(await page.locator('#smartScannerVideo').evaluate(node => node.srcObject)).toBeNull();
  });
}

test('gráficos exploráveis incluem terceiro morador e respeitam carteira e mês', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockBackend(page);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const writes = []; page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/wallets')) writes.push(request.url()); });
  await page.route(BACKEND + '/expenses?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ expenses: [
    { id: 'm1', data: '2026-09-21', usuario: 'Maria Silva', valor: 50, descricao: 'Gasto da Maria', categoria: 'Mercado', forma_pagamento: 'Dinheiro' }
  ] }) }));
  const expenses = [
    { id: 'p1', data: '2026-09-20', valor: 150, descricao: 'Minha compra', categoria: 'Mercado' },
    { id: 'p2', data: '2026-09-21', valor: 50, descricao: 'Meu delivery', categoria: 'Ifood' },
    { id: 'p3', data: '2026-09-22', valor: 20, descricao: 'Meu café', categoria: 'Outros' }
  ];
  await page.route(BACKEND + '/wallets', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ wallets: [{ id: 'w1', nome: 'Pessoal', limite_mensal: 600 }, { id: 'w2', nome: 'Outra carteira', limite_mensal: 100 }] }) }));
  let overBudget = false;
  await page.route(BACKEND + '/wallets/expenses?**', route => {
    const url = new URL(route.request().url()); const month = url.searchParams.get('month'); const walletId = url.searchParams.get('walletId');
    const rows = month === '2026-09' && walletId === 'w1' ? expenses : [];
    const budget = walletId === 'w1' ? (overBudget ? 200 : 600) : 100;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ expenses: rows, plan: { month, spent: rows.length ? 220 : 0, budget, remaining: Math.max(0, budget - (rows.length ? 220 : 0)), daily: rows.length ? 42.22 : 11.11, remainingDays: 9, count: rows.length, signals: [] } }) });
  });
  await page.goto('/index.html'); await expect(page.locator('#homeHouseTotal')).toContainText('50,00');
  await page.locator('nav [data-app-nav="casa"]:visible').first().click();
  await expect(page.locator('#cardTotal')).toContainText('50,00');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); gerarResumo(); });
  await expect(page.locator('#confirmDialog')).toBeVisible();
  await expect(page.locator('#confirmMessage')).toContainText('Maria Silva');
  await page.keyboard.press('Escape');
  await page.locator('#chartDivisao button', { hasText: 'Maria Silva' }).click();
  await expect(page.locator('#chartDetailsTitle')).toHaveText('Maria Silva');
  await expect(page.locator('#chartDetailsList')).toContainText('Gasto da Maria');
  await page.keyboard.press('Escape');
  await page.evaluate(() => GastosNavigation.showHouse('despesas'));
  await expect(page.locator('#tabelaHistorico')).toContainText('Maria Silva');
  await page.locator('#filtroUsuario').selectOption('Maria Silva'); await expect(page.locator('#filtroTotal')).toContainText('50,00');
  await page.locator('nav [data-app-nav="carteiras"]:visible').first().click();
  await expect(page.locator('#walletSpent')).toContainText('220,00');
  await expect(page.locator('#walletForecastValue')).toContainText('300,00');
  await page.locator('.wallet-chart-details summary').click();
  await page.locator('#walletCategoryChart button', { hasText: 'Mercado' }).click();
  await expect(page.locator('#chartDetailsList')).toContainText('Minha compra');
  await expect(page.locator('#chartDetailsList')).not.toContainText('Gasto da Maria');
  await page.keyboard.press('Escape');
  await expect(page.locator('#chartDetailsList')).toBeEmpty();
  await page.locator('#walletSimulatorOpen').click();
  await fillField(page.locator('#walletSimulatorAmount'), '150'); await fillField(page.locator('#walletSimulatorReserve'), '100');
  await page.locator('#walletSimulatorForm [type="submit"]').click();
  await expect(page.locator('#walletSimulatorResult')).toContainText('A compra cabe');
  await expect(page.locator('#walletSimulatorResult')).toContainText('14,44');
  const simulatorBounds = await page.locator('#walletSimulatorDialog').boundingBox();
  expect(simulatorBounds.y).toBeGreaterThanOrEqual(0);
  expect(simulatorBounds.y + simulatorBounds.height).toBeLessThanOrEqual(844);
  await page.locator('#walletSimulatorResult').scrollIntoViewIfNeeded();
  await fillField(page.locator('#walletSimulatorAmount'), '500'); await page.locator('#walletSimulatorForm [type="submit"]').click();
  await expect(page.locator('#walletSimulatorResult')).toContainText('ultrapassa o limite em');
  await page.keyboard.press('Escape'); expect(writes).toEqual([]);
  overBudget = true; await page.locator('#walletRefresh').click();
  await expect(page.locator('#walletBudgetAlert')).toBeVisible();
  await expect(page.locator('#walletBudgetAlert')).toContainText('20,00');
  await expect(page.locator('.vault-advisor')).not.toHaveAttribute('open', '');
  await page.locator('#walletSelect').selectOption('w2');
  await expect(page.locator('#walletSpent')).toContainText('0,00');
  await expect(page.locator('#walletCategoryChart')).not.toContainText('Minha compra');
  await expect(page.locator('#walletBudgetAlert')).toBeHidden();
  await fillField(page.locator('#walletMonth'), '2026-08');
  await expect(page.locator('#walletForecastValue')).toContainText('Ainda sem estimativa');
  expect(errors).toEqual([]);
});
