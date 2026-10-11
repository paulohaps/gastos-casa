import { test, expect } from '@playwright/test';
import { BACKEND, mockBackend } from './helpers/mock-backend.mjs';
const id = '22222222-2222-4222-8222-222222222222';
async function setup(page, count = 3) {
  await mockBackend(page);
  let wallet = { id, nome: 'Dia a dia', limite_mensal: 600 };
  const items = Array.from({ length: count }, (_, n) => ({ id: 'p' + n, data: '2026-09-22', valor: 20, descricao: 'Gasto ' + (n + 1), categoria: 'Mercado' }));
  await page.route(BACKEND + '/wallets', route => route.fulfill({ json: { wallets: [wallet] } }));
  await page.route(BACKEND + '/wallets/expenses?**', route => {
    const month = new URL(route.request().url()).searchParams.get('month'), rows = month === '2026-09' ? items : [];
    return route.fulfill({ json: { expenses: rows, plan: { month, spent: rows.length * 20, budget: 600, remaining: 600 - rows.length * 20, daily: 60, remainingDays: month === '2026-09' ? 9 : 0, signals: [] } } });
  });
  await page.route(BACKEND + '/wallets/goal', route => {
    const goal = route.request().postDataJSON().goal;
    wallet = { ...wallet, goal_nome: goal?.name ?? null, goal_valor: goal?.target ?? null, goal_reserva: goal?.reserve ?? null, goal_prazo: goal?.deadline ?? null, goal_mes: goal?.month ?? null };
    return route.fulfill({ json: { wallets: [wallet] } });
  });
  await page.goto('/index.html#carteiras');
  await expect(page.locator('#walletSpent')).toContainText((items.length * 20) + ',00');
}
test('cofre mostra últimos cinco gastos e mantém análises recolhidas em 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await setup(page, 7);
  await expect(page.locator('#walletExpenseList .wallet-expense')).toHaveCount(5);
  await expect(page.locator('.vault-advisor')).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Ver todos os 7 gastos' }).click();
  await expect(page.locator('#walletExpenseList .wallet-expense')).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('meta persiste após reload, protege referência diária e não é carregada em outro mês', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await setup(page);
  await page.locator('#walletGoalOpen').click();
  await page.locator('#walletGoalName').fill('Minha viagem'); await page.locator('#walletGoalTarget').fill('1000'); await page.locator('#walletGoalDeadline').fill('2026-12-20'); await page.locator('#walletGoalReserve').fill('180');
  await page.locator('#walletGoalForm [type=submit]').click();
  await expect(page.locator('#walletGoalDialog')).toBeHidden(); await expect(page.locator('#walletDailyValue')).toContainText('40,00');
  await expect(page.locator('#walletGoalProtected')).toContainText('180,00');
  await page.reload(); await expect(page.locator('#walletGoalHeading')).toHaveText('Minha viagem');
  await page.screenshot({ path: 'test-results/cofre-meta-390.png', fullPage: true });
  await page.locator('#walletMonth').fill('2026-08'); await expect(page.locator('#walletGoalProtected')).toContainText('0,00 protegidos');
  await expect(page.locator('#walletDailyValue')).toHaveText('Sem referência');
});
test('falha ao salvar meta mantém formulário e sessão, depois permite tentar novamente', async ({ page }) => {
  await setup(page); let rejected = true;
  await page.route(BACKEND + '/wallets/goal', route => rejected ? route.fulfill({ status: 503, json: { message: 'Não foi possível salvar sua meta' } }) : route.fallback());
  await page.locator('#walletGoalOpen').click(); await page.locator('#walletGoalName').fill('Viagem'); await page.locator('#walletGoalTarget').fill('500'); await page.locator('#walletGoalDeadline').fill('2026-12-01');
  await page.locator('#walletGoalForm [type=submit]').click(); await expect(page.locator('#walletGoalDialog [role=alert]')).toContainText('Não foi possível');
  await expect(page.locator('#walletGoalName')).toHaveValue('Viagem'); expect(await page.evaluate(() => localStorage.getItem('gastos_pwa_session_token_v2'))).toBeTruthy();
  rejected = false; await page.locator('#walletGoalForm [type=submit]').click(); await expect(page.locator('#walletGoalDialog')).toBeHidden();
});
test('cofre descarta mês atrasado e 503 limpa valores antigos com erro persistente', async ({ page }) => {
  await setup(page); let release;
  await page.route(BACKEND + '/wallets/expenses?**', async route => {
    const month = new URL(route.request().url()).searchParams.get('month');
    if (month === '2026-08') { await new Promise(resolve => { release = resolve; }); await route.fulfill({ json: { expenses: [{ id: 'old', data: '2026-08-01', valor: 90, descricao: 'Resposta atrasada', categoria: 'Outros' }], plan: { month, spent: 90, budget: 600, remaining: 510, daily: null, signals: [] } } }).catch(() => {}); }
    else return route.fulfill({ status: 503, json: { message: 'Carteira indisponível neste mês' } });
  });
  await page.locator('#walletMonth').fill('2026-08'); await expect.poll(() => typeof release).toBe('function'); await page.locator('#walletMonth').fill('2026-07');
  await expect(page.locator('#walletStatus')).toContainText('indisponível'); release();
  await expect(page.locator('#walletSpent')).toHaveText('—'); await expect(page.locator('#walletExpenseList')).not.toContainText('Resposta atrasada');
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
});
test('resposta do chat abre gastos ou simulador no mês e carteira corretos sem gravar', async ({ page }) => {
  await setup(page); const writes = [];
  page.on('request', req => { if (req.method() === 'POST' && new URL(req.url()).pathname === '/wallets/expenses') writes.push(req.url()); });
  await page.route(BACKEND + '/assistant/conversation**', route => route.fulfill({ json: { conversation: null } }));
  await page.route(BACKEND + '/assistant/chat', route => route.fulfill({ contentType: 'text/event-stream', body: 'data: {"type":"start"}\n\ndata: {"type":"text","text":"Confira a referência diária."}\n\ndata: {"type":"end"}\n\n' }));
  await page.evaluate(() => GastosNavigation.show('assistente')); await page.locator('#assistantContext').selectOption(id); await page.locator('#assistantText').fill('Posso gastar R$ 100?'); await page.locator('#assistantComposer [type=submit]').click();
  await page.getByRole('button', { name: 'Simular compra', exact: true }).click(); await expect(page.locator('#walletSimulatorDialog')).toBeVisible(); await expect(page.locator('#walletSimulatorContext')).toContainText('2026-09');
  await page.keyboard.press('Escape'); await page.evaluate(() => GastosNavigation.show('assistente')); await page.getByRole('button', { name: 'Ver esses gastos', exact: true }).click();
  await expect(page.locator('#walletMovements')).toBeFocused(); expect(writes).toEqual([]);
});

