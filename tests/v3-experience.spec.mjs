import { test, expect } from '@playwright/test';
import { BACKEND, mockBackend } from './helpers/mock-backend.mjs';
const id='22222222-2222-4222-8222-222222222222';
async function fixtures(page) {
 await mockBackend(page);
 await page.route(BACKEND+'/wallets',r=>r.fulfill({json:{wallets:[{id,nome:'Dia a dia',limite_mensal:600,goal_nome:'Viagem',goal_valor:1000,goal_reserva:100,goal_prazo:'2026-12-20',goal_mes:'2026-09'}]}}));
 await page.route(BACKEND+'/wallets/expenses?**',r=>{
 const month=new URL(r.request().url()).searchParams.get('month');
 return r.fulfill({json:{expenses:[{id:'demo',data:month+'-22',valor:20,descricao:'Mercado',categoria:'Mercado'}],plan:{month,spent:20,budget:600,remaining:580,daily:60,remainingDays:9,signals:[]}}});
 });
}
for(const [width,height] of [[320,568],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080],[844,390]])
 test(`V3 responsivo ${width}×${height}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height});await fixtures(page);await page.goto('/index.html#resumo');
 for(const view of ['resumo','carteiras','assistente','ajustes','casa','lancar']) {
 await page.evaluate(v=>window.GastosNavigation.show(v,{instant:true}),view);
 await expect(page.locator('body')).toHaveAttribute('data-app-view',view);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),view).toBe(true);
 if(view==='assistente') {
 await expect(page.locator('#assistantWelcome')).toBeVisible();
 const bounds=await page.evaluate(()=>{const log=document.getElementById('assistantMessages').getBoundingClientRect(),heading=document.querySelector('#assistantWelcome h2').getBoundingClientRect(),composer=document.getElementById('assistantComposer').getBoundingClientRect();return {logTop:log.top,headingTop:heading.top,composerBottom:composer.bottom,height:innerHeight}});
 expect(bounds.headingTop).toBeGreaterThanOrEqual(bounds.logTop);
 expect(bounds.composerBottom).toBeLessThanOrEqual(bounds.height);
 }
 }
 expect(errors).toEqual([]);
 });
test('erro de IA não afirma ausência da chave e retry fica no topo do editor',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mockBackend(page);
 await page.route(BACKEND+'/ai/settings',r=>r.fulfill({status:503,json:{message:'Conexão indisponível'}}));
 await page.goto('/index.html#ajustes');await expect(page.locator('#aiConnectionBadge')).toHaveText('Não verificada');
 const retry=page.locator('#aiSettingsForm').getByRole('button',{name:'Tentar novamente'});
 await expect(retry).toBeVisible();expect((await retry.boundingBox()).y).toBeLessThan(600);
 await expect(page.locator('#aiSave')).toBeDisabled();
});
test('ícones locais e alvos de toque da Casa sobrevivem à CDN indisponível',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mockBackend(page);await page.goto('/index.html#casa');
 await page.locator('[data-house-tab="despesas"]').click();await expect(page.locator('#tabelaHistorico tr').first()).toBeVisible();
 const button=page.locator('#tabelaHistorico .table-action').first();const bounds=await button.boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(48);expect(bounds.height).toBeGreaterThanOrEqual(48);
 expect(await button.locator('i').evaluate(node=>getComputedStyle(node).maskImage)).toContain('data:image/svg+xml');
 expect(await page.locator('link[href*="cdnjs"]').count()).toBe(0);
});
test('chat envia intervalo explícito e cartão mensal abre o mês correto',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixtures(page);let payload;
 await page.route(BACKEND+'/assistant/chat',r=>{
 payload=r.request().postDataJSON();const analysis={startMonth:'2026-07',endMonth:'2026-09',total:60,count:3,months:['2026-07','2026-08','2026-09'].map(month=>({month,total:20,count:1}))};
 return r.fulfill({contentType:'text/event-stream',body:[{type:'start',context:payload.context,analysis},{type:'text',text:'Você registrou R$ 60 nos três meses.'},{type:'end'}].map(event=>'data: '+JSON.stringify(event)+'\n\n').join('')});
 });
 await page.goto('/index.html#assistente');await page.locator('.chat-period summary').click();await page.getByRole('button',{name:'3 meses',exact:true}).click();
 await expect(page.locator('.chat-period summary')).toContainText('jul.');
 await page.locator('.chat-period summary').click();await page.locator('#assistantText').fill('Compare os três meses');await page.getByRole('button',{name:'Enviar mensagem'}).click();
 await expect(page.locator('.chat-analysis')).toContainText('60,00');expect(payload.context).toMatchObject({month:'2026-09',startMonth:'2026-07'});
 await page.getByRole('button',{name:/Ver gastos de jul/}).click();await expect(page.locator('body')).toHaveAttribute('data-app-view','casa');await expect(page.locator('#seletorMes')).toHaveValue('07/2026');
});
test('campos da IA alinhados e efeitos dispensáveis com movimento reduzido',async({page})=>{
 await page.setViewportSize({width:1366,height:844});await page.emulateMedia({reducedMotion:'reduce'});await fixtures(page);await page.goto('/index.html#ajustes');await expect(page.locator('#aiModel')).toBeEnabled();
 const a=await page.locator('#aiProvider').boundingBox(),b=await page.locator('#aiModel').boundingBox();expect(a.height).toBe(b.height);expect(a.y).toBe(b.y);
 await page.evaluate(()=>window.GastosNavigation.show('resumo',{instant:true}));expect(await page.locator('.finance-sculpture').first().evaluate(node=>getComputedStyle(node).transitionDuration)).toBe('0s');
});
test('cartão calculado do intervalo é retomado após reload sem entrar no texto enviado à IA',async({page})=>{
 await fixtures(page);const rows=new Map();const analysis={startMonth:'2026-07',endMonth:'2026-09',total:30,count:2,months:[{month:'2026-07',total:10,count:1},{month:'2026-08',total:0,count:0},{month:'2026-09',total:20,count:1}]};
 const key=context=>JSON.stringify([context.scope,context.month,context.startMonth||null]);let sent;
 await page.route(BACKEND+'/assistant/conversation?**',r=>{const params=Object.fromEntries(new URL(r.request().url()).searchParams);return r.fulfill({json:{conversation:rows.get(key(params))||null}})});
 await page.route(BACKEND+'/assistant/chat',r=>{
 sent=r.request().postDataJSON();const row={id:'33333333-3333-4333-8333-333333333333',revision:1,messages:[{role:'user',content:sent.messages.at(-1).content},{role:'assistant',content:'Resumo do intervalo.',analysis}]};rows.set(key(sent.context),row);
 return r.fulfill({contentType:'text/event-stream',body:[{type:'start',analysis,conversation:{id:row.id,revision:0}},{type:'text',text:'Resumo do intervalo.'},{type:'end',conversation:{id:row.id,revision:1}}].map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')});
 });
 await page.goto('/index.html#assistente');await page.locator('.chat-period summary').click();await page.getByRole('button',{name:'3 meses',exact:true}).click();await page.locator('.chat-period summary').click();
 await page.locator('#assistantText').fill('Compare o intervalo');await page.getByRole('button',{name:'Enviar mensagem'}).click();await expect(page.locator('#assistantComposerStatus')).toContainText('Resposta concluída');
 await page.reload();await page.locator('.chat-period summary').click();await page.getByRole('button',{name:'3 meses',exact:true}).click();await expect(page.locator('.chat-analysis')).toContainText('30,00');await expect(page.locator('.chat-month-bars button')).toHaveCount(3);
 await page.locator('.chat-period summary').click();await page.locator('#assistantText').fill('Explique a tendência');await page.getByRole('button',{name:'Enviar mensagem'}).click();await expect(page.locator('#assistantComposerStatus')).toContainText('Resposta concluída');
 expect(sent.messages).toHaveLength(3);expect(sent.messages.every(message=>Object.keys(message).sort().join(',')==='content,role')).toBe(true);
});
test('intervalo atrasado não substitui a seleção nova e resumo inválido tem erro acionável',async({page})=>{
 await fixtures(page);let release;
 await page.route(BACKEND+'/assistant/conversation?**',async r=>{
 const params=new URL(r.request().url()).searchParams;
 if(params.get('startMonth')==='2026-07'){await new Promise(resolve=>{release=resolve});await r.fulfill({json:{conversation:{id:'33333333-3333-4333-8333-333333333333',revision:1,messages:[{role:'user',content:'Conversa antiga'},{role:'assistant',content:'Resposta antiga'}]}}}).catch(()=>{});}
 else await r.fulfill({json:{conversation:null}});
 });
 await page.goto('/index.html#assistente');await page.locator('.chat-period summary').click();await page.getByRole('button',{name:'3 meses',exact:true}).click();await expect.poll(()=>typeof release).toBe('function');await page.getByRole('button',{name:'6 meses',exact:true}).click();release();
 await expect(page.locator('#assistantWelcome')).toBeVisible();await expect(page.locator('.chat-message')).toHaveCount(0);await expect(page.locator('.chat-period summary')).toContainText('abr.');await page.locator('.chat-period summary').click();
 await page.route(BACKEND+'/assistant/chat',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({type:'start',analysis:{startMonth:'2026-04',endMonth:'2026-09',total:99,count:1,months:[]}})+'\n\n'}));
 await page.locator('#assistantText').fill('Analise o período');await page.getByRole('button',{name:'Enviar mensagem'}).click();await expect(page.locator('#assistantError')).toContainText('incompleto');await expect(page.locator('.chat-analysis')).toHaveCount(0);await expect(page.locator('#assistantRetry')).toBeVisible();
});
