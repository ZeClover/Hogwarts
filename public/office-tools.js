import {createContentOffice} from '/content.js';
import {enhanceSimplicity} from '/simplicity.js';
const base='/portal/mestre/oficinas/conteudos/';
const families={books:'BOOK',lessons:'BOOK',newspapers:'NEWSPAPER',yearbooks:'SCRAPBOOK',retrospectives:'SCRAPBOOK',bestiary:'CREATURE',chocolatecards:'CARD',curiosities:'VITRINE',memories:'SCRAPBOOK',rarities:'BOOK',shops:'VITRINE'};
export function createOfficeTools({api,state,esc,label,empty,button,toast,root,getEditors,imageGallery}){
 const cache=new Map();let token=null,counter=0;
 function enhance(editor,config){
  if(token!==state.session?.csrf){cache.clear();token=state.session?.csrf;}const kind=config.key.split('/conteudos/')[1]?.split('/')[0],id=config.key.split('/').pop();
  if(kind==='shops'&&!['novo','nova'].includes(id))tool(editor,config,'catalog','Catálogo',{kind:'offers',shopId:id});
  if(config.key==='/portal/mestre/sapos')tool(editor,config,'sets','Conjuntos e probabilidades',{kind:'chocolatepools',list:true});
  const template=config.main.querySelector('[name="payload.templateId"],[name="templateId"]');if(template)tool(editor,config,'models','Modelos',{kind:'templates',binding:template,family:families[kind]??(config.main.dataset.mailForm?'LETTER':null)});
  const book=config.main.querySelector('[name="payload.bookId"]');if(kind==='rarities'&&book)tool(editor,config,'book','Obra e páginas',{kind:'books',binding:book});
 }
 function tool(editor,config,key,title,options){
  const cacheKey=token+':'+config.key+':'+key;let item=cache.get(cacheKey);
  if(!item){const panel=document.createElement('section');panel.className='card quest-operation-panel office-integrated-tool';panel.dataset.officeTool=key;panel.innerHTML=`<h2 class="head2">${esc(title)}</h2><p class="subtle">Edite aqui e use o botão Salvar no topo.</p><div class="group" data-office-tool-actions></div><div data-office-tool-list></div><div data-office-tool-editor></div>`;item={panel,options,scope:panel.querySelector('[data-office-tool-editor]'),loaded:false,path:null,serial:'embedded-'+(++counter),config};cache.set(cacheKey,item);}
  item.options=options;item.config=config;getEditors().addPanel(editor,key,title,item.panel);
  const actions=item.panel.querySelector('[data-office-tool-actions]');actions.innerHTML=options.list?'<button class="btn" type="button" data-tool-new>Novo conjunto</button>':options.shopId?'<button class="btn" type="button" data-tool-new>Nova oferta</button>':`<button class="btn ghost" type="button" data-tool-selected>Editar ${key==='models'?'modelo':'livro'} selecionado</button><button class="btn" type="button" data-tool-new>Novo ${key==='models'?'modelo':'livro'}</button>`;
  actions.querySelector('[data-tool-new]').onclick=()=>void open(item,base+options.kind+'/novo');const selected=actions.querySelector('[data-tool-selected]');if(selected)selected.onclick=()=>{if(!options.binding.value){toast('Escolha um registro no cadastro antes de editar.',true);return;}void open(item,base+options.kind+'/'+options.binding.value);};
  if(options.shopId||options.list)void catalog(item);else if(item.path&&!item.loaded)void open(item,item.path);
  for(const link of editor.querySelectorAll('[data-go]')){if(link.closest('.office-tabbed-editor')!==editor)continue;const target=link.dataset.go;if(target===base+options.kind||target?.startsWith(base+options.kind+'/')){link.textContent=options.list?'Configurar conjuntos nesta aba':key==='models'?'Editar modelo nesta aba':'Editar obra nesta aba';link.removeAttribute('data-go');link.onclick=e=>{e.preventDefault();getEditors().activate(editor,key);if(target!==base+options.kind)void open(item,key==='models'&&options.binding?.value?base+'templates/'+options.binding.value:target);};}}
 }
 async function catalog(item){
  const list=item.panel.querySelector('[data-office-tool-list]');try{const rows=(await api('/api/master/content/'+item.options.kind)).items;if(!item.panel.isConnected)return;list.innerHTML=rows.filter(r=>item.options.list||r.payload.shopId===item.options.shopId).map(r=>`<article class="inline-reward-card"><h3 class="head3">${esc(r.payload.title)}</h3><p class="subtle">${r.status==='PUBLISHED'?'Publicado':'Em preparação'}${item.options.list?'':` · ${r.payload.priceNuques??'Preço não definido'} Nuques · estoque ${r.payload.stock??'ilimitado'}`}</p><button class="btn ghost" type="button" data-tool-offer="${esc(r.id)}">Editar ${item.options.list?'conjunto':'oferta'}</button></article>`).join('')||'<p class="muted">Nenhum registro preparado.</p>';for(const button of list.querySelectorAll('[data-tool-offer]'))button.onclick=()=>void open(item,base+item.options.kind+'/'+button.dataset.toolOffer);}
  catch{if(list.isConnected)list.innerHTML='<p role="alert">Não foi possível carregar o catálogo. Reabra esta aba para tentar novamente.</p>';}
 }
 async function open(item,path,force=false){
  if(item.localState?.dirty&&!force){toast('Salve pelo botão no topo ou cancele esta edição antes de abrir outro registro.',true);return;}
  item.path=path;
  if(!item.controller){
   const localState={...state,page:path,dirty:false,fullCreate:true,view:null},identity=state.session.csrf;item.localState=localState;
   const secureApi=(path,args)=>{if(state.session?.csrf!==identity||state.view)throw new Error('A sessão mudou. Reabra este editor.');return api(path,args);};
   const localRender=()=>{
    if(!item.scope.isConnected)return;item.scope.innerHTML=item.controller.page();
    for(const node of item.scope.querySelectorAll('[id]')){const old=node.id;node.id=item.serial+'-'+old;for(const lab of item.scope.querySelectorAll('label[for]'))if(lab.htmlFor===old)lab.htmlFor=node.id;}
    imageGallery.enhance(item.scope);enhanceSimplicity(item.scope,localState,{api:secureApi,button,esc});
    const adapter={...item.controller,afterSave:async saved=>{localState.dirty=false;await go(saved,true);}};getEditors().enhance(item.scope,localState,adapter,true);item.loaded=true;
    const form=item.scope.querySelector('[data-content-form="editor"]');if(form&&localState.page.endsWith('/novo')){const shop=form.querySelector('[name="payload.shopId"]');if(shop&&item.options.shopId)shop.value=item.options.shopId;const family=form.querySelector('[name="payload.family"]');if(family&&item.options.family)family.value=item.options.family;}
    if(form&&item.options.shopId){const itemSelect=form.querySelector('[name="payload.itemId"]'),title=form.querySelector('[name="payload.title"]');itemSelect?.addEventListener('change',()=>{if(!title.value&&itemSelect.value){title.value=itemSelect.selectedOptions[0].textContent;title.dispatchEvent(new window.Event('input',{bubbles:true}));}});}
    let close=item.scope.querySelector('[data-tool-close]');if(!close){close=document.createElement('button');close.type='button';close.className='btn ghost';close.dataset.toolClose='';close.textContent='Cancelar e fechar este editor';close.onclick=()=>{localState.dirty=false;item.scope.replaceChildren();item.path=null;item.loaded=false;};item.scope.append(close);}
    if(item.options.binding)void refreshBindings(item);if(item.options.shopId)void catalog(item);
   };
   const go=async(next,force=false)=>{if(localState.dirty&&!force){toast('Use Salvar no topo antes de trocar este registro.',true);return;}localState.page=next;localState.fullCreate=true;item.path=next;await item.controller.load();localRender();};
   item.controller=createContentOffice({api:secureApi,esc,label,empty,button,state:localState,render:localRender,navigate:go,toast});item.go=go;item.controller.attach(item.scope);
   item.scope.addEventListener('click',e=>{const link=e.target.closest('[data-go]');if(link){e.preventDefault();e.stopPropagation();void go(link.dataset.go);}},true);
   item.scope.addEventListener('click',e=>e.stopPropagation());item.scope.addEventListener('submit',e=>e.stopPropagation());
   const dirty=e=>{if(e.target.closest('[data-content-form="editor"]'))localState.dirty=true;};item.scope.addEventListener('input',dirty);item.scope.addEventListener('change',dirty);
  }
  item.scope.innerHTML='<p role="status">Carregando editor…</p>';await item.go(path,force);
 }
 async function refreshBindings(item){
  const select=item.options.binding;if(!select?.isConnected)return;try{const context=await api('/api/master/content/context'),source=item.options.kind==='templates'?'template_'+item.options.family:'books',choices=context.references[source]??[],selected=select.value;for(const choice of choices){let option=Array.from(select.options).find(o=>o.value===choice.id);if(!option){option=new window.Option(choice.name,choice.id);select.add(option);}else option.textContent=choice.name;}select.value=selected;}catch{/* The saved binding remains intact if the catalogue is temporarily unavailable. */}
 }
 root.addEventListener('office-editor-enhance',e=>imageGallery.enhance(e.target));
 return {enhance};
}
