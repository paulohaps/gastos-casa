import {test,expect} from '@playwright/test';
import {mockBackend,BACKEND} from './helpers/mock-backend.mjs';
async function ready(page,hash='resumo'){await mockBackend(page);await page.goto('/index.html#'+hash);await expect(page.locator('#homeHouseTotal')).toContainText('366');await page.evaluate(()=>document.fonts.ready);}
for(const width of [390,1440])test(`mês do gráfico atualiza seletor, totais e movimentações em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await ready(page);
 await page.route(BACKEND+'/expenses?month=08%2F2026',r=>r.fulfill({json:{expenses:[{id:'august',data:'2026-08-12',usuario:'Paulo Henrique',valor:75,descricao:'Despesa de agosto',categoria:'Mercado',forma_pagamento:'Dinheiro'}]}}));
 await page.locator('.monthly-trend__labels button').filter({hasText:'ago.'}).click();
 await expect(page.locator('#seletorMes')).toHaveValue('08/2026');await expect(page.locator('body')).toHaveAttribute('data-month-state','success');
 await expect(page.locator('#homeHouseTotal')).toContainText('75,00');await expect(page.locator('#homeRecentExpenses')).toContainText('Despesa de agosto');await expect(page.locator('#homeRecentExpenses')).not.toContainText('Mercado da semana');
 await expect(page.locator('.monthly-trend__labels button[aria-pressed="true"]')).toContainText('ago.');
});
for(const width of [320,390])test(`filtros em bottom sheet preservam rascunho, foco e limites em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:568});await ready(page);
 const opener=page.getByRole('button',{name:'Filtros',exact:true});await opener.click();const dialog=page.getByRole('dialog',{name:'Filtrar período'});await expect(dialog).toBeVisible();
 const box=await dialog.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(box.y+box.height).toBeLessThanOrEqual(568);
 await dialog.getByLabel('Categoria',{exact:true}).selectOption('Mercado');await expect(page.locator('#homeHouseTotal')).toContainText('366');await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();await expect(page.locator('body')).not.toHaveClass(/dialog-open/);
 await opener.click();await expect(dialog.getByLabel('Categoria',{exact:true})).toHaveValue('');await dialog.getByLabel('Categoria',{exact:true}).selectOption('Mercado');await dialog.getByRole('button',{name:'Aplicar filtros'}).click();await expect(page.locator('#homeHouseTotal')).toContainText('120,00');await expect(page.getByRole('button',{name:/Filtros.*1/})).toBeVisible();
});
test('desktop usa faixa financeira e tabela sem contornos fechados nas métricas e análises',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await ready(page);
 await expect(page.getByRole('table',{name:'Últimas movimentações da seleção'})).toBeVisible();await expect(page.getByRole('columnheader',{name:'Pagador / destino'})).toBeVisible();await expect(page.locator('.transaction-table tbody tr')).toHaveCount(3);
 const composition=await page.evaluate(()=>({boxes:[...document.querySelectorAll('.premium-metric,.dashboard-card')].filter(n=>{const s=getComputedStyle(n);return ['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].every(p=>parseFloat(s[p])>0)}).length,total:parseFloat(getComputedStyle(document.getElementById('homeHouseTotal')).fontSize),secondary:parseFloat(getComputedStyle(document.querySelectorAll('.premium-metric__value')[1]).fontSize)}));
 expect(composition.boxes).toBe(0);expect(composition.total).toBeGreaterThan(composition.secondary);await page.getByRole('link',{name:'Conferir e registrar pagamentos →',exact:true}).click();await expect(page.locator('.settlement-workspace')).toBeVisible();
});
test('seções progressivas mobile mantêm drill-down, orçamento e ação principal única',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);
 await expect(page.locator('.btn--primary:visible')).toHaveCount(1);
 const category=page.locator('details.dashboard-distribution');await expect(category).not.toHaveAttribute('open','');await category.locator('summary').click();await page.locator('#homeCategoryChart button').filter({hasText:'Mercado'}).click();await expect(page.locator('#chartDetailsDialog')).toBeVisible();await expect(page.locator('#chartDetailsList')).toContainText('Mercado da semana');await page.keyboard.press('Escape');
 await page.locator('.dashboard-budget>summary').click();await expect(page.locator('.budget-progress')).toContainText('700,00');
});
test('gráfico histórico não liga pontos através de mês indisponível',async({page})=>{
 await mockBackend(page);await page.route(BACKEND+'/expenses?month=**',r=>{const month=new URL(r.request().url()).searchParams.get('month');if(month==='09/2026')return r.fallback();if(month==='08/2026')return r.fulfill({status:503,json:{message:'Indisponível'}});return r.fulfill({json:{expenses:[{id:month,data:month.split('/').reverse().join('-')+'-12',usuario:'Paulo Henrique',valor:100,descricao:'Histórico',categoria:'Mercado',forma_pagamento:'Dinheiro'}]}});});
 await page.goto('/index.html');await expect(page.locator('#homeHouseTotal')).toContainText('366');await expect(page.locator('.monthly-trend .trend-line')).toHaveCount(1);await expect(page.locator('.monthly-trend').getByRole('button',{name:'2026-08: Indisponível'})).toBeVisible();
});
test('ajustes mobile navegam por assunto e preferência real persiste',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);await page.locator('nav [data-app-nav="ajustes"]:visible').first().click();
 await expect(page.locator('#settingsAccount')).toContainText('Paulo Henrique');const jump=page.getByLabel('Seção dos ajustes');await jump.selectOption('settingsPreferences');await page.getByRole('button',{name:'Claro',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByLabel('Seção dos ajustes').selectOption('settingsCatalog');await expect(page.locator('#settingsCatalog')).toContainText('Mercado');await expect(page.locator('#settingsCatalog')).toContainText('Dinheiro');await expect(page.locator('#settingsCatalog input')).toHaveCount(0);
});
test('histórico do chat navega por perguntas sem perder rascunho e tabela não executa HTML',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await mockBackend(page);await page.route(BACKEND+'/assistant/chat',r=>r.fulfill({contentType:'text/event-stream',body:'data: {"type":"start"}\n\ndata: '+JSON.stringify({type:'text',text:'| Categoria | Valor |\n| --- | --- |\n| Mercado | R$ 120,00 |\n| <img src=x onerror=alert(1)> | R$ 0,01 |'})+'\n\ndata: {"type":"end"}\n\n'}));
 await page.goto('/index.html#assistente');await page.locator('#assistantText').fill('Primeira pergunta');await page.getByRole('button',{name:'Enviar mensagem'}).click();await expect(page.locator('#assistantComposerStatus')).toContainText('Resposta concluída');await expect(page.locator('.chat-table')).toContainText('R$ 120,00');await expect(page.locator('.chat-table img')).toHaveCount(0);await expect(page.locator('.chat-table')).toContainText('<img src=x onerror=alert(1)>');
 await page.locator('#assistantText').fill('Rascunho mantido');await page.locator('.chat-history>summary').click();await page.getByRole('button',{name:'Ir para pergunta: Primeira pergunta'}).click();await expect(page.locator('#assistantMessage-0')).toBeFocused();await expect(page.locator('#assistantText')).toHaveValue('Rascunho mantido');await expect(page.locator('.chat-history')).not.toHaveAttribute('open','');
});
test('resize com filtros abertos libera a página e mantém a seleção confirmada',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);await page.getByRole('button',{name:'Filtros',exact:true}).click();await page.setViewportSize({width:1440,height:900});await expect(page.locator('#dashboardFiltersDialog')).toHaveCount(0);await expect(page.locator('body')).not.toHaveClass(/dialog-open/);await expect(page.locator('#homeHouseTotal')).toContainText('366');await page.getByLabel('Categoria',{exact:true}).selectOption('Mercado');await expect(page.locator('#homeHouseTotal')).toContainText('120,00');
});
test('erro mensal tem um único aviso persistente, sem skeleton simultâneo e com retry',async({page})=>{
 await ready(page);let fail=true;await page.route(BACKEND+'/expenses?month=08%2F2026',r=>fail?r.fulfill({status:503,json:{message:'Falha recuperável do período'}}):r.fulfill({json:{expenses:[]}}));await page.locator('#seletorMes').selectOption('08/2026');await expect(page.locator('body')).toHaveAttribute('data-month-state','error');await expect(page.locator('#visao-geral [role="alert"]:visible')).toHaveCount(1);await expect(page.locator('.loading-skeleton')).toHaveCount(0);await expect(page.locator('#homeHouseTotal')).toBeHidden();fail=false;await page.locator('#monthRetry').click();await expect(page.locator('#homeHouseTotal')).toContainText('0,00');await expect(page.locator('#monthStatus')).toBeHidden();
});
