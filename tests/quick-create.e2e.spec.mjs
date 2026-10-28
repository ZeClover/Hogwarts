import {openDisclosure} from './browser-helpers.mjs';
import {officeAction,officeSubmit} from './browser-helpers.mjs';
import {saveDraft} from './browser-helpers.mjs';
import {dismissIncidentalDiscoveries} from './browser-helpers.mjs';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture} from './helpers.mjs';
import {settleAnimations,openPolicy} from './browser-helpers.mjs';
let f;
test.use({actionTimeout:10000});
test.beforeAll(async()=>{f=await fixture();});test.afterAll(async()=>{await f?.close();});
async function login(page){await dismissIncidentalDiscoveries(page);await page.goto(f.config.origin+'/entrar');await officeAction(page.getByLabel('E-mail',{exact:true}),'fill','master@test.invalid');await officeAction(page.getByLabel('Senha',{exact:true}),'fill',f.password);await officeAction(page.getByRole('button',{name:'Entrar nos arquivos',includeHidden:true}),'click');await expect(page.locator('.top')).toBeVisible();}
async function accessible(page){await settleAnimations(page);const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}

test('missão só com título mantém campos entre abas, política privada e publicação separada',async({page})=>{
 await login(page);await page.goto(f.config.origin+'/portal/mestre/oficinas/missoes/novo');
 await expect(page.locator('[type=checkbox]')).toHaveCount(0);await expect(page.locator('[type=file]:visible')).toHaveCount(0);await expect(page.getByRole('button',{name:'Adicionar imagem',exact:true})).toBeVisible();
 await officeAction(page.getByLabel('Título',{exact:true}),'fill','MISSÃO RÁPIDA DA FIXTURE');const help=page.locator('[data-office-help] details');await expect(help).not.toHaveAttribute('open','');await officeAction(help.locator('summary'),'click');await expect(page.getByLabel('Título',{exact:true})).toHaveValue('MISSÃO RÁPIDA DA FIXTURE');await officeAction(page.getByLabel('Tipo',{exact:true}),'selectOption','Missão de grupo');await page.screenshot({path:'/tmp/hogwarts-v5-help-creator.png',fullPage:true});await officeAction(help.locator('summary'),'click');await expect(page.getByLabel('Tipo',{exact:true})).toHaveValue('Missão de grupo');await officeSubmit(page.getByRole('button',{name:'Criar rascunho',exact:true,includeHidden:true}));
 await expect(page.getByRole('heading',{name:'Editar missão',exact:true})).toBeVisible();
 const id=new URL(page.url()).pathname.split('/').pop();
 await expect(page.getByRole('tab')).toHaveCount(9);
 await officeAction(page.getByLabel('Título',{exact:true}),'fill','MISSÃO EDITADA NA FIXTURE');
 await officeAction(page.getByRole('tab',{name:'NPCs/locais',exact:true}),'click');await officeAction(page.getByLabel('Gancho público',{exact:true}),'fill','Texto preparado sem publicar.');
 expect((await f.master.request('/api/master/campaign/quests/'+id)).value.payload.title).toBe('MISSÃO RÁPIDA DA FIXTURE');
 await openPolicy(page);await officeAction(page.getByLabel('Público',{exact:true}),'selectOption','ALL');
 await saveDraft(page);await expect(page.locator('#toast')).toContainText('Alterações salvas.');
 const saved=(await f.master.request('/api/master/campaign/quests/'+id)).value;
 expect(saved.status).toBe('DRAFT');expect(saved.payload.title).toBe('MISSÃO EDITADA NA FIXTURE');expect(saved.payload.hook).toBe('Texto preparado sem publicar.');
 expect((await f.atlas.request('/api/campaign/quests')).value.items).toEqual([]);
 await officeAction(page.getByRole('tab',{name:'História',exact:true}),'focus');await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'NPCs/locais',exact:true})).toBeFocused();
 await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'Publicação',exact:true})).toBeFocused();
 const before=f.db.prepare('SELECT count(*) n FROM audit_log').get().n;
 const characters=(await f.master.request('/api/master/state')).value.characters.map(c=>c.id);expect(characters).toHaveLength(5);
 for(const character of characters){
  await officeAction(page.getByLabel('Personagem da prévia',{exact:true}),'selectOption',character);await officeAction(page.getByRole('button',{name:'Conferir leitura',exact:true,includeHidden:true}),'click');await expect(page.locator('#campaign-preview-result')).toContainText('Ainda não integra o Diário');
 }
 expect(f.db.prepare('SELECT count(*) n FROM audit_log').get().n).toBe(before);
 await accessible(page);await page.setViewportSize({width:390,height:844});await accessible(page);
 for(const table of ['reward_grants','certificate_issues'])expect(f.db.prepare('SELECT count(*) n FROM '+table).get().n).toBe(0);
});

test('item e NPC nascem sem imagem nem preço, e clique repetido não duplica rascunho',async({page})=>{
 await page.setViewportSize({width:390,height:844});await login(page);
 for(const [path,label,name,api] of [['itens','Nome','ITEM MÍNIMO DA FIXTURE','items'],['npcs','Nome público','NPC MÍNIMO DA FIXTURE','npcs']]){
  await page.goto(f.config.origin+'/portal/mestre/oficinas/'+path+'/novo');
  await expect(page.locator('[type=checkbox]')).toHaveCount(0);await expect(page.getByLabel('Foto (opcional)',{exact:true})).not.toHaveAttribute('required','');await accessible(page);
  await officeAction(page.getByLabel(label,{exact:true}),'fill',name);
  await page.evaluate(()=>{const f=document.querySelector('[data-quick-create]');f.requestSubmit();f.requestSubmit();});
  await expect(page.getByRole('heading',{name:path==='itens'?'Editar item':'Editar NPC',exact:true})).toBeVisible();
  const id=new URL(page.url()).pathname.split('/').pop(),saved=(await f.master.request('/api/master/workshop/'+api+'/'+id)).value;
  expect(saved.status).toBe('DRAFT');
  const list=(await f.master.request('/api/master/workshop/'+api)).value.items;
  expect(list.filter(r=>r.payload.name===name)).toHaveLength(1);
  await page.reload();await expect(page.getByLabel(label,{exact:true})).toHaveValue(name);
  await expect(page.locator('[data-compact-policy]')).not.toHaveAttribute('open','');
  expect((await f.atlas.request('/api/workshop/'+api+'/'+id)).status).toBe(404);
  if(api==='items'){expect(saved.private.referenceValueNuques).toBeNull();expect(saved.private.chosenPriceNuques).toBeNull();}
  await accessible(page);
 }
});

test('abrir criação avançada conserva o texto já digitado e todos os recursos existentes',async({page})=>{
 await login(page);await page.goto(f.config.origin+'/portal/mestre/oficinas/itens/novo');
 await officeAction(page.getByLabel('Nome',{exact:true}),'fill','OBJETO EM PREPARAÇÃO');await officeAction(page.getByLabel('Descrição (opcional)',{exact:true}),'fill','Texto que não pode se perder.');
 await officeAction(page.getByRole('button',{name:'Usar criação avançada',exact:true,includeHidden:true}),'click');
 await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('OBJETO EM PREPARAÇÃO');await expect(page.getByLabel('Descrição revelada',{exact:true})).toHaveValue('Texto que não pode se perder.');
 for(const title of ['Imagem e corte','Propriedades e fabricação','Avançado: efeitos estruturados antigos','Valores e segredos do Mestre']){await openDisclosure(page,title);await expect(page.getByText(title,{exact:true})).toBeVisible();}
});
