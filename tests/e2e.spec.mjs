import {settleAnimations} from './browser-helpers.mjs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { fixture } from './helpers.mjs';
let f;
test.beforeAll(async()=>{f=await fixture();await mkdir('docs/screenshots',{recursive:true});});
test.afterAll(async()=>{await f?.close();});
async function login(page,email) {
  await page.goto(f.config.origin+'/entrar');
  await page.getByLabel('E-mail',{exact:true}).fill(email);
  await page.getByLabel('Senha',{exact:true}).fill(f.password);
  await page.getByRole('button',{name:'Entrar nos arquivos'}).click();
  await expect(page.locator('.top')).toBeVisible();
}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
async function assetsHealthy(page){
  await expect.poll(()=>page.evaluate(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
}
async function accessible(page){
  await settleAnimations(page);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,description:v.description,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
}

test('login, teclado, perfil e região fechada em desktop e celular',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(f.config.origin+'/entrar');await assetsHealthy(page);await accessible(page);
  await page.screenshot({path:'docs/screenshots/login-desktop.png',fullPage:true});
  await page.keyboard.press('Tab');await expect(page.locator('.skip-link')).toBeFocused();
  await login(page,'atlas@test.invalid');
  await expect(page.getByRole('heading',{name:'Hogwarts',exact:true})).toBeVisible();
  await expect(page.getByText('Nenhuma novidade por enquanto.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-house','gryffindor');
  await noOverflow(page);await assetsHealthy(page);await accessible(page);
  await page.screenshot({path:'docs/screenshots/inicio-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await noOverflow(page);await accessible(page);
  await page.screenshot({path:'docs/screenshots/inicio-mobile.png',fullPage:true});
  await page.goto(f.config.origin+'/portal/hogsmeade');
  await expect(page.getByRole('heading',{name:'A vila está inacessível.'})).toBeVisible();
  await expect(page.locator('.location-dot')).toHaveCount(0);
  await page.screenshot({path:'docs/screenshots/hogsmeade-fechada-mobile.png',fullPage:true});
  await page.locator('.persona-link').click();
  await page.getByLabel('Biografia',{exact:true}).fill('Uma biografia de teste. <img src=x onerror=alert(1)>');
  await page.getByRole('button',{name:'Salvar biografia'}).click();
  await expect(page.locator('#toast')).toContainText('Alterações salvas.');
  await page.reload();await expect(page.getByLabel('Biografia',{exact:true})).toHaveValue('Uma biografia de teste. <img src=x onerror=alert(1)>');
  await expect(page.locator('.profile-card img')).toHaveCount(1);
  await page.getByLabel('Foto do personagem',{exact:true}).setInputFiles('public/assets/gryffindor.webp');
  await page.getByRole('button',{name:'Atualizar foto'}).click();
  await expect(page.locator('.portrait')).toHaveAttribute('src',/\/api\/media\//);await assetsHealthy(page);
  await page.getByRole('button',{name:'Remover foto'}).click();
  await expect(page.locator('.portrait')).toHaveAttribute('src','/assets/gryffindor.webp');
  await page.getByLabel('Biografia',{exact:true}).fill('');await page.getByRole('button',{name:'Salvar biografia'}).click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('.profile-card')).toHaveCSS('animation-name','none');
  await accessible(page);expect(errors).toEqual([]);
});

test('Mestre administra acessos, troca entre quatro Casas sem recarregar e vê catálogo vazio',async({page,browser})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});await login(page,'master@test.invalid');
  await expect(page.getByRole('heading',{name:'Central do Mestre'})).toBeVisible();
  await noOverflow(page);await accessible(page);
  await page.screenshot({path:'docs/screenshots/mestre-desktop.png',fullPage:true});
  const regionForm=page.locator('form[data-form="region"][data-id="hogsmeade"]');
  await regionForm.locator('[name="isOpen"]').check();
  await regionForm.locator('[name="audience"]').selectOption('SELECTED');
  await regionForm.locator('[name="characters"][value="atlas"]').check();
  await regionForm.getByRole('button',{name:'Salvar acesso'}).click();
  await expect(page.locator('#toast')).toContainText('Alterações salvas.');
  await page.evaluate(()=>{window.__noReload=1;});
  for(const [id,house] of [['atlas','gryffindor','sala_grifinoria'],['eiris','hufflepuff','sala_lufalufa'],['drake','ravenclaw','sala_corvinal'],['vane','slytherin','sala_sonserina']]){
    await page.locator('#preview-select').selectOption(id);
    await expect(page.locator('html')).toHaveAttribute('data-house',house);
    await expect(page.locator('.preview-bar')).toContainText('somente leitura');
    await expect(page.locator('.player-welcome img')).toHaveAttribute('src','/assets/'+house+'.webp');
    expect(await page.evaluate(()=>window.__noReload)).toBe(1);
    await assetsHealthy(page);await accessible(page);
    await page.screenshot({path:`docs/screenshots/casa-${house}.png`,fullPage:true});
    await page.getByRole('button',{name:'Voltar ao Mestre'}).click();
    await expect(page.locator('#preview-select')).toBeVisible();
  }
  await page.locator('#preview-select').selectOption('atlas');
  await page.locator('.navigation').getByRole('link',{name:'Explorar',exact:true}).click();await page.getByRole('link',{name:'Hogsmeade Abrir região'}).click();
  await expect(page.locator('.location-dot')).toHaveCount(4);
  await page.screenshot({path:'docs/screenshots/hogsmeade-desktop.png',fullPage:true});
  await page.getByRole('link',{name:'Olivaras',exact:true}).first().click();
  await expect(page.getByRole('heading',{name:'Olivaras',exact:true})).toBeVisible();
  await expect(page.getByText('Nenhum artigo exposto no momento.')).toBeVisible();
  await expect(page.getByText(/Discord|preço|Galeão|solicitar após RP/)).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await noOverflow(page);await accessible(page);
  await page.screenshot({path:'docs/screenshots/olivaras-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Voltar ao Mestre'}).click();
  await noOverflow(page);await accessible(page);
  await page.screenshot({path:'docs/screenshots/mestre-mobile.png',fullPage:true});
  // A different authenticated player remains barred from the selected region.
  const context=await browser.newContext({viewport:{width:390,height:844}});const other=await context.newPage();
  await login(other,'eiris@test.invalid');await other.goto(f.config.origin+'/portal/hogsmeade');
  await expect(other.getByRole('heading',{name:'A vila está inacessível.'})).toBeVisible();await context.close();
  expect(errors).toEqual([]);
});

test('convite real pelo painel conclui onboarding e aceitação aparece na auditoria',async({page,browser})=>{
  await login(page,'master@test.invalid');
  const form=page.locator('form[data-form="invite"]');
  await form.getByLabel('E-mail',{exact:true}).fill('drake@test.invalid');
  await form.getByLabel('Personagem',{exact:true}).selectOption('drake');
  await form.getByRole('button',{name:'Gerar convite'}).click();
  const url=await form.locator('.invite-url').inputValue();expect(url).toContain('/ativar#convite=');
  const context=await browser.newContext();const newcomer=await context.newPage();
  await newcomer.goto(url);await newcomer.getByLabel('E-mail',{exact:true}).fill('drake@test.invalid');
  await newcomer.getByLabel('Crie uma senha',{exact:true}).fill(f.password);
  await newcomer.getByRole('button',{name:'Aceitar convite'}).click();
  await expect(newcomer.locator('.persona-link')).toContainText('Drake Lovegood');
  await expect(newcomer.locator('html')).toHaveAttribute('data-house','ravenclaw');await context.close();
  await page.reload();await expect(page.locator('#audit')).toContainText('Convite aceito');
});
