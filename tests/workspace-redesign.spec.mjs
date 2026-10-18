import { test, expect } from '@playwright/test';
import { mockBackend, BACKEND } from './helpers/mock-backend.mjs';

test('busca filtra sem acento, abre planejamento por Enter e não altera dados financeiros', async ({ page }) => {
  await mockBackend(page);
  const mutations = [];
  page.on('request', req => { if (req.method() !== 'GET' && /\/(expenses|wallets|settlements|budgets)/.test(req.url())) mutations.push(req.url()); });
  await page.goto('/index.html');
  await expect(page.locator('#homeHouseTotal')).toContainText('R$');
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'O que você quer fazer?' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Buscar ação ou área' })).toBeFocused();
  await page.getByRole('searchbox', { name: 'Buscar ação ou área' }).fill('categoria');
  await expect(dialog.locator('.command-results button')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#orcamentoPanel')).toBeVisible();
  await expect(page.locator('#appViewTitle')).toBeFocused();
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox', { name: 'Buscar ação ou área' }).fill('visao');
  await expect(dialog.getByRole('button', { name: /Visão geral/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#homeTitle')).toBeFocused();
  expect(mutations).toEqual([]);
});

test('busca contém foco, mostra vazio e devolve foco ao fechar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockBackend(page); await page.goto('/index.html');
  const menu = page.getByLabel('Menu da conta', { exact: true });
  await menu.click();
  const trigger = page.getByRole('button', { name: 'Buscar ações' });
  await trigger.click();
  const dialog = page.locator('.command-dialog');
  await page.getByRole('searchbox', { name: 'Buscar ação ou área' }).fill('inexistente');
  await expect(dialog.getByRole('status')).toContainText('Nenhuma ação');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  for (let n = 0; n < 6; n++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  const rect = await dialog.boundingBox();
  expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(320);
  expect(rect.y + rect.height).toBeLessThanOrEqual(568);
  await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
});

test('atalho da busca respeita o modal de autenticação', async ({ page }) => {
  await mockBackend(page); await page.goto('/index.html');
  await page.route(BACKEND + '/session', route => route.fulfill({ status: 401, json: { message: 'Sessão encerrada' } }));
  await page.reload();
  await expect(page.locator('#authDialog')).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.locator('.command-dialog')).not.toBeVisible();
  expect(await page.locator('#authDialog').evaluate(node => node.contains(document.activeElement))).toBe(true);
});

test('gráfico do painel abre os lançamentos reais e atalho de acertos mostra pagamentos', async ({ page }) => {
  await mockBackend(page); await page.goto('/index.html');
  await page.getByRole('tab', {name:'Análises',exact:true}).click();
  await page.locator('#homeCategoryChart').getByRole('button', { name: /^Mercado:/ }).click();
  await expect(page.locator('#chartDetailsDialog')).toBeVisible();
  await expect(page.locator('#chartDetailsTotal')).toContainText('120,00');
  await expect(page.locator('#chartDetailsList')).toContainText('Mercado da semana');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', {name:'Agora',exact:true}).click();
  await page.getByRole('link', { name: 'Conferir e registrar pagamentos →' }).click();
  await expect(page.locator('.settlement-workspace')).toBeVisible();
  await expect(page.locator('#settlementHistoryList')).toContainText('PIX parcial');
  await expect(page.locator('.metric-grid')).toBeHidden();
});

for (const width of [320, 900, 1024, 1920]) test(`workspace mantém todas as áreas acessíveis em ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await mockBackend(page); await page.goto('/index.html');
  for (const view of ['casa', 'carteiras', 'assistente', 'ajustes', 'resumo']) {
    await page.locator(`nav [data-app-nav="${view}"]:visible`).click();
    await expect(page.locator('body')).toHaveAttribute('data-app-view', view);
    const nav = page.locator(width <= 900 ? '.mobile-nav' : '.desktop-nav');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
