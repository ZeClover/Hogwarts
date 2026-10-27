import {dismissIncidentalDiscoveries} from './browser-helpers.mjs';
import {openDisclosure} from './browser-helpers.mjs';
import {openPolicy} from './browser-helpers.mjs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { fixture } from './helpers.mjs';
let f;
const base='/portal/mestre/oficinas';
test.beforeAll(async()=>{f=await fixture();await mkdir('docs/screenshots/f2-0a',{recursive:true});});
test.afterAll(async()=>{await f?.close();});
async function login(page,email){await dismissIncidentalDiscoveries(page);
  await page.goto(f.config.origin+'/entrar');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(f.password);
  await page.getByRole('button',{name:'Entrar nos arquivos'}).click();await expect(page.locator('.top')).toBeVisible();
}
async function checks(page){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
}
async function save(page){await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await expect(page.locator('#toast')).toContainText('Rascunho salvo.');}
async function publish(page){await page.getByRole('button',{name:'Revisar publicação',exact:true}).click();await page.getByRole('button',{name:'Confirmar publicação',exact:true}).click();await expect(page.locator('#toast')).toContainText('Ação registrada.');}

test('Oficina Geral cria mídia, recorta, confere prévia e publica só para o personagem escolhido',async({page,browser})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
  await login(page,'master@test.invalid');await page.getByRole('link',{name:'Oficina Geral',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Oficina Geral do Mestre',exact:true})).toBeVisible();await checks(page);
  await page.screenshot({path:'docs/screenshots/f2-0a/oficina-desktop.png',fullPage:true});
  await page.locator('.office-area>summary').filter({hasText:/^Sistema$/}).click();await page.getByRole('link',{name:'Biblioteca de Mídia Imagens, capas e apresentações'}).click();
  await expect(page.getByText('Sua biblioteca ainda não tem imagens neste filtro.')).toBeVisible();
  await page.getByRole('button',{name:'Nova imagem',exact:true}).click();await page.getByRole('button',{name:'Usar criação avançada',exact:true}).click();
  await page.getByLabel('Nome',{exact:true}).fill('ARTE COMPARTILHADA DE TESTE');
  await page.getByLabel('Descrição visível',{exact:true}).fill('Descrição pública escrita pelo Mestre.');
  await page.getByLabel('Ou selecionar uma imagem aprovada',{exact:true}).selectOption('loja_dedosdemel.webp');
  await page.getByLabel('Texto alternativo',{exact:true}).fill('Imagem de ambiente da Dedosdemel');
  await openDisclosure(page,'Corte, apresentação e notas');
  const crop=page.getByRole('button',{name:'Ajustar recorte: setas movem, Shift e setas redimensionam',exact:true});await crop.focus();for(let i=0;i<20;i++)await page.keyboard.press('Shift+ArrowLeft');await expect(page.locator('[name=cropWidth]')).toHaveValue('80.0');
  await page.getByLabel('Notas privadas do Mestre',{exact:true}).fill('SEGREDO NÃO ENVIAR <img src=x onerror=alert(1)>');
  await openPolicy(page);await page.locator('[name="characters"][value="atlas"]').check();
  await page.getByRole('button',{name:'Criar rascunho',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Editar imagem',exact:true})).toBeVisible();
  const path=new URL(page.url()).pathname;
  await expect(page.getByText('Esta arte de ambientação já é pública na ambientação do portal. Restringir este registro não torna o arquivo original secreto.')).toBeVisible();
  await page.getByLabel('Personagem da prévia',{exact:true}).selectOption('eiris');
  await page.getByRole('button',{name:'Conferir acesso e aparência',exact:true}).click();
  await expect(page.locator('#workshop-preview-result')).toContainText('Esta revisão não está disponível');
  await page.getByLabel('Personagem da prévia',{exact:true}).selectOption('atlas');
  await page.getByRole('button',{name:'Conferir acesso e aparência',exact:true}).click();
  await expect(page.locator('#workshop-preview-result')).toContainText('ARTE COMPARTILHADA DE TESTE');
  await expect(page.locator('#workshop-preview-result')).not.toContainText('SEGREDO');
  await checks(page);await page.screenshot({path:'docs/screenshots/f2-0a/editor-desktop.png',fullPage:true});
  const player=await browser.newContext({viewport:{width:390,height:844}}),atlas=await player.newPage();await login(atlas,'atlas@test.invalid');
  await atlas.goto(f.config.origin+'/portal/midias');await expect(atlas.getByText('Nenhuma imagem liberada por enquanto.')).toBeVisible();
  await publish(page);
  // The open gallery updates from the server without exposing draft/private fields.
  await expect(atlas.getByRole('heading',{name:'ARTE COMPARTILHADA DE TESTE',exact:true})).toBeVisible({timeout:12_000});
  await expect(atlas.locator('body')).not.toContainText('SEGREDO');await checks(atlas);
  await atlas.screenshot({path:'docs/screenshots/f2-0a/galeria-mobile.png',fullPage:true});
  await page.getByLabel('Nome',{exact:true}).fill('RASCUNHO NOVO AINDA PRIVADO');await save(page);
  await atlas.reload();await expect(atlas.getByRole('heading',{name:'ARTE COMPARTILHADA DE TESTE',exact:true})).toBeVisible();
  await expect(atlas.getByRole('heading',{name:'RASCUNHO NOVO AINDA PRIVADO',exact:true})).toHaveCount(0);
  await publish(page);await atlas.reload();await expect(atlas.getByRole('heading',{name:'RASCUNHO NOVO AINDA PRIVADO',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});await checks(page);
  await page.screenshot({path:'docs/screenshots/f2-0a/editor-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Arquivar',exact:true}).click();await page.getByRole('button',{name:'Confirmar arquivamento',exact:true}).click();
  await expect(page.getByRole('button',{name:'Restaurar sem publicar',exact:true})).toBeVisible();
  await atlas.reload();await expect(atlas.getByText('Nenhuma imagem liberada por enquanto.')).toBeVisible();
  await page.getByRole('button',{name:'Restaurar sem publicar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Revisar publicação',exact:true})).toBeVisible();
  await atlas.reload();await expect(atlas.getByText('Nenhuma imagem liberada por enquanto.')).toBeVisible();
  const other=await browser.newContext(),eiris=await other.newPage();await login(eiris,'eiris@test.invalid');await eiris.goto(f.config.origin+'/portal/midias');await expect(eiris.getByText('Nenhuma imagem liberada por enquanto.')).toBeVisible();
  await page.goto(f.config.origin+path);await expect(page.locator('.editor-history')).toContainText('Arquivado');await expect(page.locator('.editor-history')).toContainText('Restaurado');
  await player.close();await other.close();expect(errors).toEqual([]);
});

test('upload em celular, turma, exclusões, duplicação e conflito entre editores são operáveis por interface',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await login(page,'master@test.invalid');
  await page.goto(f.config.origin+base);
  await page.locator('.office-cohorts>summary').click();await page.getByLabel('Nova turma',{exact:true}).fill('Turma criada no navegador');
  const cohortForm=page.locator('[data-workshop-form="cohort"]').last();await cohortForm.getByRole('checkbox',{name:'Atlas Black',exact:true}).check();
  await cohortForm.getByRole('button',{name:'Criar turma',exact:true}).click();await expect(page.locator('#toast')).toContainText('Turma salva.');
  await page.goto(f.config.origin+base+'/midias/nova');await page.getByRole('button',{name:'Usar criação avançada',exact:true}).click();
  await page.getByLabel('Nome',{exact:true}).fill('UPLOAD REAL');await page.getByLabel('Texto alternativo',{exact:true}).fill('Brasão de Hogwarts enviado');
  await page.getByLabel('Enviar uma imagem',{exact:true}).setInputFiles('public/assets/hogwarts.webp');
  await openPolicy(page);await page.getByLabel('Público',{exact:true}).selectOption('ALL');await openDisclosure(page,'Restrições e exceções');
  await page.getByRole('checkbox',{name:'Turma criada no navegador',exact:true}).check();
  await page.locator('[name="excludedCharacters"][value="eiris"]').check();
  await page.getByRole('button',{name:'Criar rascunho',exact:true}).click();await expect(page.getByRole('heading',{name:'Editar imagem',exact:true})).toBeVisible();
  await checks(page);await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.media-editor-form').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  const other=await context.newPage();await other.goto(page.url());await expect(other.getByRole('heading',{name:'Editar imagem',exact:true})).toBeVisible();
  await page.getByLabel('Descrição visível',{exact:true}).fill('Mudança vencedora');await save(page);
  await other.getByLabel('Descrição visível',{exact:true}).fill('Não sobrescrever');await other.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await expect(other.locator('.media-editor-form .form-error')).toContainText('outra sessão');await other.close();
  await page.getByRole('button',{name:'Duplicar como rascunho',exact:true}).click();await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('UPLOAD REAL — cópia');
  await page.reload();await expect(page.getByLabel('Descrição visível',{exact:true})).toHaveValue('Mudança vencedora');await expect(page.locator('.editor-history')).toContainText('Cópia criada');
  await page.goto(f.config.origin+base+'/midias');await page.getByLabel('Buscar imagem',{exact:true}).fill('UPLOAD REAL');await page.getByRole('button',{name:'Buscar',exact:true}).click();await expect(page.locator('.media-record')).toHaveCount(2);
  await page.getByLabel('Estado',{exact:true}).selectOption('PUBLISHED');await page.getByRole('button',{name:'Buscar',exact:true}).click();await expect(page.getByText('Sua biblioteca ainda não tem imagens neste filtro.')).toBeVisible();
  await checks(page);
});
