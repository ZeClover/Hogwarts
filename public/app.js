import {createOfficeTools} from '/office-tools.js';
import {createOfficeEditors} from '/office-editors.js';
import {createQuestCertificates} from '/quest-certificates.js';
import {createQuestRewards} from '/quest-rewards.js';
import {magicPaths,magicIcon,routeIcon} from '/magic-icons.js';
import {createImageGallery} from '/image-gallery.js';
import {enhanceSimplicity,attachSimplicity} from '/simplicity.js';
import {createCreations} from '/creations.js';
import {attachImageFallback,enhanceExperience,organizeItemFields} from '/experience.js';
import {attachActionCaptions} from '/action-captions.js';
import {enhanceOfficeHelp} from '/office-help.js';
import {attachEditorTabs,enhanceQuestEditor,attachQuestSave} from '/editor-tabs.js';
import {attachQuickCreate} from '/quick-create.js';
import {primarySections,playerSection,createPlayerPages} from '/player-navigation.js';
import { createWorkshop } from '/workshop.js';
import { createNPCOffice } from '/npcs.js';
import { createItemOffice } from '/items.js';
import { createCampaignOffice } from '/campaign.js';
import { createDelivery } from '/delivery.js';
import { createDocumentOffice } from '/documents.js';
import { createContentOffice } from '/content.js';
import '/library.js';
import '/templates.js';
import {createArchivesOffice} from '/archives.js';
import {createInvestigationsOffice} from '/investigations.js';
import {createMailOffice} from '/mail.js';
import {createChocolateOffice} from '/chocolate.js';
import {createCollectionOffice} from '/collections.js';
import {createCupOffice} from '/cup.js';
import {createBoardOffice} from '/boards.js';
import {createCalendarOffice} from '/calendar.js';
import {createCommerceOffice} from '/commerce.js';
const root = document.querySelector('#root');
attachSimplicity(root);
const state = { session: null, authOrigin: null, portal: null, admin: null, view: new URLSearchParams(location.search).get('view_as'), page: location.pathname, detail: null, navigationError: '', dirty: false, busy: false };
attachActionCaptions(root,state);
attachImageFallback(root);
let toastTimer;
attachQuickCreate(root,{api,state,navigate,render,toast});
attachEditorTabs(root);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconPaths = {
 ...magicPaths,
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
const button = (title, page, icon='arrow', extra='') => `<button class="btn ghost ${extra}" data-go="${page}">${magicIcon(routeIcon(page,icon),18)} ${esc(title)}</button>`;
const playerPages=createPlayerPages({state,esc,ico,label,empty,button,pathWithView,render,api});
playerPages.attach(root);
const creations=createCreations({api,state,esc,label,empty,button,render});
creations.attach(root);
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
const investigationsOffice=createInvestigationsOffice({api,esc,label,empty,button,state,render,navigate,toast});
investigationsOffice.attach(root);
const archivesOffice=createArchivesOffice({api,esc,label,empty,button,state,render,toast});
archivesOffice.attach(root);
const questRewards=createQuestRewards({api,state,esc,toast});
const questCertificates=createQuestCertificates({api,state,esc,toast});
attachQuestSave(root,{state,toast,campaignOffice,questRewards,questCertificates});
root.addEventListener('quest-editor-enhance',()=>imageGallery.enhance(root));
const imageGallery=createImageGallery({api,state,esc,toast});
const officeEditors=createOfficeEditors({root,state,toast,navigate,controllers:{npcOffice,itemOffice,workshop,contentOffice,campaignOffice,mailOffice,investigationsOffice},enhanceTools:(editor,config)=>officeTools.enhance(editor,config)});
const officeTools=createOfficeTools({api,state,esc,label,empty,button,toast,root,getEditors:()=>officeEditors,imageGallery});
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
  if(raw&&body instanceof window.File)headers['X-Upload-Name']=encodeURIComponent(body.name);
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
  history.replaceState({...history.state,scrollY:window.scrollY},'');
  state.page=path;state.detail=null;state.navigationError='';state.dirty=false;state.fullCreate=false;
  history[replace?'replaceState':'pushState']({scrollY:0},'',pathWithView(path));
  const previous=root.querySelector('#main');previous?.setAttribute('aria-busy','true');
  const loading=document.createElement('p');loading.className='navigation-loading';loading.setAttribute('role','status');loading.textContent='Carregando seus arquivos…';previous?.prepend(loading);
  try{await loadPage();playerPages.remember(path);}catch(e){state.navigationError=e.message;}finally{previous?.removeAttribute('aria-busy');loading.remove();}render();
  document.querySelector('#main')?.focus();window.scrollTo({top:0,behavior:'instant'});
}
async function loadPage() {
  state.navigationError='';
  if(creations.handles(state.page)){await creations.load();return;}
  await playerPages.load();
  if(state.page==='/portal/regiao/hogwarts'){state.page='/portal/hogwarts';history.replaceState(history.state,'',pathWithView(state.page));}
  if(archivesOffice.handles(state.page)){await archivesOffice.load();return;}
  if(investigationsOffice.handles(state.page)){await investigationsOffice.load();return;}
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
  officeEditors.sync();if((state.officeSaving||state.officeDirty)&&root.querySelector('.office-tabbed-editor')?.dataset.officeKey===state.page)return;
  if(state.questSaving||state.rewardDirty||state.objectiveDirty||state.clueDirty||state.certificateDirty)return;
  if(!force&&!changed&&creations.handles(state.page))return;
  if(!force&&!changed&&!state.dirty&&archivesOffice.handles(state.page)){return;}
  if(!force&&!changed&&!state.dirty&&investigationsOffice.handles(state.page)){await investigationsOffice.poll();return;}
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
  const canonical=new URL(activate?'/ativar':'/entrar',state.authOrigin??location.origin);
  if(activate)canonical.hash=location.hash;
  const accessNotice=!state.authOrigin?`<p role="status">${esc(state.authContextProblem??'O servidor não respondeu à verificação de acesso. Tente novamente em instantes.')}</p><button class="btn" type="button" data-auth-retry>Tentar novamente</button>`:state.authOrigin!==location.origin?`<div class="auth-origin-note" role="status"><p>Este é um endereço temporário. Use o endereço principal para entrar na sua conta.</p><a class="btn" href="${esc(canonical.href)}" rel="noreferrer">Continuar no endereço principal</a></div>`:'';
  return `<main id="main" class="auth-shell" tabindex="-1"><section class="auth-art" aria-label="Castelo de Hogwarts à noite"><div class="auth-wordmark"><img src="/assets/hogwarts.webp" alt="Brasão de Hogwarts"><span>Hogwarts <small>ARQUIVOS MÁGICOS</small></span></div><div class="auth-story"><span class="eyebrow">ESCOLA DE MAGIA E BRUXARIA</span><h1>Há histórias que<br>pertencem a poucos.</h1><div class="gold-rule"></div><p>As suas esperam por você.</p><span class="auth-year">ANO LETIVO 1890–1891</span></div></section><section class="auth-form-panel"><div class="auth-form-inner"><span class="eyebrow">${activate?'UMA NOVA HISTÓRIA':'BEM-VINDO DE VOLTA'}</span><h2>${activate?'Seu lugar em Hogwarts':'Os arquivos aguardam'}</h2><p class="muted">${activate?'Use o e-mail do seu convite para criar sua conta.':'Entre para continuar a sua história.'}</p>${accessNotice||`<form data-form="${activate?'activate':'login'}"><label class="field">E-mail<input type="email" name="email" autocomplete="username" required maxlength="254" placeholder="Seu e-mail"></label><label class="field">${activate?'Crie uma senha':'Senha'}<input type="password" name="password" autocomplete="${activate?'new-password':'current-password'}" minlength="${activate?8:1}" maxlength="128" required placeholder="${activate?'Pelo menos 8 caracteres':'Sua senha'}"></label>${activate?'<p class="subtle">Seu convite é pessoal e pode ser utilizado uma única vez.</p>':''}<p class="form-error" role="alert"></p><button class="btn auth-submit" type="submit">${activate?'Aceitar convite':'Entrar nos arquivos'} ${ico('arrow',18)}</button></form>`}<div class="auth-note">${ico('lock',16)} Acesso privado por convite do Mestre.</div>${activate?'<a class="auth-link" href="/entrar">Já tem uma conta? Entrar</a>':''}<p class="auth-help">${activate?'O convite expirou? Peça um novo ao Mestre.':'Para acessar pela primeira vez ou recuperar seu acesso, fale com o Mestre.'}</p></div><span class="auth-bottom">HOGWARTS · 1890</span></section></main>`;
}
function header() {
  const p=state.portal.character, isMaster=state.session.role==='MASTER'&&!state.view;
  const active=page=>isMaster?(page==='mestre'?state.page==='/portal/mestre':page==='mestre/oficinas'?state.page.startsWith('/portal/mestre/oficinas')||state.page==='/portal/mestre/criacoes':state.page.startsWith('/portal/'+page)):playerSection(state.page)===page;
  const links=isMaster?[['Central','mestre'],['Oficina Geral','mestre/oficinas'],['Campanha','mestre/sessao/missoes']]:primarySections;
  return `<header class="top"><a class="brand" href="${pathWithView('/portal/inicio')}" data-go="/portal/inicio"><img src="/assets/hogwarts.webp" alt=""><div class="brand-title">Hogwarts <small>1890 · Arquivos Mágicos</small></div></a><nav class="navigation" aria-label="Principal">${links.map(([name,page])=>`<a href="${pathWithView('/portal/'+page)}" data-go="/portal/${page}" ${active(page)?'aria-current="page"':''}>${name}</a>`).join('')}</nav><div class="persona">${p?`<a class="persona-link" href="${pathWithView('/portal/perfil')}" data-go="/portal/perfil"><img src="${esc(p.crest)}" alt=""><span>${esc(p.name)}<small>${esc(p.houseName)}</small></span></a>`:`<a class="persona-link" href="/portal/mestre" data-go="/portal/mestre">${ico('shield',27)}<span>Mestre<small>Arquivos Mágicos</small></span></a>`}<button class="icon-button" data-action="logout" aria-label="Sair da conta" title="Sair">${ico('exit',19)}</button></div></header>${state.view?`<aside class="preview-bar"><span>${ico('eye',18)} Visualizando ${esc(p?.name)} · somente leitura</span><button class="btn ghost small" data-action="end-preview">Voltar ao Mestre</button></aside>`:isMaster?`<div class="master-bar"><div class="admin-bar-links"><a href="/portal/mestre" data-go="/portal/mestre">${ico('shield',15)} Central da Sessão</a></div><label>Visualizar como <select id="preview-select" aria-label="Visualizar como personagem"><option value="">Escolher personagem</option>${(state.admin?.characters??[]).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label></div>`:''}`;
}
function home() { return playerPages.home(); }
function school() { return playerPages.school(); }
function archives() { return playerPages.archives(); }
function mast(image, kicker, title) {
  return `<section class="media-mast${image?'':' no-image'}" ${image?`style="--media:url('${image}')"`:''}><div><span class="eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1></div></section>`;
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
  return `${label('ÁREA DO MESTRE')}<div class="gmheader"><div><h1 class="display">Central do Mestre</h1><p class="muted">Os caminhos se abrem pelas suas mãos.</p></div>${ico('shield',43)}</div><div class="group master-immediate">${button('Criar missão','/portal/mestre/oficinas/missoes/novo','scroll')}${button('Criar NPC','/portal/mestre/oficinas/npcs/novo','user')}${button('Criar item','/portal/mestre/oficinas/itens/novo','star')}${button('Escrever notícia','/portal/mestre/oficinas/conteudos/newspapers/novo','quill')}${button('Revelar descoberta','/portal/mestre/oficinas/conteudos/chocolatecards','book')}</div><section class="master-creation-entry card"><img src="/assets/correio_pergaminhos.webp" alt=""><div><h2 class="head2">Minhas Criações</h2><p>Crie algo novo ou continue um rascunho de qualquer oficina.</p>${button('Abrir Minhas Criações','/portal/mestre/criacoes','quill')}</div></section><div class="gmstats"><div class="gmstat">${ico('map')}<span>Hogsmeade</span><strong>${region.is_open?'Aberta':'Fechada'}</strong></div><div class="gmstat">${ico('user')}<span>Personagens</span><strong>${a.characters.length.toString().padStart(2,'0')}</strong></div><div class="gmstat">${ico('shield')}<span>Grupos</span><strong>${a.groups.length.toString().padStart(2,'0')}</strong></div></div><div class="group">${button('Moderar investigações','/portal/mestre/investigacoes','book')}${button('Fila do Correio','/portal/mestre/correio','mail')}${button('Pacotes e trocas de Sapos','/portal/mestre/sapos','star')}${button('Propostas de curiosidades','/portal/mestre/curiosidades','star')}${button('Pontos das Casas','/portal/mestre/taca','shield')}${button('Propostas de avisos','/portal/mestre/murais','scroll')}${button('Carteiras e pedidos','/portal/mestre/comercio','star')}${button('Conduzir missões','/portal/mestre/sessao/missoes','scroll')}</div><nav class="admin-tabs" aria-label="Seções do Mestre"><a href="#regions">Regiões</a><a href="#locations">Locais</a><a href="#characters">Personagens</a><a href="#invites">Convites</a><a href="#groups">Grupos</a><a href="/portal/mestre/seguranca" data-go="/portal/mestre/seguranca">Segurança e Backups</a></nav>
  <section id="regions"><div class="rtitle"><h2>Regiões e caminhos</h2></div><div class="dual">${a.regions.map(r=>`<form class="card gmblock" data-form="region" data-id="${esc(r.id)}"><div class="panel-heading"><h3>${esc(r.title)}</h3><span class="badge">${r.is_open?'Aberta':'Fechada'}</span></div><label class="toggle"><input type="checkbox" name="isOpen" ${r.is_open?'checked':''}> Região aberta</label>${audienceField(r)}${recipients(r)}<p class="form-error" role="alert"></p><button class="btn" type="submit">Salvar acesso</button><button class="btn ghost" type="button" data-action="toggle-region" data-id="${esc(r.id)}">${r.is_open?'Fechar região':'Abrir região'}</button></form>`).join('')}</div></section>
  <section id="locations"><div class="rtitle"><h2>Visibilidade dos locais</h2></div><div class="admin-notice">${ico('map',20)}<p>O mapa de Hogsmeade é provisório: a restauração tem retoques visíveis. Revise a imagem e as posições dos marcadores antes de aprovar sua versão final.</p></div><div class="dual">${a.locations.map(l=>`<details class="card location-control"><summary><span>${esc(l.title)}<small>${esc(a.regions.find(r=>r.id===l.region_id)?.title??'Região')}</small></span><span class="badge">${l.is_secret?'Secreto':l.enabled?'Público':'Oculto'}</span></summary><form data-form="location" data-id="${esc(l.id)}"><label class="toggle"><input type="checkbox" name="enabled" ${l.enabled?'checked':''}> Local disponível</label><label class="toggle"><input type="checkbox" name="isSecret" ${l.is_secret?'checked':''}> Local secreto · exige liberação específica</label>${audienceField(l)}${recipients(l)}<div class="coordinate-fields"><label class="field">Marcador X (%)<input type="number" name="x" min="0" max="100" step="0.1" value="${l.x===null?'':Number(l.x)}"></label><label class="field">Marcador Y (%)<input type="number" name="y" min="0" max="100" step="0.1" value="${l.y===null?'':Number(l.y)}"></label></div><p class="form-error" role="alert"></p><button class="btn small" type="submit">Salvar local</button></form></details>`).join('')}</div><details class="card location-control"><summary>Criar local secreto</summary><form data-form="new-location"><label class="field">Nome<input name="title" required maxlength="100"></label><label class="field">Região<select name="regionId" aria-label="Região">${a.regions.map(r=>`<option value="${esc(r.id)}">${esc(r.title)}</option>`).join('')}</select></label><label class="field">Imagem<select name="image" aria-label="Imagem">${a.images.map(i=>`<option value="${esc(i)}">${esc(i)}</option>`).join('')}</select></label><p class="form-error" role="alert"></p><button class="btn small" type="submit">Criar local reservado</button></form></details></section>
  <section id="characters"><div class="rtitle"><h2>Personagens</h2></div><details class="card gmblock"><summary>Criar novo aluno</summary><form data-form="new-character"><label class="field">Nome do aluno<input name="name" maxlength="100" required></label><label class="field">Casa do aluno<select name="house" aria-label="Casa do aluno">${a.houses.map(h=>`<option value="${esc(h.id)}">${esc(h.name)}</option>`).join('')}</select></label><label class="field">Ano escolar do aluno<select name="year" aria-label="Ano escolar do aluno">${[1,2,3,4,5,6,7].map(y=>`<option value="${y}">${y}º ano</option>`).join('')}</select></label><p class="form-error" role="alert"></p><button class="btn" type="submit">Criar aluno</button></form></details><div class="character-list">${a.characters.map(c=>`<details class="card character-control"><summary><img src="${esc(c.crest)}" alt=""><span>${esc(c.name)}<small>${esc(c.houseName)}</small></span></summary><div class="character-edit"><div class="character-preview"><button class="btn ghost small" data-preview="${esc(c.id)}" type="button">${ico('eye',15)} Visualizar como personagem</button></div><form data-form="character" data-id="${esc(c.id)}"><label class="field">Nome<input name="name" value="${esc(c.name)}" required maxlength="100"></label><div class="dual"><label class="field">Casa<select name="house" aria-label="Casa">${a.houses.map(h=>`<option value="${esc(h.id)}" ${h.id===c.house?'selected':''}>${esc(h.name)}</option>`).join('')}</select></label><label class="field">Ano escolar<select name="year" aria-label="Ano escolar"><option value="">Não definido</option>${[1,2,3,4,5,6,7].map(y=>`<option value="${y}" ${c.year===y?'selected':''}>${y}º ano</option>`).join('')}</select></label></div><p class="form-error" role="alert"></p><button class="btn" type="submit">Salvar personagem</button></form>${profile(c,true)}${c.account?`<div class="account-control"><span>${esc(c.account.email)} · ${c.account.disabled?'Conta suspensa':'Conta ativa'}</span><button class="btn ghost small" data-action="toggle-account" data-id="${esc(c.account.id)}" data-disabled="${c.account.disabled?'false':'true'}">${c.account.disabled?'Reativar acesso':'Suspender acesso'}</button></div>`:'<p class="subtle">Nenhuma conta vinculada. Envie um convite abaixo.</p>'}</div></details>`).join('')}</div></section>
  <section id="invites"><div class="rtitle"><h2>Convites pessoais</h2></div><div class="dual"><form class="card gmblock" data-form="invite"><h3>Novo convite</h3><label class="field">E-mail<input name="email" type="email" required maxlength="254"></label><label class="field">Papel<select name="role" aria-label="Papel"><option value="PLAYER">Jogador</option><option value="MASTER">Mestre</option></select></label><label class="field">Personagem<select name="characterId" aria-label="Personagem">${a.characters.filter(c=>!c.account).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><p class="subtle">Válido por 72 horas. Compartilhe o link apenas com o destinatário.</p><p class="form-error" role="alert"></p><button class="btn" type="submit">Gerar convite</button><div id="invite-result"></div></form><div class="card gmblock"><h3>Últimos convites</h3>${a.invites.length?a.invites.map(i=>{const active=!i.used_at&&!i.revoked_at&&i.expires_at>Date.now()/1000;return `<div class="invite-row"><div><strong>${esc(i.email)}</strong><small>${i.role==='MASTER'?'Mestre':esc(a.characters.find(c=>c.id===i.character_id)?.name)} · ${i.used_at?'Aceito':i.revoked_at?'Revogado':active?'Pendente':'Expirado'}</small></div>${active?`<button class="btn ghost small" data-action="revoke-invite" data-id="${esc(i.id)}">Revogar</button>`:''}</div>`;}).join(''):empty('Nenhum convite enviado.')}</div></div></section>
  <section id="groups"><div class="rtitle"><h2>Grupos de acesso</h2></div><div class="dual">${[...a.groups,{id:'',name:'',members:[]}].map(g=>`<form class="card gmblock" data-form="group" data-id="${esc(g.id)}"><h3>${g.id?'Editar grupo':'Novo grupo'}</h3><label class="field">Nome<input name="name" value="${esc(g.name)}" required maxlength="80"></label><fieldset class="recipient-field"><legend>Integrantes</legend><div class="checks">${a.characters.map(c=>`<label><input type="checkbox" name="members" value="${esc(c.id)}" ${g.members.includes(c.id)?'checked':''}>${esc(c.name)}</label>`).join('')}</div></fieldset><p class="form-error" role="alert"></p><button class="btn" type="submit">${g.id?'Salvar grupo':'Criar grupo'}</button></form>`).join('')}</div></section>
`;
}
function pageContent() {
  if(state.navigationError)return `<section class="card note-panel" role="alert"><h1 class="head2">Não foi possível abrir esta página</h1><p>${esc(state.navigationError)}</p>${button('Tentar novamente',state.page)}${button('Voltar ao início','/portal/inicio')}</section>`;
  if(/^\/portal\/(?:mestre\/oficinas\/)?conteudos\/(years|events|timetables)(\/|$)/.test(state.page))return `${label('ARQUIVOS PRESERVADOS')}<h1 class="display">Registros preservados</h1><p>Este módulo não integra a navegação. Seus dados antigos permanecem guardados.</p>${button('Voltar ao portal','/portal/inicio')}`;
  if(state.page.startsWith('/portal/mestre/oficinas/historias'))return `${label('MISSÕES INDIVIDUAIS')}<h1 class="display">Histórias pessoais</h1><p>Histórias pessoais são missões com um destinatário. As histórias antigas foram preservadas e incorporadas às missões.</p>${button('Abrir missões','/portal/mestre/oficinas/missoes')}${button('Criar missão individual','/portal/mestre/oficinas/missoes/novo')}`;
  if(creations.handles(state.page))return creations.page();
  if(archivesOffice.handles(state.page))return archivesOffice.page();
  if(investigationsOffice.handles(state.page))return investigationsOffice.page();
  if(mailOffice.handles(state.page))return mailOffice.page();
  if(chocolateOffice.handles(state.page))return chocolateOffice.page();
  if(collectionOffice.handles(state.page))return collectionOffice.page();
  if(cupOffice.handles(state.page))return cupOffice.page();
  if(boardOffice.handles(state.page))return boardOffice.page();
  if(calendarOffice.handles(state.page))return `${label('ARQUIVOS PRESERVADOS')}<h1 class="display">Registros preservados</h1><p>O calendário não faz parte da navegação. Os registros antigos continuam guardados.</p>${button('Voltar ao portal','/portal/inicio')}`;
  if(commerceOffice.handles(state.page))return commerceOffice.page();
  if(contentOffice.handles(state.page))return contentOffice.page();
  if(documentOffice.handles(state.page))return documentOffice.page();
  if(campaignOffice.handles(state.page))return campaignOffice.page();
  if(itemOffice.handles(state.page))return itemOffice.page();
  if(npcOffice.handles(state.page))return npcOffice.page();
  if(workshop.handles(state.page))return workshop.page();
  const page=state.page.split('/')[2]??'inicio';
  if(page==='inicio')return home();
  if(page==='explorar')return playerPages.explore();
  if(page==='diario')return playerPages.diary();
  if(page==='sala-comunal')return playerPages.commonRoom();
  if(page==='salao-principal')return playerPages.hall();
  if(page==='hogwarts')return school();
  if(page==='hogsmeade')return hogsmeade();
  if(page==='acervos')return archives();
  if(page==='perfil')return profile()+`<div class="group">${button('Minha carteira','/portal/carteira','star')}${button('Galeria de Imagens','/portal/midias','book')}${button('Artigos revelados','/portal/artigos','book')}</div>`;
  if(page==='mestre')return masterPage();
  if(page==='local')return placePage();
  if(page==='casas')return houses();
  if(page==='publicacao')return state.detail?`${label('NOVIDADES')}<h1 class="display">${esc(state.detail.title)}</h1><article class="card publication">${esc(state.detail.body)}</article>`:empty('Publicação indisponível.');
  return `${label('ARQUIVOS MÁGICOS')}${empty('Esta página não foi encontrada.')}${button('Voltar ao início','/portal/inicio')}`;
}
function journeyTrail(){
  const path=state.page;if(path==='/portal/inicio'||path==='/portal/mestre')return '';
  const master=state.session.role==='MASTER'&&!state.view;
  let parent=master?'/portal/mestre/oficinas':'/portal/inicio',name=master?'Oficina Geral':'Início';
  if(master&&path==='/portal/mestre/oficinas'){parent='/portal/mestre';name='Central';}
  else if(master&&path.startsWith('/portal/mestre/oficinas/')&&path.split('/').length>=6&&!path.endsWith('/novo')&&!path.endsWith('/nova')){parent='/portal/mestre/criacoes';name='Minhas Criações';}
  if(!master){
    if(path.startsWith('/portal/avisos')||path.includes('/conteudos/boards/')){parent='/portal/hogwarts';name='Hogwarts';}
    else if(path==='/portal/sala-comunal'||path==='/portal/calendario'||path==='/portal/salao-principal'){parent='/portal/hogwarts';name='Hogwarts';}
    else if(path.startsWith('/portal/conteudos/events/')){parent='/portal/acervos';name='Acervos';}
    else if(path.startsWith('/portal/conteudos/')){const parts=path.split('/');parent=parts.length>4?parts.slice(0,4).join('/'):'/portal/explorar';name=parts.length>4?'Voltar à lista':'Explorar';}
    else if(path.startsWith('/portal/local/')){const region=state.portal.locations.find(l=>l.id===path.split('/').pop())?.regionId;parent=region==='hogwarts'?'/portal/hogwarts':region==='hogsmeade'?'/portal/hogsmeade':region?'/portal/regiao/'+region:'/portal/explorar';name=region==='hogwarts'?'Hogwarts':region==='hogsmeade'?'Hogsmeade':'Explorar';}
    else if(playerSection(path)){const section=playerSection(path);parent='/portal/'+section;name=primarySections.find(x=>x[1]===section)?.[0]??'Início';if(parent===path){parent='/portal/inicio';name='Início';}}
  }
  return `<nav class="journey-trail" aria-label="Caminho da página"><a href="${pathWithView(parent)}" data-go="${parent}">${ico('arrow',16)} Voltar a ${esc(name)}</a><span>${master?'Mestre':path.includes('/avisos')||path.includes('/conteudos/boards')?'Explorar › Hogwarts › Murais':'Arquivos Mágicos'}</span></nav>`;
}
function render() {
  delivery.sync();
  campaignOffice.sync();
  if(!state.session){questRewards.mount(root);questCertificates.mount(root);document.documentElement.dataset.house='master';root.innerHTML=authPage();return;}
  if(!state.portal)return;
  document.documentElement.dataset.house=state.portal.character?.house??'master';
  document.title=`${state.page==='/portal/mestre'?'Central do Mestre':'Hogwarts 1890'} · Arquivos Mágicos`;
  root.innerHTML=`<div class="shell">${header()}<main id="main" class="page" tabindex="-1">${journeyTrail()}${pageContent()}<footer class="portal-footer"><span>HOGWARTS · ARQUIVOS MÁGICOS</span><span>${esc(state.portal.calendar.academicYearLabel)}</span></footer></main></div>`;
  enhanceExperience(root,state);
  imageGallery.enhance(root);
  organizeItemFields(root);
  enhanceOfficeHelp(root,state,esc);
  enhanceQuestEditor(root,state);
  campaignOffice.enhanceSheet();
  questRewards.mount(root);
  questCertificates.mount(root);
  enhanceSimplicity(root,state,{api,button,esc});
  officeEditors.enhance();officeEditors.sync();
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
root.addEventListener('input',event=>{if(event.target.closest('[data-quest-rewards],[data-quest-certificates],[data-campaign-form="inline-objective"],[data-campaign-form="inline-clue"]'))return;if(!event.target.closest('[data-workshop-form="office-search"],[data-content-form="operation"],[data-content-form="preview"],[data-workshop-form="preview"],[data-npc-form="preview"],[data-npc-form="reveal"],[data-item-form="preview"],[data-campaign-form="preview"],[data-campaign-form="participants"],[data-campaign-form="objective-state"],[data-campaign-form="clue-reveal"],[data-campaign-form="outcome"]'))state.dirty=true;});
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
    if(kind==='new-character')await api('/api/master/characters',{method:'POST',body:{name:data.get('name'),house:data.get('house'),year:Number(data.get('year'))}});
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
history.scrollRestoration='manual';
window.addEventListener('popstate',async event=>{
  const savedScroll=event.state?.scrollY??0;
  state.view=new URLSearchParams(location.search).get('view_as');state.page=location.pathname;state.dirty=false;
  try{await refresh(true);requestAnimationFrame(()=>window.scrollTo({top:savedScroll,behavior:'instant'}));}catch(error){toast(error.message,true);}
});
async function checkAuthContext(){
  state.authOrigin=null;
  try{const response=await fetch('/api/auth/context',{credentials:'same-origin',signal:window.AbortSignal.timeout(15000)});if(!response.ok){const messages={CONFIGURATION_MISSING:'A configuração da hospedagem está incompleta.',CONFIGURATION_INVALID:'A configuração da hospedagem precisa ser corrigida.',DATABASE_MIGRATIONS:'O banco da campanha precisa ser atualizado antes do acesso.',DATABASE_CONNECTION:'O servidor não conseguiu conectar ao banco da campanha.',APPLICATION_INITIALIZATION:'A aplicação da campanha não conseguiu iniciar.'};let problem;try{problem=await response.json();}catch{/* Platform errors can be HTML. */}state.authContextProblem=messages[problem?.code]?`${messages[problem.code]} Código: ${problem.code}.${problem.code==='CONFIGURATION_MISSING'&&Array.isArray(problem.missing)?' Faltam: '+problem.missing.filter(name=>['APP_ORIGIN','TURSO_DATABASE_URL','TURSO_AUTH_TOKEN','BACKUP_ENCRYPTION_KEY','HOGWARTS_STORAGE_PREFIX','BLOB_READ_WRITE_TOKEN'].includes(name)).join(', ')+'.':''}`:`O servidor de acesso está indisponível (HTTP ${response.status}). Tente novamente em instantes.`;return;}const {origin}=await response.json(),parsed=new URL(origin);if(!['http:','https:'].includes(parsed.protocol)||parsed.origin!==origin)throw new Error('invalid-context');state.authOrigin=origin;state.authContextProblem=null;}
  catch(e){state.authContextProblem=e.name==='TimeoutError'?'O servidor demorou a responder à verificação de acesso. Tente novamente em instantes.':'Não foi possível conectar ao servidor para verificar o acesso. Tente novamente em instantes.';}
}
root.addEventListener('click',async e=>{const button=e.target.closest('[data-auth-retry]');if(!button)return;button.disabled=true;button.textContent='Verificando…';try{await boot();}finally{if(button.isConnected){button.disabled=false;button.textContent='Tentar novamente';}}});
async function boot() {
  await checkAuthContext();
  if(!state.authOrigin){state.session=null;state.portal=null;render();return;}
  try{
    state.session=await api('/api/session',{preview:false});
    state.portal=await api('/api/state');
    if(!state.page.startsWith('/portal/'))state.page=state.session.role==='MASTER'?'/portal/mestre':'/portal/inicio';
    if(state.session.role==='MASTER'&&!state.view)state.admin=await api('/api/master/state',{preview:false});
    history.replaceState({scrollY:window.scrollY},'',pathWithView(state.page));
    try{await loadPage();}catch{state.detail=null;}
    render();
  }catch{state.session=null;render();}
}
await boot();
setInterval(async()=>{
  if(!state.session||state.busy||document.hidden)return;
  try{await refresh();}catch{/* Polling retries without interrupting form input. */}
},5000);
