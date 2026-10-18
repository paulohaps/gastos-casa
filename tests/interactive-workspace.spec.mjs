import { test, expect } from '@playwright/test';
import { mockBackend, BACKEND } from './helpers/mock-backend.mjs';
async function ready(page) {
  await mockBackend(page);
  await page.goto('/index.html#resumo');
  await expect(page.locator('#homePayable')).toContainText('20,25');
  await expect(page.locator('#homeReceivable')).toContainText('32,95');
}
for (const width of [320, 390, 1440]) {
  test(`inspector de acertos explica métodos, protege foco e não grava nada em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({width, height:900});
    await ready(page);
    const mutations=[];
    page.on('request', r => {if(r.url().startsWith(BACKEND) && r.method()!=='GET') mutations.push(r.method()+' '+r.url());});
    const opener=page.getByRole('button',{name:'Entender o que você deve'});
    await page.screenshot({path:info.outputPath('workspace.png'),fullPage:true});
    await opener.click();
    const panel=page.getByRole('dialog',{name:'Entenda seus acertos'});
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Minha parte nas despesas');
    await expect(panel).toContainText('183,20');
    await expect(panel.locator('.inspector-balances')).toContainText('20,25');
    await expect(panel.locator('.inspector-balances')).toContainText('32,95');
    await expect(panel.locator('.inspector-balances li')).toHaveCount(2);
    await expect(panel).toContainText('Dinheiro e Vale não se compensam');
    const box=await panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(box.y+box.height).toBeLessThanOrEqual(901);
    for(let i=0;i<6;i++) {await page.keyboard.press('Tab');expect(await panel.evaluate(n=>n.contains(document.activeElement))).toBe(true);}
    await page.screenshot({path:info.outputPath('inspector.png')});
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);await expect(opener).toBeFocused();
    await expect(page.locator('body')).not.toHaveClass(/dialog-open/);
    expect(mutations).toEqual([]);
  });
}
test('troca de mês fecha o inspector e nunca mantém saldo antigo numa falha',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'Entender o que você deve'}).click();
 await expect(page.locator('.workspace-detail')).toBeVisible();
 await page.route(BACKEND+'/expenses?month=08%2F2026',r=>r.fulfill({status:503,json:{message:'Falha do mês'}}));
 await page.evaluate(()=>{document.querySelector('#seletorMes').value='08/2026';window.mudarMes();});
 await expect(page.locator('.workspace-detail')).toHaveCount(0);await expect(page.locator('body')).not.toHaveClass(/dialog-open/);
 await expect(page.locator('#homeHouseTotal')).toBeHidden();await expect(page.locator('#monthRetry')).toBeVisible();
});
test('troca de espaço limpa filtros da Casa e não mistura lançamentos pessoais',async({page})=>{
 await ready(page);
 await page.getByLabel('Categoria',{exact:true}).selectOption('Mercado');
 const context=page.getByRole('group',{name:'Espaço financeiro'});
 await context.getByRole('button',{name:'Pessoal',exact:true}).click();
 await expect(context.getByRole('button',{name:'Pessoal',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Tipo de gasto')).toHaveValue('personal');await expect(page.getByLabel('Categoria',{exact:true})).toHaveValue('');
 await expect(page.locator('#homeRecentExpenses')).not.toContainText('Mercado da semana');
 await expect(page.getByRole('region',{name:'Quem deve a quem',exact:true})).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Atalhos do espaço'})).toContainText('Abrir meu cofre');
 await context.getByRole('button',{name:'Casa',exact:true}).click();
 await expect(page.locator('#homeHouseTotal')).toContainText('366,40');await expect(page.locator('#homePayable')).toContainText('20,25');
});
test('inspector de movimentações respeita filtro e abre histórico mantendo a navegação',async({page})=>{
 await ready(page);await page.getByLabel('Categoria',{exact:true}).selectOption('Mercado');
 await page.getByRole('button',{name:'Detalhar: Total de gastos',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'Movimentações da seleção'});await expect(panel).toContainText('120,00');
 await expect(panel.locator('#inspectorTransactions')).toContainText('Mercado da semana');await expect(panel.locator('#inspectorTransactions')).not.toContainText('Conta de luz');
 await panel.getByRole('link',{name:'Abrir histórico da Casa →'}).click();await expect(page.locator('.workspace-detail')).toHaveCount(0);
 await expect(page.locator('body')).toHaveAttribute('data-app-view','casa');await expect(page.locator('#tabelaHistorico')).toBeVisible();
 await expect(page.locator('body')).not.toHaveClass(/dialog-open/);
});
test('painel não fica aberto quando um filtro muda por outra área',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'Detalhar: Total de gastos',exact:true}).click();await expect(page.locator('.workspace-detail')).toBeVisible();
 await page.evaluate(()=>window.GastosExperience.filters.set({category:'Mercado'}));await expect(page.locator('.workspace-detail')).toHaveCount(0);
 await expect(page.locator('#homeHouseTotal')).toContainText('120,00');await expect(page.locator('body')).not.toHaveClass(/dialog-open/);
});
