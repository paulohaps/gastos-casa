import {test,expect} from '@playwright/test';
import {mockBackend,BACKEND} from './helpers/mock-backend.mjs';
const walletId='22222222-2222-4222-8222-222222222222';
async function ready(page){await mockBackend(page);await page.goto('/index.html');await expect(page.locator('#homeHouseTotal')).toContainText('366');}
async function wallet(page){
 await page.route(BACKEND+'/wallets',r=>r.fulfill({json:{wallets:[{id:walletId,nome:'Meu cofre',limite_mensal:1000}]}}));
 await page.route(BACKEND+'/wallets/expenses?**',r=>{const month=new URL(r.request().url()).searchParams.get('month');return r.fulfill({json:{expenses:[{id:'own',data:month+'-12',descricao:'Gasto privado',categoria:'Outros',valor:25}],plan:{month,spent:25,budget:1000,remaining:975,daily:100,remainingDays:10,count:1,signals:[]},aiConfigured:false}})});
}
test('dark padrão, preferência clara persistente e fonte Inter local',async({page})=>{
 await ready(page);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.evaluate(()=>getComputedStyle(document.body).fontFamily)).toContain('Inter');await expect.poll(()=>page.evaluate(()=>document.fonts.check('16px Inter'))).toBe(true);
 await page.getByRole('button',{name:'Ativar tema claro'}).click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('button',{name:'Ativar tema escuro'}).click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
test('sidebar recolhe e mantém rotas e nomes acessíveis',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await ready(page);
 await page.getByRole('button',{name:'Recolher navegação'}).click();await expect(page.locator('body')).toHaveAttribute('data-sidebar','collapsed');
 await page.locator('.desktop-nav').getByRole('link',{name:'Casa',exact:true}).click();await expect(page.locator('body')).toHaveAttribute('data-app-view','casa');
 await page.reload();await expect(page.locator('body')).toHaveAttribute('data-sidebar','collapsed');await page.getByRole('button',{name:'Expandir navegação'}).click();
});
test('categoria filtra total, distribuição, histórico e orçamento sem confundir pagos com responsabilidade',async({page})=>{
 await ready(page);await page.getByRole('combobox',{name:'Categoria',exact:true}).selectOption('Mercado');
 await expect(page.locator('#homeHouseTotal')).toContainText('120,00');await expect(page.locator('#homeRecentExpenses')).toContainText('Mercado da semana');await expect(page.locator('#homeRecentExpenses')).not.toContainText('Internet');
 await expect(page.locator('#homeCategoryChart button')).toHaveCount(1);await expect(page.locator('.budget-progress')).not.toContainText('Contas');
 const cards=page.locator('.premium-metric');await expect(cards.nth(1).locator('.premium-metric__value')).toContainText('120,00');await expect(cards.nth(3).locator('.premium-metric__value')).toHaveText('—');
 await expect(cards.nth(1)).toContainText('Pago por mim na Casa');await expect(cards.nth(1)).toContainText('Responsabilidade compartilhada indisponível');
 await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await expect(page.locator('#homeHouseTotal')).toContainText('366');
});
test('comparativo só consulta cofre selecionado e método da casa não é inventado para privado',async({page})=>{
 await mockBackend(page);await wallet(page);const requests=[];page.on('request',r=>{if(r.url().includes('/wallets/expenses'))requests.push(r.url())});await page.goto('/index.html');await expect(page.locator('#homeWalletRemaining')).toContainText('975');
 await page.getByLabel('Tipo de gasto').selectOption('all');await expect(page.locator('#homeHouseTotal')).toContainText('391,40');
 await page.getByLabel('Pagamento da casa').selectOption('Dinheiro');await expect(page.locator('#homeRecentExpenses')).not.toContainText('Gasto privado');
 await page.getByLabel('Tipo de gasto').selectOption('personal');await expect(page.locator('#homeHouseTotal')).toContainText('25,00');await expect(page.getByLabel('Pagamento da casa')).toBeDisabled();await expect(page.getByLabel('Pagador da casa')).toBeDisabled();
 expect(requests.length).toBeGreaterThan(0);expect(requests.every(url=>new URL(url).searchParams.get('walletId')===walletId)).toBe(true);
});
test('falha do cofre bloqueia total combinado e permite retry sem mostrar zero privado',async({page})=>{
 await mockBackend(page);await wallet(page);let fail=true;
 await page.route(BACKEND+'/wallets/expenses?**',r=>fail?r.fulfill({status:503,json:{message:'Indisponível'}}):r.fulfill({json:{expenses:[],plan:{month:new URL(r.request().url()).searchParams.get('month'),budget:1000,spent:0,remaining:1000,daily:null,remainingDays:0,count:0,signals:[]},aiConfigured:false}}));
 await page.goto('/index.html');await expect(page.locator('#homeWalletRemaining')).toContainText('Indisponível');await page.getByLabel('Tipo de gasto').selectOption('all');await expect(page.locator('#homeHouseTotal')).toHaveText('—');
 fail=false;await page.locator('.dashboard-error').getByRole('button',{name:'Tentar novamente'}).click();await expect(page.locator('#homeHouseTotal')).toContainText('366');
});
test('503 em orçamento e pagamentos permanece erro e não ausência de meta ou quitação',async({page})=>{
 await mockBackend(page);await page.route(BACKEND+'/budgets?**',r=>r.fulfill({status:503,json:{message:'Falhou'}}));await page.route(BACKEND+'/settlements?**',r=>r.fulfill({status:503,json:{message:'Falhou'}}));
 await page.goto('/index.html');await expect(page.locator('#homeHouseTotal')).toContainText('366');await expect(page.locator('.premium-dashboard')).toContainText('Orçamento indisponível');await expect(page.locator('.balance-summary')).toContainText('Pagamentos indisponíveis');await expect(page.locator('.balance-summary')).not.toContainText('0,00');
});
test('resposta com limite de paginação atingido não publica indicadores como completos',async({page})=>{
 await mockBackend(page);await page.route(BACKEND+'/expenses?month=09%2F2026',r=>r.fulfill({json:{expenses:Array.from({length:1000},(_,n)=>({id:String(n),data:'2026-09-12',usuario:'Paulo Henrique',valor:1,descricao:'Teste',categoria:'Outros',forma_pagamento:'Dinheiro'}))}}));
 await page.goto('/index.html');await expect(page.locator('body')).toHaveAttribute('data-month-state','success');await expect(page.locator('#homeView')).toContainText('dados completos');await expect(page.locator('#homeHouseTotal')).toBeHidden();
});
for(const width of [320,390,768,1440,1920])for(const theme of ['dark','light'])test(`dashboard e FAB ${width}px no tema ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:900});await ready(page);await page.evaluate(value=>window.GastosTheme.set(value),theme);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.premium-metric')).toHaveCount(4);
 if(width<=900){const fab=page.locator('.quick-expense-fab');await expect(fab).toBeVisible();const a=await fab.boundingBox(),b=await page.locator('.mobile-nav').boundingBox();expect(a.y+a.height).toBeLessThanOrEqual(b.y);await fab.click();await expect(page.locator('#entryChoiceDialog')).toBeVisible();}
});
for(const theme of ['dark','light'])test(`contraste de navegação e ação principal no tema ${theme}`,async({page})=>{
 await page.setViewportSize({width:1440,height:900});await ready(page);await page.evaluate(value=>window.GastosTheme.set(value),theme);
 const results=await page.evaluate(()=>{
  const luminance=color=>{const v=color.match(/[\d.]+/g).slice(0,3).map(n=>{const s=Number(n)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4});return v[0]*.2126+v[1]*.7152+v[2]*.0722};
  return ['.desktop-nav [data-app-nav="casa"]','.desktop-nav [aria-current="page"]','.sidebar-label','.topbar-create'].map(selector=>{
   const node=document.querySelector(selector);let background=node;while(getComputedStyle(background).backgroundColor==='rgba(0, 0, 0, 0)'&&background.parentElement)background=background.parentElement;
   const a=luminance(getComputedStyle(node).color),b=luminance(getComputedStyle(background).backgroundColor);return {selector,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
 });for(const result of results)expect(result.contrast,result.selector).toBeGreaterThanOrEqual(4.5);
});
test('valor com fração de centavo não é arredondado na movimentação nem nos indicadores',async({page})=>{
 await mockBackend(page);await page.route(BACKEND+'/expenses?month=09%2F2026',r=>r.fulfill({json:{expenses:[{id:'bad',data:'2026-09-12',usuario:'Paulo Henrique',valor:0.005,descricao:'Valor inválido',categoria:'Outros',forma_pagamento:'Dinheiro'}]}}));
 await page.goto('/index.html');await expect(page.locator('.premium-dashboard')).toContainText('valor monetário inválido');await expect(page.locator('#homeHouseTotal')).toHaveText('—');await expect(page.locator('.premium-transaction>strong')).toHaveText('Valor indisponível');await expect(page.locator('#homeCategoryChart')).toHaveCount(0);
});
test('chat aguarda histórico antes da edição e aceita o primeiro envio assim que pronto',async({page})=>{
 await mockBackend(page);let release;const gate=new Promise(resolve=>release=resolve);let reads=0,sends=0;
 await page.route(BACKEND+'/assistant/conversation?**',async r=>{reads++;await gate;await r.fulfill({json:{conversation:null}}).catch(()=>{});});
 await page.route(BACKEND+'/assistant/chat',r=>{sends++;return r.fulfill({contentType:'text/event-stream',body:'data: {"type":"start"}\n\ndata: {"type":"text","text":"Resposta do primeiro envio."}\n\ndata: {"type":"end"}\n\n'});});
 await page.goto('/index.html#assistente');await expect.poll(()=>reads).toBeGreaterThan(0);await expect(page.locator('#assistantText')).toHaveJSProperty('readOnly',true);await expect(page.getByRole('button',{name:'Enviar mensagem'})).toBeDisabled();
 release();await expect(page.locator('#assistantText')).toBeEditable();await page.locator('#assistantText').fill('Resuma meus gastos');await page.getByRole('button',{name:'Enviar mensagem'}).click();await expect(page.locator('.chat-response')).toContainText('Resposta do primeiro envio');expect(sends).toBe(1);
});
test('filtros compatíveis acompanham histórico da Casa nos dois sentidos',async({page})=>{
 await ready(page);await page.getByRole('combobox',{name:'Categoria',exact:true}).selectOption('Mercado');await page.getByRole('link',{name:'Consultar histórico →',exact:true}).click();await expect(page.locator('#filtroCategoria')).toHaveValue('Mercado');await expect(page.locator('#filtroTotal')).toContainText('120,00');
 await page.locator('#filtroCategoria').selectOption('Contas');await page.locator('nav [data-app-nav="resumo"]:visible').first().click();await expect(page.locator('#homeHouseTotal')).toContainText('180,50');await expect(page.getByRole('combobox',{name:'Categoria',exact:true})).toHaveValue('Contas');
});
test('histórico pessoal aberto pela dashboard recebe o mês do filtro global',async({page})=>{
 await mockBackend(page);await wallet(page);await page.goto('/index.html');await expect(page.locator('#homeWalletRemaining')).toContainText('975');await page.getByLabel('Tipo de gasto').selectOption('personal');await page.getByRole('button',{name:'Consultar histórico →',exact:true}).click();await expect(page.locator('body')).toHaveAttribute('data-app-view','carteiras');await expect(page.locator('#walletMonth')).toHaveValue('2026-09');await expect(page.locator('#walletExpenseList')).toContainText('Gasto privado');
});