test('totais incoerentes da API não aparecem como dados válidos do cofre', async ({ page }) => {
  await setup(page);
  await page.route(BACKEND + '/wallets/expenses?**', route => route.fulfill({ json: { expenses: [], plan: { month: '2026-09', spent: 999, budget: 600, remaining: 0, daily: 0, remainingDays: 9, signals: [] } } }));
  await page.locator('#walletRefresh').click();
  await expect(page.locator('#walletStatus')).toContainText('incompletos');
  await expect(page.locator('#walletSpent')).toHaveText('—');
  await expect(page.locator('#walletAddExpense')).toBeDisabled();
});
test('remover meta exige confirmação e libera a referência diária', async ({ page }) => {
  await setup(page);
  await page.locator('#walletGoalOpen').click(); await page.locator('#walletGoalName').fill('Viagem'); await page.locator('#walletGoalTarget').fill('500'); await page.locator('#walletGoalDeadline').fill('2026-12-01'); await page.locator('#walletGoalReserve').fill('180'); await page.locator('#walletGoalForm [type=submit]').click();
  await expect(page.locator('#walletDailyValue')).toContainText('40,00');
  await page.locator('#walletGoalOpen').click(); await page.getByRole('button', { name: 'Remover meta', exact: true }).click(); await expect(page.locator('#confirmDialog')).toBeVisible(); await page.locator('#confirmCancel').click();
  await expect(page.locator('#walletGoalDialog')).toBeVisible();
  await page.getByRole('button', { name: 'Remover meta', exact: true }).click(); await page.locator('#confirmAccept').click();
  await expect(page.locator('#walletGoalHeading')).toContainText('Guarde espaço'); await expect(page.locator('#walletDailyValue')).toContainText('60,00');
});

test('análise da carteira impede envios duplicados e ignora retorno após mudar mês', async ({ page }) => {
  await setup(page); let release, calls = 0;
  await page.route(BACKEND + '/wallets/expenses?**', route => {
    const month = new URL(route.request().url()).searchParams.get('month');
    return route.fulfill({ json: { expenses: [], plan: { month, spent: 0, budget: 600, remaining: 600, daily: null, remainingDays: 0, signals: [{ type: 'fast_pace', amount: 1, action: 'Revise os gastos.' }] } } });
  });
  await page.route(BACKEND + '/wallets/insights', async route => { calls++; await new Promise(resolve => { release = resolve; }); await route.fulfill({ json: { explanation: { source: 'ai', text: 'Explicação do mês anterior' } } }); });
  await page.locator('#walletRefresh').click(); await page.locator('.vault-advisor > summary').click(); await page.locator('#walletAiButton').click();
  await expect(page.locator('#walletAiButton')).toBeDisabled();
  await page.locator('#walletMonth').fill('2026-08'); await expect(page.locator('#walletAiButton')).toBeEnabled();
  release(); await expect(page.locator('#walletAiText')).not.toContainText('mês anterior'); expect(calls).toBe(1);
});
