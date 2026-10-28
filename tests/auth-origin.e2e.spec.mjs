import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture} from './helpers.mjs';
import {settleAnimations} from './browser-helpers.mjs';

test('endereço temporário orienta antes da senha e preserva o convite no link principal',async({page})=>{
 const f=await fixture(),preview=f.config.origin;try{
  f.config.origin=preview.replace('127.0.0.1','localhost');
  const posts=[];page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
  await page.goto(preview+'/entrar');await expect(page.getByRole('link',{name:'Continuar no endereço principal',exact:true})).toHaveAttribute('href',f.config.origin+'/entrar');await expect(page.locator('input[type=password]')).toHaveCount(0);
  const invitation='c'.repeat(64);await page.goto(preview+'/ativar#convite='+invitation);const link=page.getByRole('link',{name:'Continuar no endereço principal',exact:true});await expect(link).toHaveAttribute('href',f.config.origin+'/ativar#convite='+invitation);await expect(page.locator('input')).toHaveCount(0);expect(posts).toEqual([]);
  await page.setViewportSize({width:390,height:844});await settleAnimations(page);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await link.click();await expect(page.getByLabel('Crie uma senha',{exact:true})).toBeVisible();expect(new URL(page.url()).hash).toBe('#convite='+invitation);expect(posts).toEqual([]);
  await page.route('**/api/auth/context',route=>route.abort());await page.goto(preview+'/ativar#convite='+invitation);await expect(page.getByRole('button',{name:'Tentar novamente',exact:true})).toBeVisible();expect(new URL(page.url()).hash).toBe('#convite='+invitation);await expect(page.locator('input[type=password]')).toHaveCount(0);expect(posts).toEqual([]);
 }finally{await f.close();}
});

test('falha HTTP identifica indisponibilidade e repetir recupera o formulário sem perder o convite',async({page})=>{
 const f=await fixture();try{
  let unavailable=true;await page.route('**/api/auth/context',route=>unavailable?route.fulfill({status:503,contentType:'text/html',body:'Service unavailable'}):route.continue());const invitation='b'.repeat(64);await page.goto(f.config.origin+'/ativar#convite='+invitation);await expect(page.getByRole('status').filter({hasText:'HTTP 503'})).toBeVisible();await expect(page.locator('input[type=password]')).toHaveCount(0);unavailable=false;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await expect(page.getByLabel('Crie uma senha',{exact:true})).toBeVisible();expect(new URL(page.url()).hash).toBe('#convite='+invitation);
 }finally{await f.close();}
});
