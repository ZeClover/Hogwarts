import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {fixture,commercialFixture} from './helpers.mjs';
import {quickCreateRequest} from '../public/quick-create.js';
import {settleAnimations} from './browser-helpers.mjs';
test('entrega direta coloca item no inventário e conclusão registra selo no Diário',async({page})=>{
 const f=await fixture();try{
 const policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
 let q=(await f.master.request('/api/master/campaign/quests',{method:'POST',body:{...quickCreateRequest('quests',new Map([['name','MISSÃO PARA VALIDAR ENTREGA']]),{currentAcademicYear:''}).body,policy}})).value;
 for(const action of ['publish','release','start']){const r=await f.master.request('/api/master/campaign/quests/'+q.id+'/'+action,{method:'POST',body:{version:q.version,...(action==='publish'?{}:{characters:['atlas']})}});expect(r.status).toBe(200);q=r.value;}
 const c=await commercialFixture(f);await page.goto(f.config.origin+'/entrar');await page.getByLabel('E-mail',{exact:true}).fill('master@test.invalid');await page.getByLabel('Senha',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Entrar nos arquivos'}).click();await expect(page.locator('.top')).toBeVisible();
 await page.goto(f.config.origin+'/portal/mestre/documentos/'+q.id);const form=page.locator('[data-document-form=immediate]');await form.locator('[name=characters][value=atlas]').check();await form.getByLabel('Tipo de prêmio',{exact:true}).selectOption('ITEM');await form.getByLabel('Item existente',{exact:true}).selectOption(c.item.id);await form.getByRole('button',{name:'Entregar aos selecionados',exact:true}).click();await expect(page.locator('#toast')).toContainText('Recompensa entregue');expect((await f.atlas.request('/api/documents/inventory')).value.items[0].itemId).toBe(c.item.id);
 const closed=await f.master.request('/api/master/campaign/quests/'+q.id+'/close',{method:'POST',body:{version:q.version,result:'SUCCESS',epilogue:'Conclusão usada apenas na validação.',date:'',privateNotes:'SEGREDO INTERNO'}});expect(closed.status).toBe(200);
 await page.setViewportSize({width:390,height:844});await page.goto(f.config.origin+'/portal/diario?view_as=atlas');await expect(page.locator('.diary-seal')).toContainText('MISSÃO PARA VALIDAR ENTREGA');await expect(page.locator('.diary-seal')).not.toContainText('SEGREDO');await settleAnimations(page);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);await mkdir('docs/screenshots/revisao-completa/after',{recursive:true});await page.screenshot({path:'docs/screenshots/revisao-completa/after/selo-mobile.png',fullPage:true});
 await page.goto(f.config.origin+'/portal/documentos?view_as=atlas');await expect(page.locator('main')).toContainText('MERCADORIA DE TESTE');expect((await f.eiris.request('/api/documents/seals')).value.items).toEqual([]);
 }finally{await f.close();}
});
