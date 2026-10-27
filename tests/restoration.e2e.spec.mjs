import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture} from './helpers.mjs';
import {settleAnimations} from './browser-helpers.mjs';
let f;test.beforeAll(async()=>{f=await fixture();});test.afterAll(async()=>{await f?.close();});
async function login(page){await page.goto(f.config.origin+'/entrar');await page.getByLabel('E-mail',{exact:true}).fill('master@test.invalid');await page.getByLabel('Senha',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Entrar nos arquivos'}).click();await expect(page.locator('.top')).toBeVisible();}
for(const [id,house,room] of [['atlas','gryffindor','sala_grifinoria'],['darius','gryffindor','sala_grifinoria'],['eiris','hufflepuff','sala_lufalufa'],['vane','slytherin','sala_sonserina'],['drake','ravenclaw','sala_corvinal']]){
 test('Casa de '+id+' mantém hero duplo, tema, retornos e imagens em desktop/mobile',async({page})=>{
  await login(page);const writes=[];page.on('request',r=>{if(r.method()!=='GET'&&r.method()!=='HEAD')writes.push(r.url());});
  await page.goto(f.config.origin+'/portal/inicio?view_as='+id);await expect(page.locator('html')).toHaveAttribute('data-house',house);await expect(page.locator('.hero-castle')).toHaveAttribute('src','/assets/hogwarts_castelo_noite.webp');await expect(page.locator('.hero-room')).toHaveAttribute('src','/assets/'+room+'.webp');
  await page.setViewportSize({width:1440,height:1000});await settleAnimations(page);await page.screenshot({path:'/tmp/restauracao-after-'+id+'.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await settleAnimations(page);await page.screenshot({path:'/tmp/restauracao-mobile-'+id+'.png',fullPage:true});
  for(const route of ['sala-comunal','avisos','calendario','acervos','conteudos/books','conteudos/lessons','correio']){
   await page.goto(f.config.origin+'/portal/'+route+'?view_as='+id);await expect(page.locator('html')).toHaveAttribute('data-house',house);await expect(page.getByRole('navigation',{name:'Caminho da página'})).toBeVisible();
   await settleAnimations(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
   expect(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src))).toEqual([]);
  }
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-house',house);await settleAnimations(page);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);expect(writes).toEqual([]);
 });
}
