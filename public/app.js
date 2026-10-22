import { createWorkshop } from '/workshop.js';
import { createNPCOffice } from '/npcs.js';
import { createItemOffice } from '/items.js';
import { createCampaignOffice } from '/campaign.js';
import { createDelivery } from '/delivery.js';
import { createDocumentOffice } from '/documents.js';
import { createContentOffice } from '/content.js';
import '/library.js';
import {createMailOffice} from '/mail.js';
import {createChocolateOffice} from '/chocolate.js';
import {createCollectionOffice} from '/collections.js';
import {createCupOffice} from '/cup.js';
import {createBoardOffice} from '/boards.js';
import {createCalendarOffice} from '/calendar.js';
import {createCommerceOffice} from '/commerce.js';
const root = document.querySelector('#root');
const state = { session: null, portal: null, admin: null, view: new URLSearchParams(location.search).get('view_as'), page: location.pathname, detail: null, dirty: false, busy: false };
let toastTimer;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconPaths = {
 castle:'M3 21h18M5 21V7l3 2V4l4-2 4 2v5l3-2v14M9 21v-6h6v6M11 8h2M11 11h2',
 map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
 book:'M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15',
 mail:'M3 5h18v14H3V5Zm0 1 9 7 9-7',
 quill:'m4 20 5-2 11-12-3-3L5 14l-1 6Zm2-6 4 4M4 20l-2 2',
 shield:'m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5l8-3Zm-4 9 3 3 5-6',
 arrow:'M4 12h16m-6-6 6 6-6 6',
 lock:'M5 10h14v11H5V10Zm3 0V7a4 4 0 0 1 8 0v3m-4 4v3',
 star:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
 user:'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM3 22v-3a9 9 0 0 1 18 0v3',
 clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2',
 scroll:'M6 3h12v15a3 3 0 0 0 3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 0-3-3h4Zm12 15h5v1a2 2 0 0 1-2 2M9 8h6m-6 4h6',
 eye:'M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12Zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
 exit:'M10 3H3v18h7m5-16 7 7-7 7m-8-7h15',
};
const ico = (name, size=20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name] ?? iconPaths.star}"/></svg>`;
const label = (left, right=state.portal?.calendar?.academicYearLabel??'1890–1891') => `<div class="subtop"><span class="eyebrow">${esc(left)}</span><span class="breadcrumbs">${esc(right)}</span></div>`;
const empty = message => `<div class="vacant slim">${ico('star',30)}<span>${esc(message)}</span></div>`;
const button = (title, page, icon='arrow', extra='') => `<button class="btn ghost ${extra}" data-go="${page}">${ico(icon,16)} ${esc(title)}</button>`;
const workshop=createWorkshop({api,esc,ico,label,empty,button,state,render,navigate,toast});
workshop.attach(root);
const npcOffice=createNPCOffice({api,esc,ico,label,empty,button,state,render,navigate,toast});
npcOffice.attach(root);
const itemOffice=createItemOffice({api,esc,ico,label,empty,button,state,render,navigate,toast});
itemOffice.attach(root);
const campaignOffice=createCampaignOffice({api,esc,ico,label,empty,button,state,render,navigate,toast});
campaignOffice.attach(root);
const documentOffice=createDocumentOffice({api,esc,label,empty,button,state,render,navigate,toast});
documentOffice.attach(root);
const contentOffice=createContentOffice({api,esc,ico,label,empty,button,state,render,navigate,toast});
contentOffice.attach(root);
const commerceOffice=createCommerceOffice({api,esc,label,empty,button,state,render,navigate,toast});
commerceOffice.attach(root);
const calendarOffice=createCalendarOffice({api,esc,label,empty,button,state,render,navigate,toast});
calendarOffice.attach(root);
const boardOffice=createBoardOffice({api,esc,label,empty,button,state,render,navigate,toast});
boardOffice.attach(root);
const cupOffice=createCupOffice({api,esc,label,empty,button,state,render,toast});
cupOffice.attach(root);
const collectionOffice=createCollectionOffice({api,esc,label,empty,button,state,render,toast});
collectionOffice.attach(root);
const chocolateOffice=createChocolateOffice({api,esc,label,empty,button,state,render,toast});
chocolateOffice.attach(root);
const mailOffice=createMailOffice({api,esc,label,empty,button,state,render,navigate,toast});
mailOffice.attach(root);
const delivery=createDelivery({api,state,refresh,navigate,esc});
function toast(message, error=false) {
  clearTimeout(toastTimer);
  const el=document.querySelector('#toast');el.textContent=message;el.className=error?'visible error':'visible';
  toastTimer=setTimeout(()=>{el.className='';},6000);
}
async function api(path, {method='GET', body, preview=true, raw=false}={}) {
  const url=new URL(path,location.origin);
  if(state.view && preview) url.searchParams.set('view_as',state.view);
  const headers={};
  if(method!=='GET' && state.session) headers['X-CSRF-Token']=state.session.csrf;
  if(body!==undefined) headers['Content-Type']=raw?body.type:'application/json';
  const response=await fetch(url,{method,headers,credentials:'same-origin',body:body===undefined?undefined:raw?body:JSON.stringify(body)});
  const value=await response.json();
  if(!response.ok){
    if(response.status===401 && state.session){state.session=null;state.portal=null;render();}
    throw new Error(value.error ?? 'Não foi possível concluir.');
  }
  return value;
}
function pathWithView(path) { return `${path}${state.view?`?view_as=${encodeURIComponent(state.view)}`:''}`; }
async function navigate(path, replace=false) {
  state.page=path;state.detail=null;state.dirty=false;
  history[replace?'replaceState':'pushState']({},'',pathWithView(path));
  await loadPage();render();
  document.querySelector('#main')?.focus();window.scrollTo({top:0,behavior:'instant'});
}
async function loadPage() {
  if(mailOffice.handles(state.page)){await mailOffice.load();return;}
  if(chocolateOffice.handles(state.page)){await chocolateOffice.load();return;}
  if(collectionOffice.handles(state.page)){await collectionOffice.load();return;}
  if(cupOffice.handles(state.page)){await cupOffice.load();return;}
  if(boardOffice.handles(state.page)){await boardOffice.load();return;}
  if(calendarOffice.handles(state.page)){await calendarOffice.load();return;}
  if(commerceOffice.handles(state.page)){await commerceOffice.load();return;}
  if(contentOffice.handles(state.page)){await contentOffice.load();return;}
  if(documentOffice.handles(state.page)){await documentOffice.load();return;}
  if(campaignOffice.handles(state.page)){await campaignOffice.load();return;}
  if(itemOffice.handles(state.page)){await itemOffice.load();return;}
  if(npcOffice.handles(state.page)){await npcOffice.load();return;}
  if(workshop.handles(state.page)){await workshop.load();return;}
  if(state.page==='/portal/mestre' && state.session?.role==='MASTER' && !state.view) state.admin=await api('/api/master/state',{preview:false});
  if(state.page.startsWith('/portal/local/')) state.detail=await api(`/api/locations/${state.page.split('/').pop()}`);
  if(state.page.startsWith('/portal/publicacao/')) state.detail=await api(`/api/publications/${state.page.split('/').pop()}`);
}
async function refresh(force=false) {
  const next=await api('/api/state');
  const changed=JSON.stringify(next)!==JSON.stringify(state.portal);
  state.portal=next;
  if(!force&&!changed&&!state.dirty&&mailOffice.handles(state.page)){await mailOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&chocolateOffice.handles(state.page)){await chocolateOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&collectionOffice.handles(state.page)){await collectionOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&cupOffice.handles(state.page)){await cupOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&boardOffice.handles(state.page)){await boardOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&calendarOffice.handles(state.page)){await calendarOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&commerceOffice.handles(state.page)){await commerceOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&contentOffice.handles(state.page)){await contentOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&documentOffice.handles(state.page)){await documentOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&campaignOffice.handles(state.page)){await campaignOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&itemOffice.handles(state.page)){await itemOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&npcOffice.handles(state.page)){await npcOffice.poll();return;}
  if(!force&&!changed&&!state.dirty&&workshop.handles(state.page)){await workshop.poll();return;}
  if(!force&&!changed&&!state.dirty&&state.page.startsWith('/portal/local/')){const detail=await api('/api/locations/'+state.page.split('/').pop());if(JSON.stringify(detail)!==JSON.stringify(state.detail)){state.detail=detail;render();}return;}
  if(state.session?.role==='MASTER' && !state.view && (force||!state.admin)) state.admin=await api('/api/master/state',{preview:false});
  if(force||changed&&!state.dirty){
    try {await loadPage();} catch {state.detail=null;}
    render();
  }
}
function authPage() {
  const activate=location.pathname==='/ativar';
  return `<main id="main" class="auth-shell" tabindex="-1"><section class="auth-art" aria-label="Castelo de Hogwarts à noite"><div class="auth-wordmark"><img src="/assets/hogwarts.webp" alt="Brasão de Hogwarts"><span>Hogwarts <small>ARQUIVOS MÁGICOS</small></span></div><div class="auth-story"><span class="eyebrow">ESCOLA DE MAGIA E BRUXARIA</span><h1>Há histórias que<br>pertencem a poucos.</h1><div class="gold-rule"></div><p>As suas esperam por você.</p><span class="auth-year">ANO LETIVO 1890–1891</span></div></section><section class="auth-form-panel"><div class="auth-form-inner"><span class="eyebrow">${activate?'UMA NOVA HISTÓRIA':'BEM-VINDO DE VOLTA'}</span><h2>${activate?'Seu lugar em Hogwarts':'Os arquivos aguardam'}</h2><p class="muted">${activate?'Use o e-mail do seu convite para criar sua conta.':'Entre para continuar a sua história.'}</p><form data-form="${activate?'activate':'login'}"><label class="field">E-mail<input type="email" name="email" autocomplete="username" required maxlength="254" placeholder="Seu e-mail"></label><label class="field">${activate?'Crie uma senha':'Senha'}<input type="password" name="password" autocomplete="${activate?'new-password':'current-password'}" minlength="12" maxlength="128" required placeholder="${activate?'Pelo menos 12 caracteres':'Sua senha'}"></label>${activate?'<p class="subtle">Seu convite é pessoal e pode ser utilizado uma única vez.</p>':''}<p class="form-error" role="alert"></p><button class="btn auth-submit" type="submit">${activate?'Aceitar convite':'Entrar nos arquivos'} ${ico('arrow',18)}</button></form><div class="auth-note">${ico('lock',16)} Acesso privado por convite do Mestre.</div>${activate?'<a class="auth-link" href="/entrar">Já tem uma conta? Entrar</a>':''}<p class="auth-help">${activate?'O convite expirou? Peça um novo ao Mestre.':'Para acessar pela primeira vez ou recuperar seu acesso, fale com o Mestre.'}</p></div><span class="auth-bottom">HOGWARTS · 1890</span></section></main>`;
}
function header() {
  const p=state.portal.character, isMaster=state.session.role==='MASTER'&&!state.view;
  const links=[['Início','inicio'],['Hogwarts','hogwarts'],['Hogsmeade','hogsmeade'],['Acervos','acervos'],['Correio','correio']];
  return `<header class="top"><a class="brand" href="${pathWithView('/portal/inicio')}" data-go="/portal/inicio"><img src="/assets/hogwarts.webp" alt=""><div class="brand-title">Hogwarts <small>1890 · Arquivos Mágicos</small></div></a><nav class="navigation" aria-label="Principal">${links.map(([name,page])=>`<a href="${pathWithView('/portal/'+page)}" data-go="/portal/${page}" ${state.page==='/portal/'+page?'aria-current="page"':''}>${name}</a>`).join('')}</nav><div class="persona">${p?`<a class="persona-link" href="${pathWithView('/portal/perfil')}" data-go="/portal/perfil"><img src="${esc(p.crest)}" alt=""><span>${esc(p.name)}<small>${esc(p.houseName)}</small></span></a>`:`<a class="persona-link" href="/portal/mestre" data-go="/portal/mestre">${ico('shield',27)}<span>Mestre<small>Arquivos Mágicos</small></span></a>`}<button class="icon-button" data-action="logout" aria-label="Sair da conta" title="Sair">${ico('exit',19)}</button></div></header>${state.view?`<aside class="preview-bar"><span>${ico('eye',18)} Visualizando ${esc(p?.name)} · somente leitura</span><button class="btn ghost small" data-action="end-preview">Voltar ao Mestre</button></aside>`:isMaster?`<div class="master-bar"><div class="admin-bar-links"><a href="/portal/mestre" data-go="/portal/mestre">${ico('shield',15)} Central da Sessão</a><a href="/portal/mestre/oficinas" data-go="/portal/mestre/oficinas">${ico('book',15)} Oficina Geral</a></div><label>Visualizar como <select id="preview-select" aria-label="Visualizar como personagem"><option value="">Escolher personagem</option>${(state.admin?.characters??[]).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label></div>`:''}`;
}
function imgcard(title, caption, photo, target, icon='star', locked=false) {
  return `<a class="entry${locked?' locked':''}" href="${pathWithView(target)}" data-go="${target}" style="background-image:linear-gradient(0deg,#1010140f,#10101408),url('${photo}')"><span class="entry-symbol">${ico(icon,22)}</span>${locked?`<span class="card-lock">${ico('lock',13)} Fechada</span>`:''}<strong>${esc(title)}</strong><span>${esc(caption)}</span></a>`;
}
function home() {
  const p=state.portal.character, open=state.portal.regions.find(r=>r.id==='hogsmeade')?.accessible;
  return `${label('SEUS ARQUIVOS MÁGICOS','Hogwarts · 1890')}<section class="hero" aria-label="Bem-vindo a Hogwarts"><div class="hero-content"><div class="eyebrow">ESCOLA DE MAGIA E BRUXARIA · 1890</div><h1>Hogwarts</h1><p class="hero-name">${esc(p?.name ?? 'Arquivos Mágicos')}</p><div class="hero-sub">${esc(p?`${p.houseName}${p.year?' · '+p.year+'º ano':''}`:'As histórias do seu mundo bruxo')}</div></div><img class="hero-crest" src="${esc(p?.crest ?? '/assets/hogwarts.webp')}" alt="${esc(p?'Brasão de '+p.houseName:'Brasão de Hogwarts')}"></section><div class="home-entry">${imgcard('Hogwarts','Vida escolar','/assets/hogwarts_saguão.webp','/portal/hogwarts','castle')}${imgcard('Hogsmeade',open?'Explorar a vila':'A vila está inacessível','/assets/hogsmeade_rua.webp','/portal/hogsmeade','map',!open)}${imgcard('Acervos','Coleções e registros','/assets/biblioteca_hogwarts.webp','/portal/acervos','book')}</div><div class="afterhome"><section class="card note-panel"><header><h2 class="head3">Novidades</h2><span class="kicker">${esc(state.portal.calendar.academicYearLabel)}</span></header>${state.portal.news.length?state.portal.news.map(n=>`<a class="news-row" href="${pathWithView('/portal/publicacao/'+n.id)}" data-go="/portal/publicacao/${esc(n.id)}"><span>${ico('mail',19)} ${esc(n.title)}</span>${ico('arrow',16)}</a>`).join(''):'<div class="no-news"><span class="news-mark">✧</span><p>Nenhuma novidade por enquanto.</p></div>'}</section><section class="card note-panel"><header><h2 class="head3">Acesso rápido</h2></header><div class="quick">${[['Meu perfil','perfil','user'],['Missões','missoes','scroll'],['Correio','correio','mail'],['Calendário','calendario','clock']].map(([title,page,icon])=>`<button data-go="/portal/${page}">${ico(icon,18)} ${title}<small>›</small></button>`).join('')}</div></section></div>`;
}
function school() {
  const library=state.portal.locations.find(l=>l.id==='biblioteca');
  return `${label('VIDA ESCOLAR')}<h1 class="display">O Castelo de Hogwarts</h1><div class="tiles">${library?imgcard('Biblioteca','Acervo da escola',library.image,'/portal/local/'+library.id,'book'):''}${imgcard('Calendário','Aulas e eventos','/assets/hogwarts_saguão.webp','/portal/calendario','clock')}${imgcard('Taça das Casas','Pontos e resultados','/assets/hogwarts_claustro.webp','/portal/taca','shield')}${imgcard('As Quatro Casas','Tradição e pertencimento','/assets/hogwarts_claustro.webp','/portal/casas','shield')}${imgcard('Quadros de Avisos','Comunicados','/assets/hogwarts_corredor_velas.webp','/portal/avisos','scroll')}</div>`;
}
function archives() {
  return `${label('ARQUIVOS PESSOAIS')}<h1 class="display">Meus Acervos</h1><div class="group">${button('Taça das Casas','/portal/taca','shield')}${button('Biblioteca','/portal/conteudos/books','book')}${button('Aulas','/portal/conteudos/lessons','book')}${button('Minha carteira','/portal/carteira','star')}${button('Explorar regiões','/portal/conteudos/regions','map')}${button('Documentos e recompensas','/portal/documentos','scroll')}${button('Galeria de Imagens','/portal/midias','book')}${button('Pessoas conhecidas','/portal/personagens','user')}${button('Artigos revelados','/portal/artigos','book')}</div><div class="tiles">${imgcard('Coleções','Descobertas e registros','/assets/biblioteca_hogwarts.webp','/portal/colecoes','star')}${imgcard('Diário de Missões','Histórias em andamento','/assets/hogwarts_escadarias.webp','/portal/missoes','scroll')}${imgcard('Investigações','Caderno coletivo','/assets/hogwarts_saguão.webp','/portal/investigacoes','book')}${imgcard('Recordações','Memórias e momentos','/assets/correio_pergaminhos.webp','/portal/recordacoes','quill')}</div>`;
}
function mast(image, kicker, title) {
  return `<section class="media-mast" style="--media:url('${image}')"><div><span class="eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1></div></section>`;
}
function hogsmeade() {
  const accessible=state.portal.regions.find(r=>r.id==='hogsmeade')?.accessible;
  if(!accessible) return `${label('EXPLORAÇÃO')}<h1 class="display">Hogsmeade</h1><section class="closed-region"><img src="/assets/hogsmeade_rua.webp" alt="Ruas de Hogsmeade"><div>${ico('lock',32)}<h2>A vila está inacessível.</h2><p>Seu próximo passeio ainda aguarda.</p></div></section>`;
  const places=state.portal.locations.filter(l=>l.regionId==='hogsmeade');
  return `${label('A VILA BRUXA')}<h1 class="display">Hogsmeade</h1><section class="location-banner"><div><span class="eyebrow">EXPLORAÇÃO</span><h2 class="head2">Ruas de Hogsmeade</h2></div></section><div class="map-layout"><div class="map-frame"><img class="map-image" src="/assets/hogsmeade_mapa_limpo.webp" alt="Mapa ilustrado de Hogsmeade">${places.filter(l=>l.x!==null&&l.y!==null).map(l=>`<a class="location-dot" style="left:${Number(l.x)}%;top:${Number(l.y)}%" href="${pathWithView('/portal/local/'+l.id)}" data-go="/portal/local/${esc(l.id)}" aria-label="${esc(l.title)}" title="${esc(l.title)}">${ico(l.kind==='LIBRARY'?'book':'star',18)}</a>`).join('')}</div><section class="card map-directory"><span class="eyebrow">LOCAIS</span><h2 class="head3">Estabelecimentos</h2>${places.length?places.map(l=>`<a class="dirbtn" href="${pathWithView('/portal/local/'+l.id)}" data-go="/portal/local/${esc(l.id)}">${esc(l.title)} <span>›</span></a>`).join(''):empty('Nenhum local disponível.')}</section></div>`;
}
function placePage() {
  const p=state.detail;
  if(!p) return `${label('EXPLORAÇÃO')}<h1 class="display">Local indisponível</h1>${empty('Este local não está disponível para você.')}`;
  const library=p.kind==='LIBRARY';
  return `${label(library?'VIDA ESCOLAR':'HOGSMEADE')}${mast(p.image,library?'BIBLIOTECA':'ESTABELECIMENTO',p.title)}<h2 class="head2 section-title">${library?'Acervo da Escola':'Catálogo'}</h2>${(p.boards??[]).map(b=>button(b.title,'/portal/conteudos/boards/'+b.id,'scroll')).join('')}${library?button('Abrir Biblioteca','/portal/conteudos/books','book'):''}${p.shops?.length?`<div class="group">${p.shops.map(s=>button(s.title,'/portal/catalogo/'+s.id,'book')).join('')}</div>`:empty(library?'Ainda não há livros liberados neste acervo.':'Nenhum artigo exposto no momento.')}${p.contacts?.length?`<section class="card known-contacts"><h2 class="head3">Pessoas conhecidas neste local</h2><div class="group">${p.contacts.map(n=>button(n.name,'/portal/personagens/'+n.id,'user')).join('')}</div></section>`:''}`;
}
const futurePages={
 correio:['/assets/correio_carta_hogwarts.webp','CORREIO BRUXO','Correspondências','Nenhuma carta recebida.'],
 calendario:['/assets/hogwarts_saguão.webp','VIDA ESCOLAR','Calendário Escolar','Nenhum evento publicado.'],
 avisos:['/assets/hogwarts_corredor_velas.webp','HOGWARTS','Quadros de Avisos','Nenhum comunicado publicado.'],
 colecoes:['/assets/biblioteca_hogwarts.webp','MEUS ACERVOS','Coleções','Nenhuma coleção revelada.'],
 investigacoes:['/assets/hogwarts_saguão.webp','MEUS REGISTROS','Investigações','Nenhuma investigação revelada.'],
 recordacoes:['/assets/correio_pergaminhos.webp','MEUS ACERVOS','Recordações','Ainda não há recordações registradas.'],
 profeta:['/assets/correio_pergaminhos.webp','MUNDO BRUXO','O Profeta Diário','Nenhuma edição publicada.']
};
function future(page) {
  const [image,kicker,title,message]=futurePages[page];
  return `${label(kicker)}${mast(image,kicker,title)}${empty(message)}${page==='correio'?button('O Profeta Diário','/portal/profeta','book'):''}`;
}
function houses() {
  return `${label('VIDA ESCOLAR')}<h1 class="display">As Quatro Casas</h1><div class="crests-row">${[['gryffindor','Grifinória'],['hufflepuff','Lufa-Lufa'],['ravenclaw','Corvinal'],['slytherin','Sonserina']].map(([id,name])=>`<section class="house-card"><img src="/assets/${id}.webp" alt="Brasão de ${name}"><h2>${name}</h2></section>`).join('')}</div>`;
}
function profile(character=state.portal.character, master=false) {
  if(!character) return `${label('PERFIL')}<h1 class="display">Perfis dos personagens</h1>${empty('Escolha um personagem na Central do Mestre.')}${button('Central do Mestre','/portal/mestre','shield')}`;
  const readonly=!!state.view, c=character;
  const portrait=c.photo?pathWithView(c.photo):c.crest;
  return `${master?'':label('ARQUIVOS PESSOAIS')}<section class="card profile-card"><div class="profile-heading"><img class="portrait" src="${esc(portrait)}" alt="Retrato de ${esc(c.name)}"><div><span class="eyebrow">${esc(c.houseName)}${c.year?' · '+c.year+'º ano':''}</span><h1 class="head2">${esc(c.name)}</h1></div></div>${readonly?`<h2 class="head3">Biografia</h2><p class="biography">${esc(c.biography||'Nenhuma biografia registrada.')}</p>`:`<form data-form="bio" data-character="${esc(c.id)}"><div class="field"><label for="bio-${esc(c.id)}">Biografia</label><textarea id="bio-${esc(c.id)}" name="biography" rows="5" maxlength="3000" placeholder="Uma página da sua história…">${esc(c.biography)}</textarea></div><p class="form-error" role="alert"></p><button class="btn" type="submit">Salvar biografia</button></form><form class="photo-form" data-form="photo" data-character="${esc(c.id)}"><label class="field">Foto do personagem<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></label><p class="subtle">JPG, PNG ou WebP · até 2 MB.</p><p class="form-error" role="alert"></p><div class="group"><button class="btn ghost" type="submit">Atualizar foto</button>${c.photo?`<button class="btn ghost" data-action="remove-photo" data-id="${esc(c.id)}" type="button">Remover foto</button>`:''}</div></form>`}</section>`;
}
function recipients(resource) {
  return `<fieldset class="recipient-field"><legend>Personagens autorizados</legend><div class="checks">${state.admin.characters.map(c=>`<label><input type="checkbox" name="characters" value="${esc(c.id)}" ${resource.characters?.includes(c.id)?'checked':''}>${esc(c.name)}</label>`).join('')}</div></fieldset>${state.admin.groups.length?`<fieldset class="recipient-field"><legend>Grupos autorizados</legend><div class="checks">${state.admin.groups.map(g=>`<label><input type="checkbox" name="groups" value="${esc(g.id)}" ${resource.groups?.includes(g.id)?'checked':''}>${esc(g.name)}</label>`).join('')}</div></fieldset>`:''}`;
}
function audienceField(resource) {return `<label class="field">Destinatários<select name="audience" aria-label="Destinatários"><option value="SELECTED" ${resource.audience==='SELECTED'?'selected':''}>Personagens e grupos selecionados</option><option value="ALL" ${resource.audience==='ALL'?'selected':''}>Todos os personagens</option></select></label>`;}
function masterPage() {
  if(state.session.role!=='MASTER'||state.view) return `${label('ACESSO RESTRITO')}${empty('Acesso reservado ao Mestre.')}`;
  const a=state.admin;if(!a)return empty('Carregando a Central do Mestre…');
  const region=a.regions.find(r=>r.id==='hogsmeade');
  return `${label('ÁREA DO MESTRE')}<div class="gmheader"><div><h1 class="display">Central do Mestre</h1><p class="muted">Os caminhos se abrem pelas suas mãos.</p></div>${ico('shield',43)}</div><div class="gmstats"><div class="gmstat">${ico('map')}<span>Hogsmeade</span><strong>${region.is_open?'Aberta':'Fechada'}</strong></div><div class="gmstat">${ico('user')}<span>Personagens</span><strong>${a.characters.length.toString().padStart(2,'0')}</strong></div><div class="gmstat">${ico('shield')}<span>Grupos</span><strong>${a.groups.length.toString().padStart(2,'0')}</strong></div></div><div class="group">${button('Fila do Correio','/portal/mestre/correio','mail')}${button('Pacotes e trocas de Sapos','/portal/mestre/sapos','star')}${button('Propostas de curiosidades','/portal/mestre/curiosidades','star')}${button('Pontos das Casas','/portal/mestre/taca','shield')}${button('Propostas de avisos','/portal/mestre/murais','scroll')}${button('Data da campanha','/portal/mestre/calendario','clock')}${button('Carteiras e pedidos','/portal/mestre/comercio','star')}${button('Conduzir missões','/portal/mestre/sessao/missoes','scroll')}</div><nav class="admin-tabs" aria-label="Seções do Mestre"><a href="#regions">Regiões</a><a href="#locations">Locais</a><a href="#characters">Personagens</a><a href="#invites">Convites</a><a href="#groups">Grupos</a><a href="#audit">Auditoria</a></nav>
  <section id="regions"><div class="rtitle"><h2>Regiões e caminhos</h2></div><div class="dual">${a.regions.map(r=>`<form class="card gmblock" data-form="region" data-id="${esc(r.id)}"><div class="panel-heading"><h3>${esc(r.title)}</h3><span class="badge">${r.is_open?'Aberta':'Fechada'}</span></div><label class="toggle"><input type="checkbox" name="isOpen" ${r.is_open?'checked':''}> Região aberta</label>${audienceField(r)}${recipients(r)}<p class="form-error" role="alert"></p><button class="btn" type="submit">Salvar acesso</button><button class="btn ghost" type="button" data-action="toggle-region" data-id="${esc(r.id)}">${r.is_open?'Fechar região':'Abrir região'}</button></form>`).join('')}</div></section>
  <section id="locations"><div class="rtitle"><h2>Visibilidade dos locais</h2></div><div class="admin-notice">${ico('map',20)}<p>O mapa de Hogsmeade é provisório: a restauração tem retoques visíveis. Revise a imagem e as posições dos marcadores antes de aprovar sua versão final.</p></div><div class="dual">${a.locations.map(l=>`<details class="card location-control"><summary><span>${esc(l.title)}<small>${esc(a.regions.find(r=>r.id===l.region_id)?.title??'Região')}</small></span><span class="badge">${l.is_secret?'Secreto':l.enabled?'Público':'Oculto'}</span></summary><form data-form="location" data-id="${esc(l.id)}"><label class="toggle"><input type="checkbox" name="enabled" ${l.enabled?'checked':''}> Local disponível</label><label class="toggle"><input type="checkbox" name="isSecret" ${l.is_secret?'checked':''}> Local secreto · exige liberação específica</label>${audienceField(l)}${recipients(l)}<div class="coordinate-fields"><label class="field">Marcador X (%)<input type="number" name="x" min="0" max="100" step="0.1" value="${l.x===null?'':Number(l.x)}"></label><label class="field">Marcador Y (%)<input type="number" name="y" min="0" max="100" step="0.1" value="${l.y===null?'':Number(l.y)}"></label></div><p class="form-error" role="alert"></p><button class="btn small" type="submit">Salvar local</button></form></details>`).join('')}</div><details class="card location-control"><summary>Criar local secreto</summary><form data-form="new-location"><label class="field">Nome<input name="title" required maxlength="100"></label><label class="field">Região<select name="regionId" aria-label="Região">${a.regions.map(r=>`<option value="${esc(r.id)}">${esc(r.title)}</option>`).join('')}</select></label><label class="field">Imagem<select name="image" aria-label="Imagem">${a.images.map(i=>`<option value="${esc(i)}">${esc(i)}</option>`).join('')}</select></label><p class="form-error" role="alert"></p><button class="btn small" type="submit">Criar local reservado</button></form></details></section>
  <section id="characters"><div class="rtitle"><h2>Personagens</h2></div><div class="character-list">${a.characters.map(c=>`<details class="card character-control"><summary><img src="${esc(c.crest)}" alt=""><span>${esc(c.name)}<small>${esc(c.houseName)}</small></span></summary><div class="character-edit"><div class="character-preview"><button class="btn ghost small" data-preview="${esc(c.id)}" type="button">${ico('eye',15)} Visualizar como personagem</button></div><form data-form="character" data-id="${esc(c.id)}"><label class="field">Nome<input name="name" value="${esc(c.name)}" required maxlength="100"></label><div class="dual"><label class="field">Casa<select name="house" aria-label="Casa">${a.houses.map(h=>`<option value="${esc(h.id)}" ${h.id===c.house?'selected':''}>${esc(h.name)}</option>`).join('')}</select></label><label class="field">Ano escolar<select name="year" aria-label="Ano escolar"><option value="">Não definido</option>${[1,2,3,4,5,6,7].map(y=>`<option value="${y}" ${c.year===y?'selected':''}>${y}º ano</option>`).join('')}</select></label></div><p class="form-error" role="alert"></p><button class="btn" type="submit">Salvar personagem</button></form>${profile(c,true)}${c.account?`<div class="account-control"><span>${esc(c.account.email)} · ${c.account.disabled?'Conta suspensa':'Conta ativa'}</span><button class="btn ghost small" data-action="toggle-account" data-id="${esc(c.account.id)}" data-disabled="${c.account.disabled?'false':'true'}">${c.account.disabled?'Reativar acesso':'Suspender acesso'}</button></div>`:'<p class="subtle">Nenhuma conta vinculada. Envie um convite abaixo.</p>'}</div></details>`).join('')}</div></section>
  <section id="invites"><div class="rtitle"><h2>Convites pessoais</h2></div><div class="dual"><form class="card gmblock" data-form="invite"><h3>Novo convite</h3><label class="field">E-mail<input name="email" type="email" required maxlength="254"></label><label class="field">Papel<select name="role" aria-label="Papel"><option value="PLAYER">Jogador</option><option value="MASTER">Mestre</option></select></label><label class="field">Personagem<select name="characterId" aria-label="Personagem">${a.characters.filter(c=>!c.account).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><p class="subtle">Válido por 72 horas. Compartilhe o link apenas com o destinatário.</p><p class="form-error" role="alert"></p><button class="btn" type="submit">Gerar convite</button><div id="invite-result"></div></form><div class="card gmblock"><h3>Últimos convites</h3>${a.invites.length?a.invites.map(i=>{const active=!i.used_at&&!i.revoked_at&&i.expires_at>Date.now()/1000;return `<div class="invite-row"><div><strong>${esc(i.email)}</strong><small>${i.role==='MASTER'?'Mestre':esc(a.characters.find(c=>c.id===i.character_id)?.name)} · ${i.used_at?'Aceito':i.revoked_at?'Revogado':active?'Pendente':'Expirado'}</small></div>${active?`<button class="btn ghost small" data-action="revoke-invite" data-id="${esc(i.id)}">Revogar</button>`:''}</div>`;}).join(''):empty('Nenhum convite enviado.')}</div></div></section>
  <section id="groups"><div class="rtitle"><h2>Grupos de acesso</h2></div><div class="dual">${[...a.groups,{id:'',name:'',members:[]}].map(g=>`<form class="card gmblock" data-form="group" data-id="${esc(g.id)}"><h3>${g.id?'Editar grupo':'Novo grupo'}</h3><label class="field">Nome<input name="name" value="${esc(g.name)}" required maxlength="80"></label><fieldset class="recipient-field"><legend>Integrantes</legend><div class="checks">${a.characters.map(c=>`<label><input type="checkbox" name="members" value="${esc(c.id)}" ${g.members.includes(c.id)?'checked':''}>${esc(c.name)}</label>`).join('')}</div></fieldset><p class="form-error" role="alert"></p><button class="btn" type="submit">${g.id?'Salvar grupo':'Criar grupo'}</button></form>`).join('')}</div></section>
  <section id="audit"><div class="rtitle"><h2>Registro de auditoria</h2><span class="kicker">Últimas 100 ações</span></div><div class="card audit-list">${a.audit.map(log=>`<div class="audit-row"><div><strong>${esc(auditLabel(log.action))}</strong><small>${esc(log.target_type)} · ${esc(log.target_id)}</small></div><time datetime="${new Date(log.created_at*1000).toISOString()}">${new Date(log.created_at*1000).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})}</time></div>`).join('')||empty('Nenhuma ação registrada.')}</div></section>`;
}
function auditLabel(action) {
  return ({BOOTSTRAP_INVITE:'Convite inicial criado',INVITE_ACCEPTED:'Convite aceito',INVITE_CREATED:'Convite criado',INVITE_REVOKED:'Convite revogado',REGION_ACCESS_UPDATED:'Acesso de região atualizado',LOCATION_ACCESS_UPDATED:'Visibilidade de local atualizada',SECRET_LOCATION_CREATED:'Local secreto criado',GROUP_UPDATED:'Grupo atualizado',CHARACTER_UPDATED:'Personagem atualizado',PROFILE_UPDATED:'Biografia atualizada',PHOTO_UPDATED:'Foto atualizada',PHOTO_REMOVED:'Foto removida',ACCOUNT_DISABLED:'Conta suspensa',ACCOUNT_ENABLED:'Conta reativada'})[action]??action;
}
function pageContent() {
  if(mailOffice.handles(state.page))return mailOffice.page();
  if(chocolateOffice.handles(state.page))return chocolateOffice.page();
  if(collectionOffice.handles(state.page))return collectionOffice.page();
  if(cupOffice.handles(state.page))return cupOffice.page();
  if(boardOffice.handles(state.page))return boardOffice.page();
  if(calendarOffice.handles(state.page))return calendarOffice.page();
  if(commerceOffice.handles(state.page))return commerceOffice.page();
  if(contentOffice.handles(state.page))return contentOffice.page();
  if(documentOffice.handles(state.page))return documentOffice.page();
  if(campaignOffice.handles(state.page))return campaignOffice.page();
  if(itemOffice.handles(state.page))return itemOffice.page();
  if(npcOffice.handles(state.page))return npcOffice.page();
  if(workshop.handles(state.page))return workshop.page();
  const page=state.page.split('/')[2]??'inicio';
  if(page==='inicio')return home();
  if(page==='hogwarts')return school();
  if(page==='hogsmeade')return hogsmeade();
  if(page==='acervos')return archives();
  if(page==='perfil')return profile();
  if(page==='mestre')return masterPage();
  if(page==='local')return placePage();
  if(page==='casas')return houses();
  if(page==='publicacao')return state.detail?`${label('NOVIDADES')}<h1 class="display">${esc(state.detail.title)}</h1><article class="card publication">${esc(state.detail.body)}</article>`:empty('Publicação indisponível.');
  if(futurePages[page])return future(page);
  return `${label('ARQUIVOS MÁGICOS')}${empty('Esta página não foi encontrada.')}${button('Voltar ao início','/portal/inicio')}`;
}
function render() {
  delivery.sync();
  if(!state.session){document.documentElement.dataset.house='master';root.innerHTML=authPage();return;}
  if(!state.portal)return;
  document.documentElement.dataset.house=state.portal.character?.house??'master';
  document.title=`${state.page==='/portal/mestre'?'Central do Mestre':'Hogwarts 1890'} · Arquivos Mágicos`;
  root.innerHTML=`<div class="shell">${header()}<main id="main" class="page" tabindex="-1">${pageContent()}<footer class="portal-footer"><span>HOGWARTS · ARQUIVOS MÁGICOS</span><span>${esc(state.portal.calendar.academicYearLabel)}</span></footer></main></div>`;
}
async function preview(id) {
  if(state.session.role!=='MASTER')throw new Error('Acesso reservado ao Mestre.');
  state.view=id||null;state.page=id?'/portal/inicio':'/portal/mestre';state.dirty=false;
  history.pushState({},'',pathWithView(state.page));await refresh(true);
  document.querySelector('#main')?.focus();window.scrollTo({top:0,behavior:'instant'});
}
root.addEventListener('click',async event=>{
  const target=event.target.closest('[data-go],[data-action],[data-preview]');if(!target)return;
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  try {
    if(target.dataset.go) return await navigate(target.dataset.go);
    if(target.dataset.preview)return await preview(target.dataset.preview);
    const id=target.dataset.id;
    switch(target.dataset.action){
      case 'logout':await api('/api/auth/logout',{method:'POST',preview:false});state.session=null;state.view=null;state.portal=null;state.admin=null;history.replaceState({},'','/entrar');render();break;
      case 'end-preview':await preview(null);break;
      case 'remove-photo':await api(`/api/profile/photo?character=${id}`,{method:'DELETE'});await refresh(true);toast('Foto removida.');break;
      case 'revoke-invite':await api(`/api/master/invites/${id}`,{method:'DELETE'});await refresh(true);toast('Convite revogado.');break;
      case 'toggle-region':{if(state.dirty)throw new Error('Salve os ajustes antes de alterar a abertura.');const region=state.admin.regions.find(r=>r.id===id);await api('/api/master/regions/'+id,{method:'PATCH',body:{isOpen:!region.is_open,audience:region.audience,characters:region.characters,groups:region.groups}});await refresh(true);toast('Abertura da região atualizada.');break;}
      case 'toggle-account':await api(`/api/master/accounts/${id}`,{method:'PATCH',body:{disabled:target.dataset.disabled==='true'}});await refresh(true);toast('Acesso da conta atualizado.');break;
    }
  } catch(error){toast(error.message,true);}
});
root.addEventListener('input',event=>{if(!event.target.closest('[data-content-form="operation"],[data-content-form="preview"],[data-workshop-form="preview"],[data-npc-form="preview"],[data-npc-form="reveal"],[data-item-form="preview"],[data-campaign-form="preview"],[data-campaign-form="participants"],[data-campaign-form="objective-state"],[data-campaign-form="clue-reveal"],[data-campaign-form="outcome"]'))state.dirty=true;});
root.addEventListener('change',async event=>{
  if(event.target.id==='preview-select'){
    try{await preview(event.target.value);}catch(error){toast(error.message,true);}
  }
});
root.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement)||!form.dataset.form)return;
  event.preventDefault();if(state.busy)return;
  const errorEl=form.querySelector('.form-error');errorEl.textContent='';
  const data=new FormData(form), kind=form.dataset.form, submit=form.querySelector('button[type="submit"]');
  state.busy=true;submit.disabled=true;submit.setAttribute('aria-busy','true');
  let keep=false;
  try {
    const id=form.dataset.id;
    const recipients={characters:data.getAll('characters'),groups:data.getAll('groups')};
    if(kind==='login'||kind==='activate'){
      const invitation=new URLSearchParams(location.hash.slice(1)).get('convite');
      if(kind==='activate'&&!invitation)throw new Error('Abra o link completo do convite enviado pelo Mestre.');
      await api(`/api/auth/${kind}`,{method:'POST',body:{email:data.get('email'),password:data.get('password'),token:invitation},preview:false});
      state.view=null;state.session=await api('/api/session',{preview:false});state.portal=await api('/api/state');
      return await navigate(state.session.role==='MASTER'?'/portal/mestre':'/portal/inicio',true);
    }
    if(state.view)throw new Error('A visualização de personagem é somente leitura.');
    if(kind==='bio')await api(`/api/profile?character=${form.dataset.character}`,{method:'PATCH',body:{biography:data.get('biography')}});
    if(kind==='photo'){
      const file=data.get('photo');if(!file?.size||file.size>2*1024*1024)throw new Error('Escolha uma foto de até 2 MB.');
      await api(`/api/profile/photo?character=${form.dataset.character}`,{method:'PUT',body:file,raw:true});
    }
    if(kind==='region')await api(`/api/master/regions/${id}`,{method:'PATCH',body:{isOpen:data.has('isOpen'),audience:data.get('audience'),...recipients}});
    if(kind==='location')await api(`/api/master/locations/${id}`,{method:'PATCH',body:{enabled:data.has('enabled'),isSecret:data.has('isSecret'),audience:data.get('audience'),x:data.get('x')===''?null:Number(data.get('x')),y:data.get('y')===''?null:Number(data.get('y')),...recipients}});
    if(kind==='character')await api(`/api/master/characters/${id}`,{method:'PATCH',body:{name:data.get('name'),house:data.get('house'),year:data.get('year')===''?null:Number(data.get('year'))}});
    if(kind==='group')await api(`/api/master/groups${id?'/'+id:''}`,{method:id?'PATCH':'POST',body:{name:data.get('name'),members:data.getAll('members')}});
    if(kind==='new-location')await api('/api/master/locations',{method:'POST',body:Object.fromEntries(data)});
    if(kind==='invite'){
      const result=await api('/api/master/invites',{method:'POST',body:Object.fromEntries(data)});
      const output=form.querySelector('#invite-result');output.innerHTML=`<label class="field">Link pessoal · copie agora<input class="invite-url" readonly value="${esc(result.url)}"></label><p class="subtle">O link não será exibido novamente.</p>`;
      output.querySelector('input').focus();output.querySelector('input').select();keep=true;
    }
    state.dirty=false;
    if(!keep)await refresh(true);
    toast(kind==='invite'?'Convite criado. Copie e compartilhe o link em privado.':'Alterações salvas.');
  } catch(error){errorEl.textContent=error.message;errorEl.setAttribute('tabindex','-1');errorEl.focus();}
  finally{state.busy=false;submit.disabled=false;submit.removeAttribute('aria-busy');}
});
window.addEventListener('popstate',async()=>{
  state.view=new URLSearchParams(location.search).get('view_as');state.page=location.pathname;state.dirty=false;
  try{await refresh(true);}catch(error){toast(error.message,true);}
});
async function boot() {
  try{
    state.session=await api('/api/session',{preview:false});
    state.portal=await api('/api/state');
    if(!state.page.startsWith('/portal/'))state.page=state.session.role==='MASTER'?'/portal/mestre':'/portal/inicio';
    if(state.session.role==='MASTER'&&!state.view)state.admin=await api('/api/master/state',{preview:false});
    history.replaceState({},'',pathWithView(state.page));
    try{await loadPage();}catch{state.detail=null;}
    render();
  }catch{state.session=null;render();}
}
await boot();
setInterval(async()=>{
  if(!state.session||state.busy||document.hidden)return;
  try{await refresh();}catch{/* Polling retries without interrupting form input. */}
},5000);
