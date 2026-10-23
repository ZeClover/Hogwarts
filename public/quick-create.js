import {defaultPolicy,policyFields} from './editorial-ui.js';

const itemPrivate=()=>({category:'',quality:'',materials:'',properties:'',magicDegree:'',activation:'',uses:'',frequency:'',craftingComplexity:'',availability:'',rarity:'',requirements:'',secretText:'',notes:'',referenceValueNuques:null,chosenPriceNuques:null,effects:[]});
const offices={quests:{title:'Nova missão',name:'Título',description:'O que acontece? (opcional)',api:'/api/master/campaign/quests',path:'/portal/mestre/oficinas/missoes'},stories:{title:'Nova história',name:'Título',description:'Resumo (opcional)',api:'/api/master/campaign/stories',path:'/portal/mestre/oficinas/historias'},items:{title:'Novo item',name:'Nome',description:'Descrição (opcional)',api:'/api/master/workshop/items',path:'/portal/mestre/oficinas/itens'},npcs:{title:'Novo NPC',name:'Nome público',description:'Descrição curta (opcional)',api:'/api/master/workshop/npcs',path:'/portal/mestre/oficinas/npcs'}};
export const contentQuickKinds=new Set(['books','lessons','shops','offers','regions','places','newspapers','boards','notices','years','events','timetables','yearbooks','retrospectives','chocolatecards','bestiary','rarities','memories','curiosities','chocolatepools','templates']);

export function contentDraftDefaults(kind,fields,currentYear){
  const payload=Object.fromEntries(fields.map(f=>[f.name,f.type==='reference'&&f.source==='years'?currentYear:f.type==='policy'?defaultPolicy('ALL'):f.type==='checkbox'?false:['number','reference','image'].includes(f.type)?null:f.type==='blocks'?[]:f.type==='select'?f.options[0]:'']));
  // A new marker is reserved until the Mestre deliberately opens its access.
  if(kind==='places')payload.isSecret=true;
  return payload;
}

export function quickContentForm(kind,schema,{esc,label,button,path}){
  const title=schema.fields.find(f=>f.name==='title'),description=schema.fields.find(f=>f.name==='description');
  return `${label('OFICINA GERAL',schema.label)}<div class="workshop-title"><h1 class="display">Criar ${esc(schema.singular)}</h1>${button('Voltar à lista',path)}</div><section class="card quick-create"><p class="muted">Comece pelo essencial. O rascunho fica privado; complete o conteúdo e revise a publicação depois.</p>${kind==='newspapers'?'<p class="subtle">A manchete, a numeração e os artigos podem ser escritos depois. Nada será publicado ao criar.</p>':kind==='offers'?'<p class="subtle">Item, loja e preço serão necessários para publicar a oferta. Salvar não cria estoque nem expõe um catálogo.</p>':kind==='places'||kind==='regions'?'<p class="subtle">Criar não abre acesso à região ou ao local.</p>':''}<form data-content-form="quick"><label class="field" for="quick-name">${esc(title.label)}<input id="quick-name" name="name" ${title.draftOptional?'':'required'} maxlength="${title.max??180}" placeholder="${esc(title.label)}"></label>${description?`<label class="field" for="quick-description">${esc(description.label)} (opcional)<textarea id="quick-description" name="description" rows="3" maxlength="${description.max??4000}"></textarea></label>`:''}<p class="form-error" role="alert" tabindex="-1"></p><button class="btn" type="submit">Criar rascunho</button></form><button class="btn ghost small" type="button" data-quick-advanced>Usar criação avançada</button></section>`;
}

// Defaults describe an empty draft, never an invented price, stock, effect or
// reward. Existing authenticated APIs validate and persist the resulting body.
export function quickCreateRequest(kind,data,context){
  const office=offices[kind];if(!office)throw new Error('Oficina não encontrada.');
  const name=String(data.get('name')??'').trim(),description=String(data.get('description')??'');
  let body;
  if(kind==='quests'||kind==='stories')body={payload:{title:name,summary:description,kind:kind==='quests'?String(data.get('kind')||'Side-Quest'):'História individual',academicYear:context.currentAcademicYear,fileId:null,alt:'',npcId:null,locationId:null,hook:''},policy:defaultPolicy(kind==='stories'?'ALL':'SELECTED'),private:{synopsis:'',importance:'',releaseConditions:'',notes:''},...(kind==='stories'?{protagonistId:data.get('protagonistId')}:{})};
  if(kind==='items')body={payload:{name,description,fileId:null,alt:'',crop:{x:0,y:0,width:100,height:100}},policy:defaultPolicy(),private:{...itemPrivate(),category:String(data.get('category')??'')}};
  if(kind==='npcs')body={payload:{name,description,role:'OTHER',houseId:null,locationId:null,relatedLocations:[],portraitFileId:null,portraitAlt:''},policy:defaultPolicy(),privateNotes:''};
  return {api:office.api,path:office.path,body};
}

