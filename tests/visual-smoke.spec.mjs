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
  });

  await page.route(BACKEND + '/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const respond = body => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
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

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      font: getComputedStyle(document.body).fontFamily,
      cardRadius: getComputedStyle(document.querySelector('.surface-card')).borderRadius,
      primaryMinHeight: parseFloat(getComputedStyle([...document.querySelectorAll('.btn--primary')].find(el => el.offsetParent !== null)).minHeight),
      iconButtonSize: parseFloat(getComputedStyle([...document.querySelectorAll('.icon-btn')].find(el => el.offsetParent !== null)).width),
      toolbarRadius: parseFloat(getComputedStyle(document.querySelector('.header-actions')).borderRadius),
      toolbarDisplay: getComputedStyle(document.querySelector('.header-actions')).display
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.font.toLowerCase()).toContain('poppins');
    expect(parseFloat(metrics.cardRadius)).toBeGreaterThan(8);
    expect(metrics.primaryMinHeight).toBeGreaterThanOrEqual(42);
    expect(metrics.iconButtonSize).toBeGreaterThanOrEqual(38);
    expect(metrics.toolbarRadius).toBeGreaterThanOrEqual(10);
    expect(metrics.toolbarDisplay).toBe('flex');

    if (viewport.width <= 900) {
      await expect(page.locator('.mobile-nav')).toBeVisible();
      await page.locator('.mobile-nav a[href="#recorrentes"]').click();
      await expect(page.locator('#recorrentes')).toBeInViewport();
    }

    await page.screenshot({ path: 'test-results/' + viewport.name + '.png', fullPage: true });
  });
}
