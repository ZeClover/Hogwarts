import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture} from './helpers.mjs';
import {contentDraftDefaults} from '../public/quick-create.js';
import {settleAnimations} from './browser-helpers.mjs';
let f;
test.beforeAll(async()=>{f=await fixture();});test.afterAll(async()=>{await f?.close();});
async function login(page,email='master@test.invalid'){await page.goto(f.config.origin+'/entrar');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Entrar nos arquivos'}).click();await expect(page.locator('.top')).toBeVisible();}

test('oito criadores compactos persistem; edição vazia do Profeta não publica, depois preserva campos avançados',async({page})=>{
 await page.setViewportSize({width:390,height:844});await login(page);
 for(const kind of ['newspapers','boards','notices','years','events','timetables','yearbooks','retrospectives']){
  await page.goto(f.config.origin+'/portal/mestre/oficinas/conteudos/'+kind+'/novo');const form=page.locator('[data-content-form=quick]');await expect(form).toBeVisible();await expect(form.locator('[required]')).toHaveCount(kind==='newspapers'?0:1);
  if(kind!=='newspapers')await form.locator('[name=name]').fill('MÍNIMO '+kind);
  await form.getByRole('button',{name:'Criar rascunho',exact:true}).click();await expect(page.getByRole('heading',{name:/^Editar /})).toBeVisible();
  const id=new URL(page.url()).pathname.split('/').pop();expect((await f.atlas.request('/api/content/'+kind+'/'+id)).status).toBe(404);
  const detail=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Conteúdo e vínculos$/})});if(await detail.count())await expect(detail).not.toHaveAttribute('open');
  if(kind==='newspapers'){
   await page.getByRole('button',{name:'Revisar publicação',exact:true}).click();await page.getByRole('button',{name:'Confirmar ação',exact:true}).click();await expect(page.locator('#toast')).toContainText('Complete Título da edição');
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByLabel('Título da edição',{exact:true}).fill('EDIÇÃO ESCRITA');await detail.locator('summary').click();await page.getByLabel('Número da edição',{exact:true}).fill('1');await page.getByLabel('Manchete',{exact:true}).fill('MANCHETE ESCRITA');await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await expect(page.locator('#toast')).toContainText('Rascunho salvo.');
   await page.reload();expect((await f.master.request('/api/master/content/newspapers/'+id)).value.payload.headline).toBe('MANCHETE ESCRITA');
  }
  await settleAnimations(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('Início mostra poucos destaques e links diretos para publicações reais, sem notas privadas',async({page})=>{
 const ctx=(await f.master.request('/api/master/content/context')).value,year=(await f.master.request('/api/state')).value.calendar.academicYear,policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
 for(let i=0;i<6;i++){const payload={...contentDraftDefaults('events',ctx.schemas.events.fields,year),title:'EVENTO AUTORIZADO '+i};let r=(await f.master.request('/api/master/content/events',{method:'POST',body:{payload,policy,privateNotes:'NOTA SECRETA'}})).value;r=await f.master.request('/api/master/content/events/'+r.id+'/publish',{method:'POST',body:{version:r.version}});expect(r.status).toBe(200);}
 await login(page,'atlas@test.invalid');const panel=page.locator('.note-panel').filter({has:page.getByRole('heading',{name:'Novidades',exact:true})});await expect(panel.locator('.context-link:visible')).toHaveCount(5);await expect(panel).not.toContainText('NOTA SECRETA');
 await panel.locator('summary').click();await expect(panel.locator('.context-link:visible')).toHaveCount(6);await panel.locator('.context-link').first().click();await expect(page).toHaveURL(/\/portal\/conteudos\/events\//);await expect(page.locator('.content-record')).toContainText('EVENTO AUTORIZADO');
});
