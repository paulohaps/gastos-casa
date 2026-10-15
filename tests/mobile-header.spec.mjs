import { test, expect } from '@playwright/test';
import { mockBackend, BACKEND } from './helpers/mock-backend.mjs';

async function ready(page, width = 390) {
  await page.setViewportSize({ width, height: 844 });
  await mockBackend(page);
  await page.goto('/index.html');
  await expect(page.locator('#homeHouseTotal')).toContainText('366');
}

for (const width of [320, 390, 768]) {
  test(`cabeçalho em uma linha, mês sincronizado e cadastro acessível ${width}`, async ({ page }) => {
    await ready(page, width);
    const header = page.locator('.app-header');
    const menu = page.getByLabel('Menu da conta', { exact: true });
    const box = await header.boundingBox();
    expect(box.height).toBeLessThanOrEqual(65);
    const brand = await page.locator('.mobile-brand').boundingBox();
    const month = await page.locator('#seletorMes').boundingBox();
    const action = await menu.boundingBox();
    expect(month.x).toBeGreaterThanOrEqual(brand.x + brand.width);
    expect(month.x + month.width).toBeLessThanOrEqual(action.x);
    expect(month.height).toBeGreaterThanOrEqual(48);
    await expect(page.locator('#seletorMes option:checked')).toHaveText('09/2026');
    await expect(page.locator('#seletorMes option:checked')).toHaveAttribute('aria-label', '09/2026, mês atual');
    expect(action.height).toBeGreaterThanOrEqual(48);
    expect(month.y).toBe(action.y);
    await page.locator('#seletorMes').selectOption('08/2026');
    await expect(page.locator('#homeHouseTotal')).toContainText('290,00');
    await expect(page.locator('#homeRecentExpenses')).toContainText('Mercado');
    for (const view of ['resumo', 'casa', 'carteiras', 'ajustes']) {
      await page.evaluate(view => window.GastosNavigation.show(view), view);
      expect((await header.boundingBox()).height, view).toBeLessThanOrEqual(65);
      const fab = page.locator('.quick-expense-fab');
      await expect(fab).toBeVisible();
      const a = await fab.boundingBox(), b = await page.locator('.mobile-nav').boundingBox();
      expect(a.y + a.height).toBeLessThanOrEqual(b.y);
      await fab.click();
      await expect(page.locator('#entryChoiceDialog')).toBeVisible();
      await page.locator('#entryChoiceClose').click();
      await expect(fab).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.evaluate(() => window.GastosNavigation.show('lancar'));
    await expect(page.locator('.quick-expense-fab')).toBeHidden();
    await expect(page.locator('#inputValor')).toBeVisible();
    await menu.click();
    await page.locator('.header-menu-create').click();
    await expect(page.locator('#entryChoiceDialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#entryChoiceDialog')).toBeHidden();
    await expect(menu).toBeFocused();
    await page.evaluate(() => window.GastosNavigation.show('assistente'));
    await expect(header).toBeHidden();
    await page.getByRole('link', { name: 'Voltar ao Início' }).click();
    await expect(header).toBeVisible();
  });
}

test('menu mobile mantém tema, busca, conta e saída com teclado e fechamento previsível', async ({ page }) => {
  await ready(page);
  const menu = page.getByLabel('Menu da conta', { exact: true });
  const panel = page.locator('.header-menu__panel');
  await expect(panel).toBeHidden();
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Ativar tema claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(panel).toBeHidden();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await menu.click();
  await page.getByRole('button', { name: 'Buscar ações', exact: true }).click();
  await expect(page.locator('#commandDialog')).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('searchbox', { name: 'Buscar ação ou área' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await page.mouse.click(24, 350);
  await expect(panel).toBeHidden();
  await menu.click();
  await page.getByRole('link', { name: 'Minha conta e preferências' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-app-view', 'ajustes');
  await expect(panel).toBeHidden();
  await expect(menu).toBeFocused();
  let logouts = 0;
  await page.route(BACKEND + '/logout', route => { logouts++; return route.fulfill({ json: { ok: true } }); });
  // The shared fixture seeds a session on every document; disable that only for logout.
  await page.addInitScript(() => localStorage.removeItem('gastos_pwa_session_token_v2'));
  await menu.click();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.locator('#authDialog')).toBeVisible();
  expect(logouts).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('gastos_pwa_session_token_v2'))).toBeNull();
});

test('redimensionar preserva controles únicos, foco e busca de teclado', async ({ page }) => {
  await ready(page);
  const menu = page.getByLabel('Menu da conta', { exact: true });
  await menu.click();
  await page.getByRole('button', { name: 'Ativar tema claro' }).focus();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: 'Buscar ações', exact: true })).toBeFocused();
  await expect(page.locator('#btnLogout')).toBeVisible();
  await expect(page.locator('#btnLogout')).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(menu).toBeFocused();
  await expect(page.locator('.header-menu__panel')).toBeHidden();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#commandDialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Buscar ações', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.header-menu__panel')).toBeHidden();
});
