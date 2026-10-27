import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture} from './helpers.mjs';
import {settleAnimations} from './browser-helpers.mjs';
let f;test.beforeAll(async()=>{f=await fixture();});test.afterAll(async()=>{await f?.close();});
test('seis criadores salvam com nome, revelações recolhidas e pool sem probabilidades inventadas',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(f.config.origin+'/entrar');await page.getByLabel('E-mail',{exact:true}).fill('master@test.invalid');await page.getByLabel('Senha',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Entrar nos arquivos'}).click();await expect(page.locator('.top')).toBeVisible();
 for(const kind of ['chocolatecards','bestiary','rarities','memories','curiosities','chocolatepools']){
  await page.goto(f.config.origin+'/portal/mestre/oficinas/conteudos/'+kind+'/novo');const form=page.locator('[data-content-form=quick]');await expect(form.locator('[required]')).toHaveCount(1);await form.locator('[name=name]').fill('MÍNIMO '+kind);await form.getByRole('button',{name:'Criar rascunho',exact:true}).click();await expect(page.getByRole('heading',{name:/^Editar /})).toBeVisible();
  const id=new URL(page.url()).pathname.split('/').pop();expect((await f.atlas.request('/api/content/'+kind+'/'+id)).status).toBe(404);await expect(page.locator('[name="payload.title"]')).toHaveValue('MÍNIMO '+kind);
  const operations=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Liberação e operações$/})});await expect(operations).not.toHaveAttribute('open');
  if(kind==='chocolatepools'){await operations.locator(':scope > summary').click();await expect(operations.getByText('Não configurada',{exact:true})).toHaveCount(4);await expect(operations.getByText('Não definido',{exact:true})).toHaveCount(4);await expect(page.locator('[name="payload.commonWeight"]')).toHaveValue('');}
  await settleAnimations(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});
