import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture} from './helpers.mjs';
import {contentDraftDefaults} from '../public/quick-create.js';
import {settleAnimations} from './browser-helpers.mjs';
let f;
test.use({actionTimeout:10000});
test.beforeAll(async()=>{f=await fixture();});test.afterAll(async()=>{await f?.close();});
async function login(page,email='master@test.invalid'){await page.goto(f.config.origin+'/entrar');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Entrar nos arquivos'}).click();await expect(page.locator('.top')).toBeVisible();}

test('seis criadores usam só título e conservam rascunhos, sem associar primeiro item/local automaticamente',async({page})=>{
 await page.setViewportSize({width:390,height:844});await login(page);
 for(const kind of ['books','lessons','shops','offers','regions','places']){
  await page.goto(f.config.origin+'/portal/mestre/oficinas/conteudos/'+kind+'/novo');
  const form=page.locator('[data-content-form="quick"]');await expect(form).toBeVisible();await expect(form.locator('[required]')).toHaveCount(1);await expect(page.locator('[type=file],[type=checkbox]')).toHaveCount(0);
  await form.locator('[name=name]').fill('MÍNIMO '+kind);
  await page.evaluate(()=>{const form=document.querySelector('[data-content-form="quick"]');form.requestSubmit();form.requestSubmit();});
  await page.waitForURL(url=>url.pathname.startsWith('/portal/mestre/oficinas/conteudos/'+kind+'/')&&!url.pathname.endsWith('/novo'));
  const id=new URL(page.url()).pathname.split('/').pop(),saved=(await f.master.request('/api/master/content/'+kind+'/'+id)).value;
  expect(saved.status).toBe('DRAFT');expect(saved.payload.title).toBe('MÍNIMO '+kind);
  expect((await f.atlas.request('/api/content/'+kind+'/'+id)).status).toBe(404);
  const matching=(await f.master.request('/api/master/content/'+kind)).value.items.filter(r=>r.payload.title==='MÍNIMO '+kind);expect(matching).toHaveLength(1);
  if(kind==='offers'){expect(saved.payload.priceNuques).toBeNull();await expect(page.locator('[name="payload.itemId"]')).toHaveValue('');await expect(page.locator('[name="payload.shopId"]')).toHaveValue('');}
  if(kind==='shops')await expect(page.locator('[name="payload.locationId"]')).toHaveValue('');
  await page.locator('[name="payload.title"]').fill('EDITADO '+kind);await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await expect(page.locator('#toast')).toContainText('Rascunho salvo.');
  await page.reload();await expect(page.locator('[name="payload.title"]')).toHaveValue('EDITADO '+kind);
  await settleAnimations(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations.map(v=>v.id)).toEqual([]);
});

test('oferta sem vínculos/preço não publica e a criação avançada mantém o título digitado',async({page})=>{
 await login(page);await page.goto(f.config.origin+'/portal/mestre/oficinas/conteudos/offers/novo');await page.getByLabel('Nome',{exact:true}).fill('OFERTA RÁPIDA');await page.getByRole('button',{name:'Usar criação avançada',exact:true}).click();
 await expect(page.locator('[name="payload.title"]')).toHaveValue('OFERTA RÁPIDA');
 await page.getByRole('button',{name:'Criar rascunho',exact:true}).click();await expect(page.getByRole('button',{name:'Revisar publicação',exact:true})).toBeVisible();
 const id=new URL(page.url()).pathname.split('/').pop();await page.getByRole('button',{name:'Revisar publicação',exact:true}).click();await page.getByRole('button',{name:'Confirmar ação',exact:true}).click();
 await expect(page.locator('#toast')).toContainText('Complete Item do catálogo');
 expect((await f.master.request('/api/master/content/offers/'+id)).value.status).toBe('DRAFT');
 expect(f.db.prepare('SELECT count(*) n FROM offer_stock').get().n).toBe(0);
});

test('resposta lenta salva o rascunho sem levar o Mestre de volta à página que ele deixou',async({page})=>{
 await login(page);let release,received;
 const held=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{received=resolve;});
 await page.route('**/api/master/content/books',async route=>{if(route.request().method()==='POST'){received();await held;}await route.continue();});
 try{
  await page.goto(f.config.origin+'/portal/mestre/oficinas/conteudos/books/novo');await page.getByLabel('Título da obra',{exact:true}).fill('RASCUNHO COM RESPOSTA LENTA');
  await page.getByRole('button',{name:'Criar rascunho',exact:true}).click();await started;
  await page.getByRole('navigation',{name:'Principal',exact:true}).getByRole('link',{name:'Central',exact:true}).click();release();
  await expect(page.locator('#toast')).toContainText('Rascunho privado criado.');await expect(page).toHaveURL(f.config.origin+'/portal/mestre');
  const items=(await f.master.request('/api/master/content/books')).value.items;expect(items.filter(r=>r.payload.title==='RASCUNHO COM RESPOSTA LENTA')).toHaveLength(1);
 }finally{release();await page.unroute('**/api/master/content/books');}
});

test('região sem mapa oferece lista, local sem foto usa composição tipográfica e link antigo de Hogwarts funciona',async({page})=>{
 const context=(await f.master.request('/api/master/content/context')).value,year=(await f.master.request('/api/state')).value.calendar.academicYear,policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
 async function publish(kind,title,extra={}){let r=await f.master.request('/api/master/content/'+kind,{method:'POST',body:{payload:{...contentDraftDefaults(kind,context.schemas[kind].fields,year),title,...extra},policy,privateNotes:''}});expect(r.status).toBe(201);r=await f.master.request('/api/master/content/'+kind+'/'+r.value.id+'/publish',{method:'POST',body:{version:r.value.version}});expect(r.status).toBe(200);return r.value;}
 const region=await publish('regions','REGIÃO SEM MAPA DA FIXTURE');await f.master.request('/api/master/regions/'+region.id,{method:'PATCH',body:{isOpen:true,audience:'ALL',characters:[],groups:[]}});
 const place=await publish('places','LOCAL SEM FOTO DA FIXTURE',{regionId:region.id,kind:'ARCHIVE'});await f.master.request('/api/master/locations/'+place.id,{method:'PATCH',body:{enabled:true,isSecret:true,audience:'ALL',characters:['atlas'],groups:[],x:null,y:null}});
 const invalid=[];page.on('request',request=>{if(/\/(?:null|undefined)(?:$|\?)/.test(request.url()))invalid.push(request.url());});
 await login(page,'atlas@test.invalid');await page.goto(f.config.origin+'/portal/regiao/'+region.id);
 await expect(page.getByRole('button',{name:'Mapa',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Lista',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.map-image')).toHaveCount(0);
 await page.getByRole('link',{name:'LOCAL SEM FOTO DA FIXTURE ›',exact:true}).click();await expect(page.locator('.media-mast.no-image')).toBeVisible();expect(invalid).toEqual([]);
 await page.goto(f.config.origin+'/portal/regiao/hogwarts');await expect(page).toHaveURL(f.config.origin+'/portal/hogwarts');await expect(page.getByRole('heading',{name:'O Castelo de Hogwarts',exact:true})).toBeVisible();
});
