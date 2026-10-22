import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture} from './helpers.mjs';
import {settleAnimations} from './browser-helpers.mjs';
let f,shop;
const policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
test.beforeAll(async()=>{
 f=await fixture();
 await f.master.request('/api/master/regions/hogsmeade',{method:'PATCH',body:{isOpen:true,audience:'SELECTED',characters:['atlas'],groups:[]}});
 const created=await f.master.request('/api/master/content/shops',{method:'POST',body:{payload:{title:'Loja de Olivaras',description:'Atendimento da loja.',locationId:'olivaras',npcId:null,fileId:null,alt:'',hasCatalog:true,available:true},policy,privateNotes:'SEGREDO DA LOJA'}});
 expect(created.status).toBe(201);
 shop=(await f.master.request('/api/master/content/shops/'+created.value.id+'/publish',{method:'POST',body:{version:created.value.version}})).value;
});
test.afterAll(async()=>{await f?.close();});
async function login(page,email){await page.goto(f.config.origin+'/entrar');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Entrar nos arquivos'}).click();await expect(page.locator('.top')).toBeVisible();}
async function accessible(page){await settleAnimations(page);const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}

test('menu de cinco ações, Diário direto, escola em dois cliques e navegação acessível no celular',async({page})=>{
 await page.setViewportSize({width:390,height:844});await login(page,'atlas@test.invalid');
 const nav=page.getByRole('navigation',{name:'Principal',exact:true});
 await expect(nav.getByRole('link')).toHaveText(['Início','Explorar','Diário','Acervos','Correio']);
 await expect(page.locator('.master-bar')).toHaveCount(0);
 expect(await nav.getByRole('link').evaluateAll(links=>links.every(a=>a.getBoundingClientRect().height>=44))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await accessible(page);
 await nav.getByRole('link',{name:'Diário',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Diário',exact:true})).toBeVisible();
 for(const name of ['Missões em Grupo','Histórias Individuais','Investigações'])await expect(page.locator('main').getByRole('link',{name:new RegExp('^'+name)})).toBeVisible();
 await page.getByRole('link',{name:/^Missões em Grupo/}).click();
 await expect(page.getByRole('heading',{name:'Diário de Missões'})).toBeVisible();
 await expect(nav.getByRole('link',{name:'Diário',exact:true})).toHaveAttribute('aria-current','page');
 await nav.getByRole('link',{name:'Início',exact:true}).click();
 await page.getByRole('link',{name:/^Hogwarts Biblioteca/}).click();
 await page.getByRole('link',{name:/^Biblioteca Acervo escolar/}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca',exact:true})).toBeVisible();
 await nav.getByRole('link',{name:'Acervos',exact:true}).click();
 await expect(page.locator('.context-links').getByRole('link')).toHaveCount(5);
 await expect(page.locator('main').getByRole('link',{name:'Diário de Missões'})).toHaveCount(0);
 await accessible(page);
 await page.setViewportSize({width:1440,height:900});await accessible(page);
 await nav.getByRole('link',{name:'Explorar',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Explorar',exact:true})).toBeVisible();
 await page.getByLabel('Buscar região').fill('Hogwarts');await page.getByRole('button',{name:'Buscar',exact:true}).click();
 await page.getByRole('link',{name:'Hogwarts Abrir região'}).click();await page.goBack();
 await expect(page.getByLabel('Buscar região')).toHaveValue('Hogwarts');
});

test('região autorizada abre catálogo direto e Voltar conserva lista e filtro',async({page})=>{
 await login(page,'atlas@test.invalid');await page.getByRole('navigation',{name:'Principal'}).getByRole('link',{name:'Explorar',exact:true}).click();
 await page.getByRole('link',{name:'Hogsmeade Abrir região'}).click();
 await page.getByRole('button',{name:'Lista',exact:true}).click();
 await page.getByLabel('Buscar local').fill('Olivaras');await page.getByRole('button',{name:'Buscar locais'}).click();
 await page.getByRole('link',{name:'Olivaras ›',exact:true}).click();
 await expect(page).toHaveURL(f.config.origin+'/portal/catalogo/'+shop.id);
 await expect(page.getByRole('heading',{name:'Loja de Olivaras',exact:true})).toBeVisible();
 await page.goBack();await expect(page.getByLabel('Buscar local')).toHaveValue('Olivaras');
 await expect(page.getByRole('button',{name:'Lista',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.map-image')).toHaveCount(0);
 await page.goto(f.config.origin+'/portal/local/olivaras');await expect(page.getByRole('heading',{name:'Olivaras',exact:true})).toBeVisible();
 await page.goto(f.config.origin+'/portal/missoes');await expect(page.getByRole('heading',{name:'Diário de Missões'})).toBeVisible();
});

test('região fechada é omitida do estado, da home, de Explorar e da busca individual',async({page})=>{
 await login(page,'eiris@test.invalid');
 const state=await page.evaluate(async()=>await(await fetch('/api/state')).json());
 expect(JSON.stringify(state)).not.toMatch(/hogsmeade|Olivaras|Dedosdemel|SEGREDO DA LOJA/);
 await expect(page.locator('main').getByText('Hogsmeade',{exact:true})).toHaveCount(0);
 await page.getByRole('navigation',{name:'Principal'}).getByRole('link',{name:'Explorar',exact:true}).click();
 await page.getByLabel('Buscar região').fill('Hogsmeade');await page.getByRole('button',{name:'Buscar',exact:true}).click();
 await expect(page.getByText('Nenhuma região disponível neste filtro.')).toBeVisible();
 const denied=await page.evaluate(async id=>Promise.all(['/api/world/regions/hogsmeade','/api/locations/olivaras','/api/content/shops/'+id].map(async p=>(await fetch(p)).status)),shop.id);
 expect(denied).toEqual([404,404,404]);
 await page.goto(f.config.origin+'/portal/catalogo/'+shop.id);await expect(page.locator('main')).not.toContainText('Loja de Olivaras');
});
