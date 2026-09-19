import { test, expect } from '@playwright/test';

const BACKEND = 'https://br-polished-voice-a5flam43-gastospwa.compute.c-1.us-east-2.aws.neon.tech';

const viewports = [
  { name: 'mobile-small', width: 360, height: 740 },
  { name: 'mobile-large', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'notebook', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 }
];

async function mockBackend(page) {
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

    if (path === '/features') return respond({
      smartEntry: true,
      smartEntryLearning: true,
      smartEntryTelemetry: true,
      smartEntryParser: 'rules-learning-history-v4',
      smartEntryAiConfigured: false
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
      const month = url.searchParams.get('month');
      const current = month === '09/2026';
      return respond({ expenses: current ? [
        { id:'1', data:'2026-09-18', usuario:'Paulo Henrique', valor:180.50, descricao:'Mercado da semana', categoria:'Mercado', forma_pagamento:'Dinheiro' },
        { id:'2', data:'2026-09-12', usuario:'Fernando Gustavo', valor:120.00, descricao:'Internet', categoria:'Contas', forma_pagamento:'Dinheiro' },
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
    await expect(page.locator('.surface-card').first()).toBeVisible();
    await expect(page.locator('#radar-financeiro')).toBeVisible();
    await expect(page.locator('#projecaoMesValor')).not.toHaveText('—');

    await page.locator('[data-app-nav="lancar"]:visible').first().click();
    await expect(page.locator('#smartEntryPanel')).toBeVisible();
    await expect(page.locator('#btnSmartScanner')).toBeVisible();
    await page.evaluate(() => window.GastosScanner.open('receipt'));
    await expect(page.locator('#smartScannerBackdrop')).toBeVisible();
    await expect(page.locator('#smartScannerModeReceipt')).toHaveClass(/is-active/);
    await page.locator('#smartScannerClose').click();
    await expect(page.locator('#smartScannerBackdrop')).toBeHidden();

    await page.locator('#smartEntryText').fill('');
    await page.locator('#btnFalarSmart').click();
    await expect(page.locator('#smartEntryText')).toHaveValue(/87,50/);
    await expect(page.locator('#smartEntryPreview')).toBeVisible();
    await expect(page.locator('#smartEntryValor')).toHaveText(/87,50/);
    await expect(page.locator('#smartEntryDescricao')).toHaveText('Mercado');

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

    await page.locator('[data-app-nav="mais"]:visible').first().click();
    await expect(page.locator('#configuracoes')).toBeVisible();
    await expect(page.locator('#listaSmartRules')).toContainText('posto trevo');
    await expect(page.locator('#smartMetricInterpretacoes')).toHaveText('12');
    await expect(page.locator('#smartMetricSemCorrecao')).toContainText('77,8');

    const recurringUse = page.locator('button[title="Lançar agora"]').first();
    await expect(recurringUse).toBeVisible();
    await recurringUse.click();
    await expect(page.locator('body')).toHaveAttribute('data-app-view', 'lancar');
    await expect(page.locator('#formGasto')).toBeVisible();
    await expect(page.locator('#inputValor')).not.toHaveValue('');

    await page.locator('[data-app-nav="movimentacoes"]:visible').first().click();
    await expect(page.locator('.history-card')).toBeVisible();

    const editAction = page.locator('button[title="Editar"]').first();
    await expect(editAction).toBeVisible();
    await editAction.click();
    await expect(page.locator('body')).toHaveAttribute('data-app-view', 'lancar');
    await expect(page.locator('#formGasto')).toBeVisible();
    await expect(page.locator('#btnSubmit')).toContainText('Salvar Edição');
    await expect(page.locator('#inputDescricao')).not.toHaveValue('');
    await expect(page.locator('#btnCancelarEdicao')).toBeVisible();
    await page.locator('#btnCancelarEdicao').click();

    await page.locator('[data-app-nav="movimentacoes"]:visible').first().click();
    const duplicateAction = page.locator('button[title="Duplicar"]').first();
    await expect(duplicateAction).toBeVisible();
    await duplicateAction.click();
    await expect(page.locator('body')).toHaveAttribute('data-app-view', 'lancar');
    await expect(page.locator('#formGasto')).toBeVisible();
    await expect(page.locator('#inputDescricao')).not.toHaveValue('');

    await page.locator('[data-app-nav="movimentacoes"]:visible').first().click();
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
    expect(metrics.font.toLowerCase()).toContain('poppins');
    expect(parseFloat(metrics.cardRadius)).toBeGreaterThan(8);
    expect(metrics.primaryMinHeight).toBeGreaterThanOrEqual(42);
    expect(metrics.iconButtonSize).toBeGreaterThanOrEqual(38);
    expect(metrics.toolbarRadius).toBeGreaterThanOrEqual(10);
    expect(metrics.toolbarDisplay).toBe('flex');

    if (viewport.width <= 900) {
      expect(metrics.smartInputFontSize).toBeGreaterThanOrEqual(16);
      expect(metrics.manualInputFontSize).toBeGreaterThanOrEqual(16);
      await expect(page.locator('.mobile-nav')).toBeVisible();
      await page.locator('.mobile-nav a[data-app-nav="mais"]').click();
      await expect(page.locator('#configuracoes')).toBeVisible();
    }

    await page.screenshot({ path: 'test-results/' + viewport.name + '.png', fullPage: true });
  });
}


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
