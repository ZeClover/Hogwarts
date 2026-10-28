// Existing certificate, issue and permission APIs, embedded in the mission tab.
export function createQuestCertificates({api,state,esc,toast}){
 let host=null,key='',id='',generation=0,observer=null,phase='idle',context=null,quest=null,certificates=[],editing=null,pending=null,loadError='';
 const endpoint=()=>'/api/master/documents/quests/'+id+'/certificates';
 const named=value=>context.characters.find(c=>c.id===value)?.name??'Personagem';
 const field=(name,title,value='',extra='')=>`<label class="field">${title}<input name="${name}" value="${esc(value)}" ${extra}></label>`;
 const area=(name,title,value='',max=2000)=>`<label class="field">${title}<textarea name="${name}" maxlength="${max}" rows="3">${esc(value)}</textarea></label>`;
 const select=(name,title,options,value='')=>`<label class="field">${title}<select name="${name}" aria-label="${title}">${options.map(([id,text])=>`<option value="${esc(id)}" ${String(id)===String(value)?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
 const pdf=(href,title)=>`<a class="btn ghost small" href="${esc(href)}" download>${title}</a>`;
 function reset(){observer?.disconnect();observer=null;host=null;key='';id='';generation++;phase='idle';context=null;quest=null;certificates=[];editing=null;pending=null;state.certificateDirty=false;}
 function form(){
  if(!editing)return '';const p=editing.payload;
  return `<form class="media-editor-form inline-objective-editor" data-inline-certificate-form><h3 class="head3">${editing.id?'Editar certificado':'Novo certificado individual'}</h3>${editing.id?`<p>${esc(named(editing.characterId))}</p>`:select('characterId','Titular',quest.participants.map(m=>[m.character_id,named(m.character_id)]),editing.characterId)}${field('fullName','Nome completo no documento',p.fullName,'required maxlength="160"')}${field('title','Título do certificado',p.title,'required maxlength="180"')}${area('participation','Participação individual',p.participation)}${area('actions','Ações realizadas',p.actions,3000)}${select('result','Resultado',[['SUCCESS','Sucesso'],['PARTIAL_SUCCESS','Sucesso parcial'],['FAILURE','Fracasso']],p.result)}${area('closingText','Texto personalizado',p.closingText)}<details class="advanced-fields"><summary>Modelo e assinatura</summary>${select('templateId','Modelo reutilizável',[['','Sem modelo'],...context.templates.map(t=>[t.id,t.name])],p.templateId??'')}${select('layout','Modelo visual',[['PARCHMENT','Pergaminho'],['FORMAL','Formal']],p.layout)}${select('fileId','Ilustração ou brasão opcional',[['','Sem imagem'],...context.files.map((f,i)=>[f.id,'Imagem '+(i+1)])],p.fileId??'')}${field('signature','Assinatura',p.signature,'maxlength="200"')}${field('date','Data narrativa',p.date,'maxlength="100"')}</details><p class="form-error" role="alert" tabindex="-1"></p><button class="btn ghost" type="button" data-inline-certificate-action="cancel">Cancelar edição do certificado</button><p class="subtle">Use Salvar no topo. Emitir o PDF e liberar ao titular são ações separadas.</p></form>`;
 }
 function view(){
  if(phase==='idle'||phase==='loading')return '<p role="status">Carregando certificados…</p>';
  if(phase==='error')return `<p role="alert">${esc(loadError)}</p><button class="btn ghost" data-inline-certificate-action="reload">Tentar novamente</button>`;
  return `<div class="group"><button class="btn" type="button" data-inline-certificate-action="new">Novo certificado</button><button class="btn ghost small" data-inline-certificate-action="reload">Atualizar certificados</button></div><p data-certificate-error role="alert" tabindex="-1"></p>${form()}${pending?`<section class="inline-reward-confirm" aria-label="Confirmar certificado"><p>${esc(pending.message)}</p><div class="group"><button class="btn" data-inline-certificate-action="confirm">Confirmar operação</button><button class="btn ghost" data-inline-certificate-action="dismiss">Cancelar operação</button></div></section>`:''}<div class="inline-reward-list">${certificates.map(c=>`<article class="inline-reward-card" data-certificate-id="${esc(c.id)}"><h3 class="head3">${esc(c.payload.title)} · ${esc(named(c.characterId))}</h3><p class="subtle">Rascunho ${c.version}</p><div class="group"><button class="btn ghost" data-inline-certificate-action="edit" data-id="${esc(c.id)}">Editar certificado</button>${pdf(endpoint()+'/'+c.id+'/preview','Prévia do PDF')}<button class="btn" data-inline-certificate-action="issue" data-id="${esc(c.id)}">Revisar emissão</button></div><details class="advanced-fields"><summary>Histórico de edição</summary>${c.history.map(h=>`<p>Revisão ${h.version} · ${esc(h.payload.title)}</p><p class="biography">${esc(h.payload.actions)}</p>`).join('')}</details>${c.issues.map(i=>`<div class="campaign-preserved"><p>Documento ${i.version} · ${i.released?'liberado ao titular':'privado, ainda não liberado'}</p>${pdf(i.pdf,'PDF emitido')}<button class="btn ghost" data-inline-certificate-action="${i.released?'withdraw':'release'}" data-id="${esc(i.id)}">${i.released?'Retirar acesso ao PDF':'Liberar PDF ao titular'}</button></div>`).join('')}</article>`).join('')||'<p class="muted">Nenhum certificado preparado.</p>'}</div>`;
 }
 function render(){if(!host)return;host.querySelector('[data-inline-certificates-content]').innerHTML=view();host.dispatchEvent(new window.CustomEvent('quest-editor-enhance',{bubbles:true}));}
 function error(message,form){const el=form?.querySelector('.form-error')??host?.querySelector('[data-certificate-error]');if(el){el.textContent=message;el.focus();}}
 async function load(){
  if(!host||editing||phase==='loading')return;const token=generation;phase='loading';render();
  try{const [work,docs,q,rows]=await Promise.all([api('/api/master/workshop/context'),api('/api/master/documents/context'),api('/api/master/campaign/quests/'+id),api(endpoint())]);if(token!==generation)return;context={...work,...docs};quest=q;certificates=rows.items;phase='ready';render();}
  catch(e){if(token!==generation)return;phase='error';loadError='Não foi possível carregar os certificados: '+e.message;render();}
 }
 async function saveDraft(){
  const form=host?.querySelector('[data-inline-certificate-form]');if(!form)return;const token=generation,data=new FormData(form),payload=Object.fromEntries(['fullName','title','participation','actions','result','closingText','signature','date','layout'].map(k=>[k,String(data.get(k)??'')]));payload.fileId=data.get('fileId')||null;payload.templateId=data.get('templateId')||null;
  try{const saved=await api(endpoint()+(editing.id?'/'+editing.id:''),{method:editing.id?'PATCH':'POST',body:{...(editing.id?{version:editing.version}:{characterId:data.get('characterId')}),payload}});if(token!==generation)throw new Error('A missão mudou durante o salvamento.');certificates=certificates.filter(c=>c.id!==saved.id);certificates.push(saved);editing=null;state.certificateDirty=false;render();}
  catch(e){if(token===generation){error(e.message,form);e.questForm=form;}throw e;}
 }
 async function action(e){
  const button=e.target.closest('[data-inline-certificate-action]');if(!button||state.busy)return;const action=button.dataset.inlineCertificateAction,recordId=button.dataset.id,token=generation;
  try{
   if(action==='cancel'){editing=null;state.certificateDirty=false;render();return;}
   if(action==='dismiss'){pending=null;render();return;}
   if(editing)throw new Error('Salve pelo botão no topo ou cancele a edição do certificado.');
   if(action==='reload'){await load();return;}
   if(action==='new'||action==='edit'){
    const c=certificates.find(c=>c.id===recordId);pending=null;editing=c?window.structuredClone(c):{id:null,characterId:quest.participants[0]?.character_id??'',payload:{fullName:'',title:'Certificado de participação',participation:'',actions:'',result:'SUCCESS',closingText:'',signature:'',date:'',fileId:null,layout:'PARCHMENT',templateId:null}};state.certificateDirty=true;render();host.querySelector('[name=fullName]').focus();return;
   }
   if(['issue','release','withdraw'].includes(action)){
    const c=certificates.find(c=>c.id===recordId);pending=action==='issue'?{path:endpoint()+'/'+recordId+'/issue',body:{version:c.version},message:'Emitir este PDF individual? Ele permanecerá privado até liberar ao titular.'}:{path:'/api/master/documents/issues/'+recordId+'/'+action,body:{confirm:true},message:action==='release'?'Liberar este documento ao seu titular?':'Retirar o acesso ao documento, preservando o PDF emitido?'};render();host.querySelector('[data-inline-certificate-action=confirm]').focus();return;
   }
   if(action==='confirm'&&pending){state.busy=true;button.disabled=true;try{await api(pending.path,{method:'POST',body:pending.body});if(token!==generation)return;pending=null;await load();toast('Operação confirmada.');}finally{state.busy=false;button.disabled=false;}}
  }catch(e){if(token===generation)error(e.message);}
 }
 function mount(root){
  const placeholder=root.querySelector('[data-quest-certificates]');if(!placeholder||state.session?.role!=='MASTER'||state.view){reset();return;}const next=state.session.csrf+':'+placeholder.dataset.questId;
  if(next===key&&host){placeholder.replaceWith(host);host.hidden=root.querySelector('.quest-tabbed-editor')?.dataset.editorActive!=='rewards';return;}
  reset();key=next;id=placeholder.dataset.questId;host=placeholder;host.addEventListener('click',e=>void action(e));const dirty=e=>{if(e.target.closest('[data-inline-certificate-form]'))state.certificateDirty=true;};host.addEventListener('input',dirty);host.addEventListener('change',dirty);observer=new window.MutationObserver(()=>{if(!host.hidden)void load();});observer.observe(host,{attributes:true,attributeFilter:['hidden']});render();if(!host.hidden)void load();
 }
 return {mount,saveDraft};
}
