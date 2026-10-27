import {dismissIncidentalDiscoveries} from './browser-helpers.mjs';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {fixture} from './helpers.mjs';
let f;
test.use({actionTimeout:10000});
test.beforeAll(async()=>{f=await fixture();await mkdir('docs/screenshots/f3-1',{recursive:true});});
test.afterAll(async()=>{await f?.close();});
async function login(page,email){await dismissIncidentalDiscoveries(page);await page.goto(f.config.origin+'/entrar');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Entrar nos arquivos'}).click();await expect(page.locator('.top')).toBeVisible();}
test('calendário e grade continuam no backend, sem menus nem oficinas visíveis',async({page})=>{
 await login(page,'master@test.invalid');await page.goto(f.config.origin+'/portal/mestre');await expect(page.locator('[data-go*=calendario]')).toHaveCount(0);
 for(const kind of ['years','events','timetables']){await page.goto(f.config.origin+'/portal/mestre/oficinas/conteudos/'+kind+'/novo');await expect(page.locator('main')).toContainText('Seus dados antigos permanecem guardados.');expect((await f.master.request('/api/master/content/'+kind)).status).toBe(200);}
 await page.goto(f.config.origin+'/portal/calendario');await expect(page.locator('main')).toContainText('Os registros antigos continuam guardados.');expect((await f.atlas.request('/api/calendar')).status).toBe(200);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});