export function quickCreateForm(kind,context,{esc,label,button}){
  const o=offices[kind];
  return `${label('OFICINA GERAL')}<div class="workshop-title"><h1 class="display">${o.title}</h1>${button('Voltar à lista',o.path)}</div><section class="card quick-create"><p class="muted">Comece pelo essencial. O rascunho fica privado; imagens, vínculos e publicação vêm depois.</p><form data-quick-create="${kind}"><label class="field" for="quick-name">${o.name}<input id="quick-name" name="name" required maxlength="120" placeholder="${kind==='npcs'?'Nome do personagem':kind==='items'?'Nome do objeto':kind==='quests'?'Título da missão':'Título da história'}"></label>${kind==='stories'?`<label class="field" for="quick-protagonist">Protagonista<select id="quick-protagonist" name="protagonistId" aria-label="Protagonista" required><option value="">Escolher personagem</option>${context.characters.map(ch=>`<option value="${esc(ch.id)}">${esc(ch.name)}</option>`).join('')}</select></label>`:''}<label class="field" for="quick-description">${o.description}<textarea id="quick-description" name="description" rows="3" maxlength="3000"></textarea></label>${['npcs','items'].includes(kind)?'<label class="field">Foto (opcional)<input name="quickPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label>':''}${kind==='quests'?'<label class="field" for="quick-kind">Tipo<select id="quick-kind" name="kind" aria-label="Tipo"><option>Side-Quest</option><option>Missão de grupo</option></select></label>':kind==='items'?'<label class="field" for="quick-category">Categoria (opcional)<input id="quick-category" name="category" maxlength="200" placeholder="Ex.: poção, instrumento, vestuário"></label>':''}<p class="form-error" role="alert" tabindex="-1"></p><button class="btn" type="submit">Criar rascunho</button></form><button class="btn ghost small" type="button" data-quick-advanced>Usar criação avançada</button></section>`;
}

export function compactPolicyFields(context,policy,esc,namespace){
  return `<details class="advanced-fields compact-policy" data-compact-policy><summary>Para quem? <span class="subtle">${policy.audience==='ALL'?'Todos, respeitando restrições':'Seleção específica'}</span></summary>${policyFields(context,policy,esc,namespace)}</details>`;
}

export function attachQuickCreate(root,{api,state,navigate,render,toast}){
  root.addEventListener('click',e=>{if(!e.target.closest('[data-quick-advanced]')||state.busy)return;const quick=root.querySelector('[data-quick-create],[data-content-form="quick"]'),values=new FormData(quick),photos=quick.querySelector('[name=quickPhoto]')?.files;state.fullCreate=true;render();const form=root.querySelector('[data-campaign-form="profile"],[data-item-form="item"],[data-npc-form="profile"],[data-content-form="editor"]');for(const [from,to] of [['name','name'],['name','title'],['name','payload.title'],['description','payload.description'],['description','description'],['description','summary'],['kind','kind'],['category','category'],['protagonistId','protagonistId']]){const field=form?.querySelector(`[name="${to}"]`);if(field&&values.has(from))field.value=String(values.get(from));}if(photos?.length&&form?.querySelector('[name=upload]'))form.querySelector('[name=upload]').files=photos;form?.querySelector('input')?.focus();});
  root.addEventListener('submit',async e=>{
    const form=e.target,kind=form.dataset.quickCreate;if(!kind)return;e.preventDefault();if(state.busy)return;
    const error=form.querySelector('.form-error'),submit=form.querySelector('[type=submit]');
    if(state.session?.role!=='MASTER'||state.view){error.textContent='Acesso reservado ao Mestre.';return;}
    state.busy=true;submit.disabled=true;submit.setAttribute('aria-busy','true');error.textContent='';
    const sourcePage=state.page;
    try{const values=new FormData(form),request=quickCreateRequest(kind,values,{currentAcademicYear:state.portal.calendar.academicYear});
      const photo=values.get('quickPhoto');if(photo?.size){if(photo.size>2*1024*1024)throw new Error('Escolha uma foto de até 2 MB.');const file=await api('/api/master/workshop/files',{method:'POST',body:photo,raw:true});if(kind==='npcs'){request.body.payload.portraitFileId=file.id;request.body.payload.portraitAlt=request.body.payload.name;}else{request.body.payload.fileId=file.id;request.body.payload.alt=request.body.payload.name;}}

      const saved=await api(request.api,{method:'POST',body:request.body});if(state.page===sourcePage){state.dirty=false;await navigate(request.path+'/'+saved.id,true);}toast('Rascunho privado criado. Você pode completar os detalhes quando quiser.');
    }catch(err){error.textContent=err.message;error.focus();}finally{state.busy=false;submit.disabled=false;submit.removeAttribute('aria-busy');}
  });
}
