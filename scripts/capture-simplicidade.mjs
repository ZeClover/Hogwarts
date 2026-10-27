import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {fixture} from '../tests/helpers.mjs';
import {settleAnimations} from '../tests/browser-helpers.mjs';
const phase=process.argv[2]||'before',dir='docs/screenshots/simplicidade/'+phase;await mkdir(dir,{recursive:true});
const f=await fixture(),b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{const p=await b.newPage();await p.goto(f.config.origin+'/entrar');await p.getByLabel('E-mail',{exact:true}).fill('master@test.invalid');await p.getByLabel('Senha',{exact:true}).fill(f.password);await p.getByRole('button',{name:'Entrar nos arquivos'}).click();await p.locator('.top').waitFor();
const routes={inicio:'/portal/inicio?view_as=atlas',explorar:'/portal/explorar?view_as=atlas',diario:'/portal/diario?view_as=atlas',biblioteca:'/portal/conteudos/books?view_as=atlas',npc:'/portal/mestre/oficinas/npcs/novo',missao:'/portal/mestre/oficinas/missoes/novo',profeta:'/portal/mestre/oficinas/conteudos/newspapers/novo',central:'/portal/mestre'};
for(const [device,size] of Object.entries({desktop:{width:1440,height:1000},mobile:{width:390,height:844}})){await p.setViewportSize(size);for(const [name,path] of Object.entries(routes)){await p.goto(f.config.origin+path);await p.locator('.top').waitFor();await settleAnimations(p);await p.screenshot({path:`${dir}/${name}-${device}.png`,fullPage:true});console.log(phase,device,name,await p.locator('h1').allTextContents());}}
}finally{await b.close();await f.close();}
