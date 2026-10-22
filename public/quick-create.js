import {defaultPolicy,policyFields} from './editorial-ui.js';

const itemPrivate=()=>({category:'',quality:'',materials:'',properties:'',magicDegree:'',activation:'',uses:'',frequency:'',craftingComplexity:'',availability:'',rarity:'',requirements:'',secretText:'',notes:'',referenceValueNuques:null,chosenPriceNuques:null,effects:[]});
const offices={quests:{title:'Nova missão',name:'Título',description:'O que acontece? (opcional)',api:'/api/master/campaign/quests',path:'/portal/mestre/oficinas/missoes'},stories:{title:'Nova história',name:'Título',description:'Resumo (opcional)',api:'/api/master/campaign/stories',path:'/portal/mestre/oficinas/historias'},items:{title:'Novo item',name:'Nome',description:'Descrição (opcional)',api:'/api/master/workshop/items',path:'/portal/mestre/oficinas/itens'},npcs:{title:'Novo NPC',name:'Nome público',description:'Descrição curta (opcional)',api:'/api/master/workshop/npcs',path:'/portal/mestre/oficinas/npcs'}};

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
  return `${label('OFICINA GERAL')}<div class="workshop-title"><h1 class="display">${o.title}</h1>${button('Voltar à lista',o.path)}</div><section class="card quick-create"><p class="muted">Comece pelo essencial. O rascunho fica privado; imagens, vínculos e publicação vêm depois.</p><form data-quick-create="${kind}"><label class="field" for="quick-name">${o.name}<input id="quick-name" name="name" required maxlength="120" placeholder="${kind==='npcs'?'Nome do personagem':kind==='items'?'Nome do objeto':kind==='quests'?'Título da missão':'Título da história'}"></label>${kind==='stories'?`<label class="field" for="quick-protagonist">Protagonista<select id="quick-protagonist" name="protagonistId" required><option value="">Escolher personagem</option>${context.characters.map(ch=>`<option value="${esc(ch.id)}">${esc(ch.name)}</option>`).join('')}</select></label>`:''}<label class="field" for="quick-description">${o.description}<textarea id="quick-description" name="description" rows="3" maxlength="3000"></textarea></label>${kind==='quests'?'<label class="field" for="quick-kind">Tipo<select id="quick-kind" name="kind"><option>Side-Quest</option><option>Missão de grupo</option></select></label>':kind==='items'?'<label class="field" for="quick-category">Categoria (opcional)<input id="quick-category" name="category" maxlength="200" placeholder="Ex.: poção, instrumento, vestuário"></label>':''}<p class="form-error" role="alert" tabindex="-1"></p><button class="btn" type="submit">Criar rascunho</button></form><button class="btn ghost small" type="button" data-quick-advanced>Usar criação avançada</button></section>`;
}

export function compactPolicyFields(context,policy,esc,namespace){
  return `<details class="advanced-fields compact-policy" data-compact-policy><summary>Para quem? <span class="subtle">${policy.audience==='ALL'?'Todos, respeitando restrições':'Seleção específica'}</span></summary>${policyFields(context,policy,esc,namespace)}</details>`;
}

export function attachQuickCreate(root,{api,state,navigate,render,toast}){
  root.addEventListener('click',e=>{if(!e.target.closest('[data-quick-advanced]')||state.busy)return;const values=new FormData(root.querySelector('[data-quick-create]'));state.fullCreate=true;render();const form=root.querySelector('[data-campaign-form="profile"],[data-item-form="item"],[data-npc-form="profile"]');for(const [from,to] of [['name','name'],['name','title'],['description','description'],['description','summary'],['kind','kind'],['category','category'],['protagonistId','protagonistId']]){const field=form?.querySelector(`[name="${to}"]`);if(field&&values.has(from))field.value=String(values.get(from));}form?.querySelector('input')?.focus();});
  root.addEventListener('submit',async e=>{
    const form=e.target,kind=form.dataset.quickCreate;if(!kind)return;e.preventDefault();if(state.busy)return;
    const error=form.querySelector('.form-error'),submit=form.querySelector('[type=submit]');
    if(state.session?.role!=='MASTER'||state.view){error.textContent='Acesso reservado ao Mestre.';return;}
    state.busy=true;submit.disabled=true;submit.setAttribute('aria-busy','true');error.textContent='';
    try{const request=quickCreateRequest(kind,new FormData(form),{currentAcademicYear:state.portal.calendar.academicYear});
      const saved=await api(request.api,{method:'POST',body:request.body});state.dirty=false;await navigate(request.path+'/'+saved.id,true);toast('Rascunho privado criado. Você pode completar os detalhes quando quiser.');
    }catch(err){error.textContent=err.message;error.focus();}finally{state.busy=false;submit.disabled=false;submit.removeAttribute('aria-busy');}
  });
}
