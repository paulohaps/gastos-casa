import {test,expect} from '@playwright/test';
import {mockBackend,BACKEND} from './helpers/mock-backend.mjs';
async function ready(page){await mockBackend(page);await page.goto('/index.html');await expect(page.locator('#homePayable')).toContainText('20,25');}
for(const width of [390,1440])test(`início operacional separa tarefas, histórico e análise em ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await ready(page);
 await expect(page.getByRole('tab',{name:'Agora',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.workspace-actions')).toBeVisible();await expect(page.locator('#homeRecentExpenses')).toBeVisible();await expect(page.locator('.dashboard-analysis')).toBeHidden();
 await page.getByRole('button',{name:/Entender meu mês/}).click();await expect(page.getByRole('tab',{name:'Análises',exact:true})).toBeFocused();await expect(page.locator('.dashboard-analysis')).toBeVisible();await expect(page.locator('#homeRecentExpenses')).toBeHidden();
 await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{name:'Movimentações',exact:true})).toBeFocused();await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Movimentações');await expect(page.locator('#homeRecentExpenses')).toBeVisible();
 await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:'Agora',exact:true})).toHaveAttribute('aria-selected','true');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('operational-home.png'),fullPage:true});
});
test('movimentações pagina todos os registros da seleção e volta ao início ao pesquisar',async({page})=>{
 await mockBackend(page);await page.route(BACKEND+'/expenses?month=09%2F2026',r=>r.fulfill({json:{expenses:Array.from({length:61},(_,i)=>({id:'expense-'+i,data:'2026-09-'+String(i%28+1).padStart(2,'0'),usuario:'Paulo Henrique',valor:1,descricao:'Despesa '+i,categoria:'Outros',forma_pagamento:'Dinheiro'}))}}));
 await page.goto('/index.html');await expect(page.locator('#homeHouseTotal')).toContainText('61,00');await page.getByRole('button',{name:/Encontrar um lançamento/}).click();await expect(page.locator('#dashboardQuery')).toBeFocused();
 const pages=page.getByRole('group',{name:'Páginas de movimentações'});await expect(page.locator('#homeRecentExpenses tbody tr')).toHaveCount(25);await expect(pages).toContainText('1–25 de 61');await expect(pages.getByRole('button',{name:'Anterior'})).toBeDisabled();
 await pages.getByRole('button',{name:'Próxima'}).click();await expect(pages).toContainText('26–50 de 61');await pages.getByRole('button',{name:'Próxima'}).click();await expect(page.locator('#homeRecentExpenses tbody tr')).toHaveCount(11);await expect(pages).toContainText('51–61 de 61');await expect(pages.getByRole('button',{name:'Próxima'})).toBeDisabled();
 await page.locator('#dashboardQuery').fill('Despesa 1');await expect(page.locator('#homeRecentExpenses tbody tr')).toHaveCount(11);await expect(pages).toHaveCount(0);await page.locator('#dashboardQuery').clear();await expect(pages).toContainText('1–25 de 61');
});
test('lançamento abre consulta de leitura e prepara análise contextual sem envio ou alteração financeira',async({page})=>{
 await ready(page);const writes=[];page.on('request',r=>{if(r.method()!=='GET'&&r.url().startsWith(BACKEND))writes.push(r.url());});
 await page.getByRole('button',{name:'Abrir despesa: Mercado da semana',exact:true}).click();const panel=page.getByRole('dialog',{name:'Mercado da semana',exact:true});await expect(panel).toContainText('120,00');await expect(panel).toContainText('Paulo Henrique');await expect(panel).toContainText('18/09/2026');
 await panel.getByRole('button',{name:'Analisar esta despesa no chat'}).click();await expect(page.locator('#assistantText')).toHaveValue(/Mercado da semana/);await expect(page.locator('#assistantMonth')).toHaveValue('2026-09');expect(writes).toEqual([]);
});
test('consulta de despesa inválida não apresenta um valor arredondado',async({page})=>{
 await mockBackend(page);await page.route(BACKEND+'/expenses?month=09%2F2026',r=>r.fulfill({json:{expenses:[{id:'bad',data:'2026-09-12',usuario:'Paulo Henrique',valor:0.005,descricao:'Valor inválido',categoria:'Outros',forma_pagamento:'Dinheiro'}]}}));await page.goto('/index.html');await page.getByRole('button',{name:'Abrir despesa: Valor inválido'}).click();const panel=page.getByRole('dialog',{name:'Valor inválido',exact:true});await expect(panel).toContainText('Valor indisponível');await expect(panel.getByRole('button',{name:'Analisar esta despesa no chat'})).toHaveCount(0);
});
for (const width of [320,390,768]) test(`ação principal não cobre valores em ${width}px`, async ({page}) => {
 await page.setViewportSize({width,height:844}); await ready(page);
 const action=page.locator('.quick-expense-fab'); await expect(action).toHaveCount(1); await expect(action).toBeVisible();
 expect(await action.evaluate(el=>getComputedStyle(el).position)).not.toBe('fixed');
 const button=await action.boundingBox(), money=await page.locator('#homeHouseTotal').boundingBox();
 expect(button.y+button.height).toBeLessThanOrEqual(money.y);
 await page.locator('[data-app-nav="casa"]:visible').first().click(); await expect(page.locator('.quick-expense-fab')).toHaveCount(1);
 await page.locator('[data-app-nav="resumo"]:visible').first().click(); await expect(page.locator('.quick-expense-fab')).toHaveCount(1);
 await expect(page.locator('.overview-entry-button')).toBeVisible();
});
