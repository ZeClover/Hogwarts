import {officeAction,officeSubmit} from './browser-helpers.mjs';
import {dismissIncidentalDiscoveries} from './browser-helpers.mjs';
import {openDisclosure} from './browser-helpers.mjs';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture} from './helpers.mjs';
import {settleAnimations} from './browser-helpers.mjs';
let f;
test.use({actionTimeout:10000});
test.beforeAll(async()=>{f=await fixture();});test.afterAll(async()=>{await f?.close();});
async function login(page){await dismissIncidentalDiscoveries(page);await page.goto(f.config.origin+'/entrar');await officeAction(page.getByLabel('E-mail',{exact:true}),'fill','master@test.invalid');await officeAction(page.getByLabel('Senha',{exact:true}),'fill',f.password);await officeAction(page.getByRole('button',{name:'Entrar nos arquivos',includeHidden:true}),'click');await expect(page.locator('.top')).toBeVisible();}
const route='/portal/mestre/oficinas/conteudos/newspapers/novo';
for(const width of [1440,390])test('notícia com dois campos publica sem calendário; leitura, edição privada e acessibilidade em '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});await login(page);await page.goto(f.config.origin+route);
 await officeAction(page.getByLabel('Manchete',{exact:true}),'fill','MANCHETE DA FIXTURE '+width);await officeAction(page.getByLabel('Notícia',{exact:true}),'fill','Texto de validação, não é conteúdo da campanha.');
 await settleAnimations(page);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await officeAction(page.getByRole('button',{name:'Publicar notícia para todos',exact:true,includeHidden:true}),'click');await expect(page.locator('#toast')).toContainText('Notícia publicada');
 const id=new URL(page.url()).pathname.split('/').pop(),saved=(await f.master.request('/api/master/content/newspapers/'+id)).value;
 expect(saved.status).toBe('PUBLISHED');expect(saved.payload.number).toMatch(/^\d+$/);
 for(const c of [f.atlas,f.eiris]){const r=await c.request('/api/content/newspapers/'+id);expect(r.status).toBe(200);expect(r.value.sections[0].text).toBe('Texto de validação, não é conteúdo da campanha.');}
 await officeAction(page.getByLabel('Notícia',{exact:true}),'fill','Alteração privada');await officeSubmit(page.getByRole('button',{name:'Salvar rascunho',exact:true,includeHidden:true}));await expect(page.locator('#toast')).toContainText(/Rascunho salvo|Alterações salvas/);
 expect((await f.atlas.request('/api/content/newspapers/'+id)).value.sections[0].text).not.toContain('Alteração privada');
});
test('avançado conserva notícia, imagem e ALT; falha de publicação preserva rascunho',async({page})=>{
 await login(page);await page.goto(f.config.origin+route);await officeAction(page.getByLabel('Manchete',{exact:true}),'fill','TEXTO PRESERVADO');await officeAction(page.getByLabel('Notícia',{exact:true}),'fill','Texto antes de abrir detalhes');await openDisclosure(page,'Imagem e descrição (opcionais)');await officeAction(page.getByLabel('Enviar imagem',{exact:true}),'setInputFiles','public/assets/hogwarts.webp');await officeAction(page.getByLabel('Descrição da imagem',{exact:true}),'fill','Castelo visto à distância');await officeAction(page.getByRole('button',{name:'Usar criação avançada',exact:true,includeHidden:true}),'click');
 await expect(page.getByLabel('Manchete',{exact:true})).toHaveValue('TEXTO PRESERVADO');await expect(page.getByLabel('Texto do artigo',{exact:true})).toHaveValue('Texto antes de abrir detalhes');await expect(page.getByLabel('Descrição da capa',{exact:true})).toHaveValue('Castelo visto à distância');
 expect(await page.locator('[name="upload.payload.fileId"]').evaluate(e=>e.files.length)).toBe(1);
 await page.goto(f.config.origin+route);await officeAction(page.getByLabel('Manchete',{exact:true}),'fill','FALHA DE PUBLICAÇÃO');await officeAction(page.getByLabel('Notícia',{exact:true}),'fill','Não perder esta notícia');await page.route('**/newspapers/*/publish',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Falha simulada'})}));await officeAction(page.getByRole('button',{name:'Publicar notícia para todos',exact:true,includeHidden:true}),'click');await expect(page.locator('#toast')).toContainText('Rascunho preservado');const id=new URL(page.url()).pathname.split('/').pop();expect((await f.master.request('/api/master/content/newspapers/'+id)).value.payload.articles[0].text).toBe('Não perder esta notícia');expect((await f.atlas.request('/api/content/newspapers/'+id)).status).toBe(404);
});
test('NPC reutiliza retrato sem tornar imagem ou perfil públicos',async({page})=>{
 const bytes=await import('node:fs/promises').then(m=>m.readFile('public/assets/hogwarts.webp'));const file=(await f.master.request('/api/master/workshop/files',{method:'POST',body:bytes,raw:true,headers:{'Content-Type':'image/webp'}})).value;
 await login(page);await page.goto(f.config.origin+'/portal/mestre/oficinas/npcs/novo');await officeAction(page.getByLabel('Nome público',{exact:true}),'fill','NPC DA FIXTURE');await officeAction(page.getByLabel('Descrição curta (opcional)',{exact:true}),'fill','Descrição para validação');await openDisclosure(page,'Escolher retrato da biblioteca');await officeAction(page.getByLabel('Imagem existente',{exact:true}),'selectOption',file.id);await officeAction(page.getByLabel('Descrição do retrato',{exact:true}),'fill','Retrato de validação');await officeSubmit(page.getByRole('button',{name:'Criar rascunho',exact:true,includeHidden:true}));await expect(page.getByRole('heading',{name:'Editar NPC',exact:true})).toBeVisible();const id=new URL(page.url()).pathname.split('/').pop(),saved=(await f.master.request('/api/master/workshop/npcs/'+id)).value;expect(saved.payload.portraitFileId).toBe(file.id);expect(saved.payload.portraitAlt).toBe('Retrato de validação');expect((await f.atlas.request('/api/workshop/npcs/'+id)).status).toBe(404);expect((await f.atlas.request('/api/master/workshop/files/'+file.id)).status).toBe(403);
});
