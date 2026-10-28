const writers='[data-npc-form="profile"],[data-npc-form="fragment"],[data-item-form="item"],[data-workshop-form="media"],[data-workshop-form="cohort"],[data-content-form="editor"],[data-mail-form="compose"],[data-mail-form="image"],[data-case-form="moderate"]';
const active=new Map(),baselines=new WeakMap(),owners=new WeakMap();let nextId=0;
const signature=form=>JSON.stringify(Array.from(new FormData(form),([key,value])=>[key,typeof value==='string'?value:[value.name,value.size,value.name||value.size?value.lastModified:0]]));
const changed=form=>form.dataset.officeForceDirty==='true'||baselines.get(form)!==signature(form);
const writable=form=>!form.querySelector('fieldset')?.disabled;
function tabKey(el,type){
 const title=el.querySelector(':scope>summary,:scope>legend')?.textContent.toLocaleLowerCase('pt-BR')??'',names=Array.from(el.querySelectorAll('[name]'),e=>e.name).join(' ');
 if(el.matches('[data-compact-policy],.npc-publication-choices')||/destinat|restri|acesso|público/.test(title)&&!el.matches('.source-fields'))return 'access';
 if(/privad|segredo|valores|notas do mestre/.test(title)||/(?:^|\s)(?:privateNotes|private\.|privateReason|warning)/.test(names))return 'private';
 if(/páginas|capítulos|camadas|artigos|horários|efeitos estruturados/.test(title)||el.matches('.content-blocks'))return 'sections';
 if(/propriedades|fabricação|ensino|matéria|detalhes da edição|conteúdo e vínculos/.test(title))return el.querySelector('.content-blocks')?'sections':'details';
 if(el.matches('.source-fields,.inline-image-choice,.visual-map-editor')||/imagem|retrato|corte|aparência|modelo e assinatura/.test(title)||/(?:^|\s)(?:upload|asset|portrait|fileId|payload\.(?:fileId|alt|x|y|regionId|locationId|npcId|templateId))/.test(names))return 'images';
 if(type==='mail'&&/characters|npcs/.test(names))return 'access';
 return 'basic';
}
function revealTab(editor,key){
 const config=owners.get(editor);if(!config)return;if(!config.tabs.has(key))key=config.tabs.keys().next().value;
 editor.dataset.officeActive=key;active.set(config.key,key);
 for(const panel of editor.querySelectorAll('[data-office-panel]'))if(panel.closest('.office-tabbed-editor')===editor){panel.hidden=!panel.dataset.officePanel.split(' ').includes(key);if(!panel.hidden&&panel.matches('details'))panel.open=true;}
 const selected=editor.querySelector('[data-office-tab="'+key+'"]');
 for(const tab of editor.querySelectorAll('[data-office-tab]'))if(tab.closest('.office-tabbed-editor')===editor){const on=tab===selected;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;}
 config.grid.setAttribute('aria-labelledby',selected.id);
 const nav=selected.parentElement,n=nav.getBoundingClientRect(),t=selected.getBoundingClientRect();if(t.left<n.left)nav.scrollLeft-=n.left-t.left;else if(t.right>n.right)nav.scrollLeft+=t.right-n.right;
}
export function createOfficeEditors({root,state,toast,navigate,controllers,enhanceTools}){
 function controllerFor(form){if(form.dataset.npcForm)return controllers.npcOffice;if(form.dataset.itemForm)return controllers.itemOffice;if(form.dataset.workshopForm)return controllers.workshop;if(form.dataset.contentForm)return controllers.contentOffice;if(form.dataset.caseForm)return controllers.investigationsOffice;return controllers.mailOffice;}
 function enhance(scope=root,localState=state,adapter=null,embedded=false){
  if(localState.session?.role!=='MASTER'||localState.view)return;
  if(!embedded&&localState.page==='/portal/mestre/sapos'){enhancePackets(scope,localState);return;}
  const cohortSection=localState.page==='/portal/mestre/oficinas'?scope.querySelector('.workshop-cohorts'):null;if(cohortSection&&!cohortSection.closest('.workshop-editor')){const wrapper=document.createElement('div');wrapper.className='workshop-editor';cohortSection.before(wrapper);wrapper.append(cohortSection);}
  const main=scope.querySelector('[data-npc-form="profile"],[data-item-form="item"],[data-workshop-form="media"],[data-workshop-form="cohort"],[data-content-form="editor"],[data-mail-form="compose"],[data-case-form="moderate"]');
  if(!main||main.closest('.quest-tabbed-editor')||main.closest('.office-tabbed-editor')&&(!embedded||scope.contains(main.closest('.office-tabbed-editor')))){if(scope===root&&!main)state.officeDirty=false;return;}
  if(!embedded&&!localState.page.startsWith('/portal/mestre/oficinas/')&&localState.page!=='/portal/mestre/oficinas'&&!main.dataset.mailForm&&!main.dataset.caseForm)return;
  let grid=main.closest('.workshop-editor');if(!grid){grid=document.createElement('div');grid.className='workshop-editor';const area=document.createElement('div');main.before(grid);grid.append(area);area.append(main);if(main.dataset.mailForm){let next=grid.nextElementSibling;while(next&&!next.matches('footer')){const move=next;next=next.nextElementSibling;area.append(move);}}}
  const editor=document.createElement('section');editor.className='office-tabbed-editor';editor.dataset.officeKey=localState.page;editor.dataset.officeEmbedded=String(embedded);grid.before(editor);editor.append(grid);
  const type=main.dataset.npcForm?'npc':main.dataset.itemForm?'item':main.dataset.mailForm?'mail':'content',kind=localState.page.split('/conteudos/')[1]?.split('/')[0];
  const titles={basic:main.dataset.workshopForm==='cohort'?'Turmas':main.dataset.mailForm?'Carta':'Dados',images:'Imagens e vínculos',details:'Detalhes',private:'Reservado',sections:type==='npc'?'Informações':type==='item'?'Efeitos':kind==='newspapers'||['yearbooks','retrospectives'].includes(kind)?'Artigos':kind==='timetables'?'Horários':['books','lessons','rarities'].includes(kind)?'Páginas':'Camadas',access:'Acesso',operations:'Liberação',publication:'Publicação',preview:'Prévia',history:'Histórico'};
  const panels=[];
  const mark=(node,key)=>{node.dataset.officePanel=key;panels.push(node);};
  const fields=main.querySelector(':scope>.editor-fields')??main;
  for(const el of Array.from(fields.children)){
   if(el.matches('legend,input[type=hidden],.form-error'))continue;
   if(el.querySelector('button[type=submit]')&&el.matches('.group'))continue;
   if(el.matches('button')&&el.type==='submit')continue;
   mark(el,tabKey(el,type));
  }
  const fragments=grid.querySelector('.npc-fragments');if(fragments)mark(fragments,'sections');
  const entries=grid.querySelector('.story-entry-list');if(entries){titles.sections='Capítulos';mark(entries,'sections');}
  const sidebar=grid.querySelector('.editor-sidebar');if(sidebar)for(const section of Array.from(sidebar.children))mark(section,section.matches('.editor-history')||section.querySelector('.editor-history')?'history':section.matches('.editor-preview')?'preview':section.matches('.campaign-access')?'access':'publication');
  for(const node of Array.from(main.parentElement.children))if(node!==main&&!node.dataset.officePanel&&!node.matches('aside'))mark(node,main.dataset.workshopForm==='cohort'?'basic':node.querySelector('[data-content-form="operation"]')?'operations':node.querySelector('[data-mail-form="image"]')?'images':node.querySelector('#mail-preview')?'preview':node.querySelector('form')?'operations':'details');
  const npcActions=main.querySelector('.npc-main-actions');if(npcActions){mark(npcActions,'publication');}
  main.dataset.officePanel=Array.from(new Set(panels.filter(p=>main.contains(p)).map(p=>p.dataset.officePanel))).join(' ');
  const shared=document.createElement('div');shared.className='office-shared-confirm';for(const node of grid.querySelectorAll('#npc-confirm,#item-confirm,#workshop-confirm,[data-content-confirm],#campaign-confirm'))shared.append(node);editor.prepend(shared);
  const tabs=new Map();for(const key of Object.keys(titles))if(panels.some(p=>p.dataset.officePanel===key))tabs.set(key,titles[key]);
  const id='office-'+(++nextId),toolbar=document.createElement('div');toolbar.className='office-editor-toolbar';const nav=document.createElement('div');nav.className='editor-step-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Etapas da oficina');
  grid.id=id+'-panels';grid.setAttribute('role','tabpanel');grid.tabIndex=0;
  for(const [key,title]of tabs){const button=document.createElement('button');button.type='button';button.textContent=title;button.dataset.officeTab=key;button.id=id+'-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls',grid.id);nav.append(button);}
  toolbar.append(nav);if(!embedded){const save=document.createElement('div');save.className='office-save-actions';save.innerHTML='<button class="btn" type="button" data-office-save>Salvar</button><span class="subtle" data-office-save-status role="status" aria-live="polite">Alterações do registro</span>';toolbar.append(save);}editor.prepend(toolbar);
  const config={key:localState.page,requestedTab:active.get(localState.page),grid,tabs,adapter:adapter??controllerFor(main),localState,main,scope,embedded};owners.set(editor,config);
  for(const form of editor.querySelectorAll(writers)){if(form.closest('.office-tabbed-editor')!==editor)continue;form.dataset.officeForm='';if(form===main&&localState.dirty)form.dataset.officeForceDirty='true';baselines.set(form,signature(form));for(const button of form.querySelectorAll('button[type=submit],button:not([type])')){if(button.value)continue;button.hidden=true;button.dataset.officeOriginalSave='';button.dataset.actionExplained='true';button.closest('.action-with-caption')?.setAttribute('hidden','');}}
  revealTab(editor,active.get(config.key)??'basic');measure(editor);if(!embedded)enhanceTools?.(editor,config);return editor;
 }
 function enhancePackets(scope,localState){
  if(scope.querySelector('.office-tabbed-editor'))return;const heading=scope.querySelector('#main>h1');if(!heading)return;
  const editor=document.createElement('section');editor.className='office-tabbed-editor';editor.dataset.officeKey=localState.page;editor.dataset.officeEmbedded='false';const grid=document.createElement('div');grid.className='workshop-editor';grid.id='office-packets-'+(++nextId);grid.setAttribute('role','tabpanel');
  const tabs=new Map([['grant','Pacotes'],['trade','Trocas'],['cancel','Retiradas']]),shared=document.createElement('div');let node=heading.nextElementSibling;
  while(node&&!node.matches('footer')){const next=node.nextElementSibling,type=node.dataset.chocolateForm;if(type){node.dataset.officePanel=type;grid.append(node);}else if(node.querySelector('[data-chocolate-action="confirm"]'))shared.append(node);else{node.dataset.officePanel='grant';grid.append(node);}node=next;}
  const toolbar=document.createElement('div');toolbar.className='office-editor-toolbar';const nav=document.createElement('div');nav.className='editor-step-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Operações de Sapos');for(const[key,title]of tabs){const b=document.createElement('button');b.type='button';b.id=grid.id+'-'+key;b.dataset.officeTab=key;b.textContent=title;b.setAttribute('role','tab');b.setAttribute('aria-controls',grid.id);nav.append(b);}toolbar.append(nav);const actions=document.createElement('div');actions.className='office-save-actions';actions.innerHTML='<button class="btn" type="button" data-office-save hidden>Salvar</button><span class="subtle" data-office-save-status role="status" aria-live="polite"></span>';toolbar.append(actions);editor.append(toolbar,shared,grid);heading.after(editor);
  const config={key:localState.page,requestedTab:active.get(localState.page),grid,tabs,adapter:{},localState,main:document.createElement('div'),scope,embedded:false,operational:true};owners.set(editor,config);revealTab(editor,active.get(config.key)??'grant');measure(editor);enhanceTools?.(editor,config);
 }
 function scan(){for(const editor of root.querySelectorAll('.office-tabbed-editor')){for(const form of editor.querySelectorAll(writers)){if(form.closest('.office-tabbed-editor')!==editor||form.hasAttribute('data-office-form'))continue;form.dataset.officeForm='';baselines.set(form,signature(form));for(const button of form.querySelectorAll('button[type=submit],button:not([type])')){if(button.value)continue;button.hidden=true;button.dataset.officeOriginalSave='';button.dataset.actionExplained='true';}}}sync();}
 new window.MutationObserver(scan).observe(root,{childList:true,subtree:true});
 function measure(editor){editor.style.setProperty('--office-toolbar-top',(root.querySelector('.top')?.offsetHeight??0)+'px');}
 function editingForms(editor){return Array.from(editor.querySelectorAll('[data-office-form]')).filter(form=>writable(form)&&(changed(form)||form===owners.get(form.closest('.office-tabbed-editor'))?.main&&/\/(novo|nova)$/.test(owners.get(form.closest('.office-tabbed-editor')).key)));}
 function sync(){const editor=root.querySelector('.office-tabbed-editor:not([data-office-embedded="true"])');if(!editor||editor.dataset.officeKey!==state.page){state.officeDirty=false;return;}state.officeDirty=editingForms(editor).length>0;const status=editor.querySelector('[data-office-save-status]');if(status){const text=state.officeSaving?'Salvando…':state.officeDirty?'Alterações não salvas':status.textContent==='Alterações salvas'?'Alterações salvas':'Alterações do registro';if(status.textContent!==text)status.textContent=text;}const button=editor.querySelector('[data-office-save]');if(button){button.disabled=!!state.officeSaving;if(owners.get(editor)?.operational){button.hidden=!editor.querySelector('[data-office-form]');status.hidden=button.hidden;}}}
 function revealField(field){if(!field)return;let cursor=field;while(cursor){const editor=cursor.closest('.office-tabbed-editor');if(!editor)break;let panel=cursor;while(panel&&panel!==editor&&!panel.dataset.officePanel)panel=panel.parentElement;if(panel?.dataset.officePanel)revealTab(editor,panel.dataset.officePanel.split(' ')[0]);cursor=editor.parentElement;}for(let d=field.closest('details');d;d=d.parentElement.closest('details'))d.open=true;}
 function committed(form,saved){
  for(const input of form.querySelectorAll('input[type=file]'))input.value='';
  for(const select of form.querySelectorAll('select')){let value;if(select.name==='asset')value='';else if(select.name==='portraitFileId'||select.name==='fileId')value=saved.payload?.[select.name];else if(select.name.startsWith('payload.'))value=select.name.split('.').slice(1).reduce((p,k)=>p?.[k],saved.payload);if(value!==undefined&&value!==null&&typeof value!=='object'){if(!Array.from(select.options).some(o=>o.value===String(value)))select.add(new window.Option('Registro salvo',String(value)));select.value=String(value);}}
  delete form.dataset.officeForceDirty;baselines.set(form,signature(form));
 }
 async function save(){
  const editor=root.querySelector('.office-tabbed-editor:not([data-office-embedded="true"])');if(!editor||state.busy||state.officeSaving)return;const forms=editingForms(editor);for(const form of forms)if(!form.reportValidity())return;
  const config=owners.get(editor),path=state.page,csrf=state.session.csrf;state.officeSaving=true;sync();config.grid.inert=true;let href=null;
  try{
   for(const form of forms){const owner=owners.get(form.closest('.office-tabbed-editor'));const result=await owner.adapter.saveDrafts(owner.scope,[form]);if(state.page!==path||state.session?.csrf!==csrf)throw new Error('A página mudou durante o salvamento.');const saved=owner.adapter.savedRecord?.()??null;if(saved)committed(form,saved);else{delete form.dataset.officeForceDirty;baselines.set(form,signature(form));}if(owner===config)href=result;else{owner.localState.dirty=false;owner.savedHref=result;await owner.adapter.afterSave?.(result);}}
   state.officeDirty=false;state.dirty=false;for(const ownerEditor of editor.querySelectorAll('.office-tabbed-editor')){const owner=owners.get(ownerEditor);if(owner.savedHref)owner.localState.page=owner.savedHref;}
   if(href)await navigate(href,true);else{const status=editor.querySelector('[data-office-save-status]');if(status)status.textContent='Alterações salvas';}toast('Alterações salvas.');
  }catch(e){if(state.page===path&&state.session?.csrf===csrf){config.grid.inert=false;revealField(e.officeForm??forms.find(changed));e.officeForm?.querySelector('.form-error')?.focus();toast(e.message,true);}}
  finally{state.officeSaving=false;config.grid.inert=false;sync();}
 }
 root.addEventListener('click',e=>{const tab=e.target.closest('[data-office-tab]');if(tab){revealTab(tab.closest('.office-tabbed-editor'),tab.dataset.officeTab);return;}if(e.target.closest('[data-office-save]')){void save();return;}if(e.target.closest('[data-npc-open-preview]')){const editor=e.target.closest('.office-tabbed-editor');if(editor)revealTab(editor,'preview');}},true);
 root.addEventListener('submit',e=>{if(e.target.hasAttribute('data-office-form')&&!e.submitter?.value){e.preventDefault();e.stopImmediatePropagation();void save();}},true);
 root.addEventListener('invalid',e=>revealField(e.target),true);
 const dirty=e=>{if(e.target.closest('.office-tabbed-editor'))window.queueMicrotask(sync);};root.addEventListener('input',dirty);root.addEventListener('change',dirty);root.addEventListener('click',dirty);
 root.addEventListener('keydown',e=>{const editor=e.target.closest('.office-tabbed-editor');if(!editor)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void save();return;}const tab=e.target.closest('[data-office-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=Array.from(tab.parentElement.children),i=tabs.indexOf(tab),next=tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length];revealTab(editor,next.dataset.officeTab);next.focus();});
 window.addEventListener('resize',()=>{for(const editor of root.querySelectorAll('.office-tabbed-editor'))measure(editor);});
 function addPanel(editor,key,title,node){const config=owners.get(editor);if(!config||config.tabs.has(key))return;config.tabs.set(key,title);node.dataset.officePanel=key;config.grid.append(node);const nav=editor.querySelector(':scope>.office-editor-toolbar>.editor-step-tabs'),button=document.createElement('button');button.type='button';button.id=config.grid.id+'-'+key;button.dataset.officeTab=key;button.textContent=title;button.setAttribute('role','tab');button.setAttribute('aria-controls',config.grid.id);nav.append(button);revealTab(editor,config.tabs.has(config.requestedTab)?config.requestedTab:editor.dataset.officeActive);}
 return {enhance,sync,activate:revealTab,addPanel};
}
