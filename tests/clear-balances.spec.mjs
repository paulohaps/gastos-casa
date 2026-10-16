import { test, expect } from '@playwright/test';
import { mockBackend, BACKEND } from './helpers/mock-backend.mjs';
async function ready(page) { await mockBackend(page); await page.goto('/index.html'); await expect(page.locator('#homeHouseTotal')).toContainText('366,40'); }
for (const width of [320, 390, 1440]) test(`quem deve a quem visível no Início e na Casa em ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await ready(page);
  await expect(page.locator('#homePayable')).toHaveText('R$ 20,25');
  await expect(page.locator('#homeReceivable')).toHaveText('R$ 32,95');
  await expect(page.locator('.premium-metric').nth(1)).toContainText('Minha parte nas despesas');
  await expect(page.locator('.premium-metric').nth(1)).toContainText('183,20');
  const summary = page.getByRole('region', { name: 'Quem deve a quem', exact: true });
  await expect(summary).toContainText('Você deve a Fernando'); await expect(summary).toContainText('Fernando deve a você');
  await expect(summary.locator('li').first()).toContainText('Dinheiro'); await expect(summary.locator('li').last()).toContainText('Vale');
  await page.locator('nav [data-app-nav="casa"]:visible').first().click();
  await expect(page.locator('#houseDebtOverview')).toBeVisible(); await expect(page.locator('#houseDebtOverview')).toContainText('20,25');
  await expect(page.locator('#houseDebtOverview')).toContainText('32,95');
  await expect(page.locator('#houseDebtPeriod')).toContainText('09/2026');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('pagamento reduz somente dívida do método sem inflar gastos; falha e troca de mês removem saldo antigo', async ({ page }) => {
  await ready(page); let fail = false, amount = 20;
  await page.route(BACKEND + '/settlements?**', r => {
    if (fail) return r.fulfill({ status: 503, json: { message: 'Falhou' } });
    const month = new URL(r.request().url()).searchParams.get('month');
    return r.fulfill({ json: { atomicSettlements: true, complete: true, settlements: month === '09/2026' ? [{ id: 's1', competencia: '2026-09-01', data_pagamento: '2026-09-20', pagador: 'Paulo Henrique', recebedor: 'Fernando Gustavo', forma_pagamento: 'Dinheiro', valor: amount }] : [] } });
  });
  await page.evaluate(() => window.mudarMes()); await expect(page.locator('#homePayable')).toContainText('10,25');
  await expect(page.locator('#homeReceivable')).toContainText('32,95'); await expect(page.locator('#homeHouseTotal')).toContainText('366,40');
  fail = true; await page.evaluate(() => window.mudarMes()); await expect(page.locator('#homePayable')).toHaveText('—');
  await expect(page.locator('.balance-summary')).toContainText('Pagamentos indisponíveis');
  fail = false; await page.getByRole('combobox', { name: 'Mês da casa' }).selectOption('08/2026');
  await expect(page.locator('#homePayable')).toContainText('145,00'); await expect(page.locator('#homeReceivable')).toContainText('0,00');
  await expect(page.locator('.balance-summary')).toContainText('08/2026'); await expect(page.locator('.balance-summary')).not.toContainText('32,95');
});
test('filtros de despesas não fabricam dívida; método atualiza os dois sentidos', async ({ page }) => {
  await ready(page);
  await page.getByLabel('Pagamento da casa').selectOption('Vale');
  await expect(page.locator('#homePayable')).toContainText('0,00'); await expect(page.locator('#homeReceivable')).toContainText('32,95');
  await page.getByLabel('Categoria', { exact: true }).selectOption('Mercado');
  await expect(page.locator('#homePayable')).toHaveText('—'); await expect(page.locator('#homeReceivable')).toHaveText('—');
  await expect(page.locator('.premium-dashboard')).toContainText('Acertos não têm categoria de despesa');
});
test('perguntas sugeridas de dívidas ficam somente no contexto Casa', async ({ page }) => {
  await ready(page); await page.locator('nav [data-app-nav="assistente"]:visible').first().click();
  await expect(page.getByRole('button', { name: 'Quem deve a quem?', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Em quais dias gasto mais?', exact: true })).toBeVisible();
});
test('lista de acertos sem confirmação de integridade não publica dívida ou quitação', async ({ page }) => {
  await mockBackend(page);
  await page.route(BACKEND + '/settlements?**', r => r.fulfill({ json: { atomicSettlements: true, settlements: [] } }));
  await page.goto('/index.html'); await expect(page.locator('#homeHouseTotal')).toContainText('366,40');
  await expect(page.locator('#homePayable')).toHaveText('—'); await expect(page.locator('#homeReceivable')).toHaveText('—');
  await page.locator('nav [data-app-nav="casa"]:visible').first().click();
  await expect(page.locator('#houseDebtOverview')).toContainText('Não é possível confirmar o saldo');
  await expect(page.locator('#houseDebtOverview')).not.toContainText('Tudo quite');
});
