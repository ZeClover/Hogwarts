import {magicIcon} from '/magic-icons.js';

// Shares the existing reward plans/grants APIs; only this tab's DOM is updated.
export function createQuestRewards({api,state,esc,toast}){
 const kinds={NARRATIVE:'Prêmio narrativo',ITEM:'Item',MONEY:'Moedas',COLLECTION:'Coleção',MEMORY:'Recordação'};
 let host=null,key='',questId='',observer=null,generation=0,phase='idle',context=null,quest=null,plans=[],editing=null,pending=null,busy=false,loadError='';
 const endpoint=id=>'/api/master/documents/quests/'+id+'/rewards';
 const named=id=>context.characters.find(c=>c.id===id)?.name??'Personagem';
 const money=n=>`${Math.floor(n/493)} Galeões · ${Math.floor(n%493/29)} Sicles · ${n%29} Nuques`;
 const options=(items,value)=>items.map(([id,title])=>`<option value="${esc(id)}" ${String(id)===String(value)?'selected':''}>${esc(title)}</option>`).join('');
 const select=(name,title,items,value='')=>`<label class="field">${title}<select name="${name}" aria-label="${title}">${options(items,value)}</select></label>`;
 function reset(){observer?.disconnect();observer=null;host=null;key='';questId='';generation++;phase='idle';context=null;quest=null;plans=[];editing=null;pending=null;busy=false;state.rewardDirty=false;}
 function form(){
  const p=editing.payload,collections=context.collections;
  return `<form class="media-editor-form inline-reward-editor" data-inline-reward-form><h3 class="head3">${editing.id?'Editar recompensa':'Nova recompensa'}</h3>${select('kind','Tipo de recompensa',Object.entries(kinds),p.kind)}<label class="field">Título da recompensa<input name="title" value="${esc(p.title)}" maxlength="180" ${p.kind==='NARRATIVE'?'required':''}></label><label class="field">Descrição da recompensa<textarea name="text" aria-label="Descrição da recompensa" rows="3" maxlength="3000">${esc(p.text)}</textarea></label><div data-inline-prize="ITEM">${select('itemId','Item do catálogo',[['','Escolher item'],...context.items.map(i=>[i.id,i.name+(i.status==='PUBLISHED'?'':' (rascunho)')])],p.kind==='ITEM'?p.referenceId??'':'')}</div><div data-inline-prize="COLLECTION MEMORY">${select('referenceId','Coleção ou recordação',[['','Escolher registro'],...collections.map(c=>[c.id,c.name+(c.status==='PUBLISHED'?'':' (rascunho)')])],p.kind==='ITEM'?'':p.referenceId??'')}</div><div class="dual" data-inline-prize="MONEY">${[['galleons','Galeões',Math.floor(p.nuques/493),''],['sickles','Sicles',Math.floor(p.nuques%493/29),'max="16"'],['knuts','Nuques',p.nuques%29,'max="28"']].map(([name,title,value,extra])=>`<label class="field">${title}<input name="${name}" type="number" min="0" step="1" ${extra} value="${value}"></label>`).join('')}</div><fieldset class="recipient-field"><legend>Beneficiários</legend><div class="checks" data-inline-beneficiaries>${quest.participants.map(m=>`<label><input type="checkbox" name="characters" value="${esc(m.character_id)}" ${p.characters.includes(m.character_id)?'checked':''}>${esc(named(m.character_id))}${m.active?'':' (acesso retirado)'}</label>`).join('')||'<p class="subtle">Adicione os participantes na aba Participantes antes de salvar uma recompensa.</p>'}</div></fieldset><p class="form-error" role="alert"></p><div class="group"><button class="btn" type="submit">Salvar recompensa</button><button class="btn ghost" type="button" data-inline-reward-action="cancel-edit">Cancelar edição</button></div><p class="subtle">Salvar prepara a recompensa. A entrega é confirmada separadamente.</p></form>`;
 }
 function view(){
  if(phase==='idle'||phase==='loading')return '<p role="status">Carregando recompensas…</p>';
  if(phase==='error')return `<p role="alert">${esc(loadError)}</p><button class="btn ghost" data-inline-reward-action="reload">Tentar novamente</button>`;
  return `<div class="group"><button class="btn" type="button" data-inline-reward-action="new">${magicIcon('seal',18)}Adicionar recompensa</button><button class="btn ghost small" type="button" data-inline-reward-action="reload">Atualizar lista</button></div><div data-inline-reward-error role="alert"></div>${editing?form():''}${pending?`<section class="inline-reward-confirm" aria-label="Confirmar entrega"><h3 class="head3">Entregar ${esc(pending.payload.title)}?</h3><p>${pending.payload.characters.map(c=>esc(named(c))).join(', ')}</p>${pending.payload.kind==='MONEY'?`<p>${money(pending.payload.nuques)}</p>`:''}<p>A entrega será registrada uma única vez para esses personagens.</p><div class="group"><button class="btn" data-inline-reward-action="confirm">Confirmar entrega</button><button class="btn ghost" data-inline-reward-action="cancel-grant">Cancelar entrega</button></div></section>`:''}<div class="inline-reward-list">${plans.length?plans.map(p=>`<article class="inline-reward-card" data-inline-reward-id="${esc(p.id)}"><span class="badge">${p.granted?'Concedida':'Planejada'} · ${kinds[p.payload.kind]}</span><h3 class="head3" tabindex="-1">${esc(p.payload.title)}</h3>${p.payload.text?`<p class="biography">${esc(p.payload.text)}</p>`:''}<p class="subtle">${p.payload.characters.map(c=>esc(named(c))).join(', ')}</p>${p.payload.kind==='MONEY'?`<p>${money(p.payload.nuques)}</p>`:''}${p.granted?'<p class="subtle">Entrega registrada. O recibo e os benefícios concedidos ficam preservados.</p>':`<div class="group"><button class="btn ghost" data-inline-reward-action="edit" data-id="${esc(p.id)}">Editar recompensa</button><button class="btn" data-inline-reward-action="grant" data-id="${esc(p.id)}">Revisar entrega</button></div>`}</article>`).join(''):'<p class="muted">Nenhuma recompensa planejada para esta missão.</p>'}</div><details class="advanced-fields"><summary>Certificados antigos</summary><a class="btn ghost small" href="/portal/mestre/documentos/${esc(questId)}" data-go="/portal/mestre/documentos/${esc(questId)}">Consultar certificados preservados</a></details>`;
 }
 function updateKind(form){const kind=form.elements.kind.value;for(const group of form.querySelectorAll('[data-inline-prize]')){group.hidden=!group.dataset.inlinePrize.split(' ').includes(kind);for(const el of group.querySelectorAll('input,select'))el.disabled=group.hidden;}form.elements.title.required=kind==='NARRATIVE';const reference=form.elements.referenceId;if(reference)for(const option of reference.options){const record=context.collections.find(c=>c.id===option.value);option.hidden=kind==='MEMORY'&&record?.kind!=='memories'&&!!option.value;}if(kind==='MEMORY'&&reference?.selectedOptions[0]?.hidden)reference.value='';}
 function render(){if(!host)return;host.querySelector('[data-inline-rewards-content]').innerHTML=view();const form=host.querySelector('form');if(form)updateKind(form);}
 function error(message,form){const el=form?.querySelector('.form-error')??host?.querySelector('[data-inline-reward-error]');if(el){el.textContent=message;el.tabIndex=-1;el.focus();}}
 async function syncParticipants(){
  const token=generation,id=questId;
  try{const latest=await api('/api/master/campaign/quests/'+id);if(token!==generation||latest.version<quest.version)return;quest=latest;const checks=host.querySelector('[data-inline-beneficiaries]');if(!checks)return;const selected=Array.from(checks.querySelectorAll('input:checked'),el=>el.value);checks.innerHTML=quest.participants.map(m=>`<label><input type="checkbox" name="characters" value="${esc(m.character_id)}" ${selected.includes(m.character_id)?'checked':''}>${esc(named(m.character_id))}${m.active?'':' (acesso retirado)'}</label>`).join('')||'<p class="subtle">Adicione os participantes na aba Participantes antes de salvar uma recompensa.</p>';}
  catch{/* Keep the draft intact; the next tab activation retries. */}
 }
 async function load(){
  if(!host||busy||phase==='loading')return;
  if(editing){await syncParticipants();return;}
  if(state.rewardDirty)return;
  const token=generation,id=questId;phase='loading';render();
  try{const [work,docs,q,rewards]=await Promise.all([api('/api/master/workshop/context'),api('/api/master/documents/context'),api('/api/master/campaign/quests/'+id),api(endpoint(id))]);if(token!==generation)return;context={...work,...docs};quest=q;plans=rewards.items;phase='ready';loadError='';render();}
  catch(e){if(token!==generation)return;phase='error';loadError='Não foi possível carregar as recompensas: '+e.message;render();}
 }
 function payload(form){const d=new FormData(form),kind=String(d.get('kind')),referenceId=(kind==='ITEM'?d.get('itemId'):d.get('referenceId'))||null,characters=d.getAll('characters');if(!characters.length)throw new Error('Escolha pelo menos um beneficiário.');return {kind,referenceId,title:String(d.get('title')??'').trim()||(kind==='ITEM'?context.items:context.collections).find(r=>r.id===referenceId)?.name||(kind==='MONEY'?'Recompensa em moedas':''),text:String(d.get('text')??''),nuques:Number(d.get('galleons')||0)*493+Number(d.get('sickles')||0)*29+Number(d.get('knuts')||0),characters};}
 async function save(form){
  if(busy||state.busy)return;const token=generation,id=questId,button=form.querySelector('[type=submit]');
  try{const body=payload(form);busy=true;state.busy=true;button.disabled=true;button.setAttribute('aria-busy','true');const saved=await api(endpoint(id)+(editing.id?'/'+editing.id:''),{method:editing.id?'PATCH':'POST',body:{...(editing.id?{version:editing.version}:{}),payload:body}});if(token!==generation)return;plans=plans.filter(p=>p.id!==saved.id);plans.push(saved);editing=null;state.rewardDirty=false;render();host.querySelector(`[data-inline-reward-id="${saved.id}"] h3`)?.focus();toast('Recompensa salva.');}
  catch(e){if(token===generation)error(e.message,form);}
  finally{busy=false;state.busy=false;button.disabled=false;button.removeAttribute('aria-busy');}
 }
 async function action(event){
  const button=event.target.closest('[data-inline-reward-action]');if(!button||busy||state.busy)return;
  const action=button.dataset.inlineRewardAction,id=button.dataset.id,token=generation;
  try{
   if(action==='cancel-edit'){editing=null;state.rewardDirty=false;render();return;}
   if(action==='cancel-grant'){pending=null;render();return;}
   if(state.rewardDirty)throw new Error('Salve ou cancele a edição da recompensa antes de continuar.');
   if(action==='reload'){editing=null;pending=null;await load();return;}
   if(action==='new'||action==='edit'){const p=plans.find(p=>p.id===id);if(p?.granted)throw new Error('Essa recompensa já foi entregue.');pending=null;editing=p?window.structuredClone(p):{id:null,payload:{kind:'NARRATIVE',referenceId:null,title:'',text:'',nuques:0,characters:[]}};render();host.querySelector('[name=title]').focus();return;}
   if(action==='grant'){pending=window.structuredClone(plans.find(p=>p.id===id));if(pending.granted)return;render();host.querySelector('[data-inline-reward-action=confirm]').focus();return;}
   if(action==='confirm'&&pending){const token=generation,plan=pending,path=endpoint(questId)+'/'+plan.id+'/grant';busy=true;state.busy=true;button.disabled=true;try{const saved=await api(path,{method:'POST',body:{version:plan.version,characters:plan.payload.characters,confirm:true}});if(token!==generation)return;plans=plans.map(p=>p.id===saved.id?saved:p);pending=null;render();toast('Recompensa entregue.');}finally{busy=false;state.busy=false;button.disabled=false;}}
  }catch(e){if(token===generation)error(e.message);}
 }
 function mount(root){
  const placeholder=root.querySelector('[data-quest-rewards]');if(!placeholder||state.session?.role!=='MASTER'||state.view){reset();return;}
  const next=state.session.csrf+':'+placeholder.dataset.questId;
  if(next===key&&host){placeholder.replaceWith(host);host.hidden=root.querySelector('.quest-tabbed-editor')?.dataset.editorActive!=='rewards';if(!host.hidden&&editing)void syncParticipants();return;}
  reset();key=next;questId=placeholder.dataset.questId;host=placeholder;
  host.addEventListener('click',e=>void action(e));host.addEventListener('submit',e=>{if(e.target.matches('[data-inline-reward-form]')){e.preventDefault();void save(e.target);}});
  const dirty=e=>{if(!e.target.closest('[data-inline-reward-form]'))return;state.rewardDirty=true;if(e.target.name==='kind')updateKind(e.target.form);};host.addEventListener('input',dirty);host.addEventListener('change',dirty);
  observer=new window.MutationObserver(()=>{if(!host.hidden)void load();});observer.observe(host,{attributes:true,attributeFilter:['hidden']});render();if(!host.hidden)void load();
 }
 return {mount};
}
