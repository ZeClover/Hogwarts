import {quickCreateForm,compactPolicyFields} from '/quick-create.js';
import { defaultPolicy, policyFields, readPolicy } from '/editorial-ui.js';
const base='/portal/mestre/oficinas/npcs',publicBase='/portal/personagens';
const roles={PROFESSOR:'Professor',MERCHANT:'Comerciante',STUDENT:'Estudante',OTHER:'Outro papel'};
const statuses={DRAFT:'Rascunho',PREPARED:'Preparado',PUBLISHED:'Publicado',ARCHIVED:'Arquivado'};
const actions={CREATED:'Criação',SAVED:'Perfil salvo',PREPARE:'Preparado',PUBLISH:'Publicado',ARCHIVE:'Arquivado',RESTORE:'Restaurado',DUPLICATED:'Cópia criada',FRAGMENT_SAVED:'Informação salva',FRAGMENT_REMOVED:'Informação removida',FRAGMENT_REVEALED:'Informação revelada',FRAGMENT_REVOKED:'Revelação revogada'};
export function createNPCOffice({api,esc,ico,label,empty,button,state,render,navigate,toast}){
  let context=null,current=null,history=[],list=null,error=null;
  let filters={q:'',role:'',status:'',page:1};
  const dirtyForms=new Set();
  const admin=()=>state.session?.role==='MASTER'&&!state.view;
  const handles=path=>path===base||path.startsWith(base+'/')||path===publicBase||path.startsWith(publicBase+'/');
  const query=()=>new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''));
  const field=(name,title,value='',extra='',ns='npc')=>`<div class="field"><label for="${ns}-${name}">${title}</label><input id="${ns}-${name}" name="${name}" value="${esc(value)}" ${extra}></div>`;
  const select=(name,title,options,value='',ns='npc')=>`<div class="field"><label for="${ns}-${name}">${title}</label><select id="${ns}-${name}" name="${name}">${options.map(([id,title])=>`<option value="${esc(id)}" ${String(value)===String(id)?'selected':''}>${esc(title)}</option>`).join('')}</select></div>`;
  const area=(name,title,value='',max=3000,ns='npc')=>`<div class="field"><label for="${ns}-${name}">${title}</label><textarea id="${ns}-${name}" name="${name}" maxlength="${max}" rows="4">${esc(value)}</textarea></div>`;
  const checkList=(name,title,options,selected=[])=>`<fieldset class="recipient-field"><legend>${title}</legend><div class="checks">${options.map(([id,title])=>`<label><input type="checkbox" name="${name}" value="${esc(id)}" ${selected.includes(id)?'checked':''}>${esc(title)}</label>`).join('')}</div></fieldset>`;
  const formError='<p class="form-error" role="alert" tabindex="-1"></p>';
  async function load(){
    if(!handles(state.page))return;error=null;dirtyForms.clear();
    const management=state.page.startsWith(base);if(management&&!admin()){error='Acesso reservado ao Mestre.';return;}
    try{
      if(management)context=await api('/api/master/workshop/context',{preview:false});
      if(state.page===base||state.page===publicBase)list=await api(`${management?'/api/master/workshop/npcs':'/api/workshop/npcs'}?${query()}`);
      else{
        const id=state.page.split('/').pop();
        if(management&&id==='novo'){current=null;history=[];return;}
        current=await api(`${management?'/api/master/workshop/npcs/':'/api/workshop/npcs/'}${id}`);
        if(management)history=(await api(`/api/master/workshop/npcs/${id}/history`)).items;
      }
    }catch(e){error=e.message;}
  }
  function card(n,management=false){
    const p=management?n.payload:n,target=management?base+'/'+n.id:publicBase+'/'+n.id;
    return `<article class="card npc-card"><a href="${target}" data-go="${target}">${p.portrait?`<img class="npc-card-portrait" src="${esc(p.portrait)}${state.view?'&view_as='+encodeURIComponent(state.view):''}" alt="${esc(p.portraitAlt)}">`:management&&n.portraitFile?`<img class="npc-card-portrait" src="${esc(n.portraitFile.image)}" alt="${esc(p.portraitAlt||'Retrato em preparação')}">`:`<div class="npc-ornament">${ico('quill',35)}</div>`}<div class="media-record-body">${management?`<span class="badge">${statuses[n.status]}</span>`:''}<h2>${esc(p.name)}</h2><p class="subtle">${roles[p.role]}</p>${management&&n.hasUnpublishedChanges?'<p class="draft-warning">Há alterações não publicadas.</p>':''}</div></a></article>`;
  }
  function personView(n,preview=false){
    return `<article class="card npc-profile"><div class="npc-profile-heading">${n.portrait?`<img class="npc-portrait" src="${esc(n.portrait)}${!preview&&state.view?'&view_as='+encodeURIComponent(state.view):''}" alt="${esc(n.portraitAlt)}">`:`<div class="npc-ornament">${ico('user',35)}</div>`}<div><span class="eyebrow">${roles[n.role]}${n.house?' · '+esc(n.house):''}</span><h2 class="head2">${esc(n.name)}</h2></div></div><p class="biography">${esc(n.description)}</p>${n.locations.length?`<h3 class="head3">Lugares conhecidos</h3><div class="npc-known-links">${n.locations.map(l=>preview?`<span>${esc(l.title)}</span>`:`<a class="btn ghost small" href="/portal/local/${esc(l.id)}" data-go="/portal/local/${esc(l.id)}">${esc(l.title)}</a>`).join('')}</div>`:''}${n.fragments.map(f=>`<section class="known-fragment"><h3 class="head3">${esc(f.title)}</h3><p class="biography">${esc(f.text)}</p></section>`).join('')}</article>`;
  }
  function fragmentEditor(fragment=null){
    const id=fragment?.id??'new',ns='fragment-'+id,archived=current.status==='ARCHIVED';
    const canReveal=!!fragment&&current.status==='PUBLISHED'&&!current.hasUnpublishedChanges&&current.publishedFragmentIds.includes(fragment.id);
    return `<details class="card npc-fragment"><summary>${fragment?esc(fragment.title):'Nova informação progressiva'}</summary><div class="npc-fragment-content"><form data-npc-form="fragment" data-id="${fragment?esc(fragment.id):''}"><fieldset class="editor-fields" ${archived?'disabled':''}><legend class="sr-only">Editar informação</legend>${field('title','Título da informação',fragment?.title??'','required maxlength="120"',ns)}${area('text','Texto a revelar',fragment?.text??'',4000,ns)}<details class="advanced-fields"><summary>Destinatários desta informação</summary>${policyFields(context,fragment?.policy??defaultPolicy('ALL'),esc,ns)}</details><p class="subtle">Salvar e publicar preparam o conteúdo. A revelação aos personagens é confirmada separadamente.</p>${formError}<div class="group"><button class="btn ghost" type="submit">${fragment?'Salvar informação':'Adicionar informação'}</button>${fragment?`<button class="btn ghost" type="button" data-npc-action="ask-remove" data-fragment="${esc(fragment.id)}">Remover do rascunho</button>`:''}</div></fieldset></form>${fragment?`<form class="npc-reveal-form" data-npc-form="reveal" data-id="${esc(fragment.id)}"><fieldset class="editor-fields" ${canReveal?'':'disabled'}><legend class="head3">Ações da informação publicada</legend>${checkList('recipients','Destinatários da ação',context.characters.map(c=>[c.id,c.name]))}<p class="subtle">${canReveal?'Revelar usa o texto publicado. Revogar retira a informação dos personagens selecionados.':'Salve e publique o NPC para habilitar estas ações.'}</p>${formError}<div class="group"><button class="btn" type="submit" value="reveal">Revelar aos selecionados</button><button class="btn ghost" type="submit" value="revoke">Revogar dos selecionados</button></div><p class="subtle">Conhecimento ativo: ${esc(current.reveals.filter(r=>r.fragmentId===fragment.id&&r.active).map(r=>context.characters.find(c=>c.id===r.characterId)?.name??'Personagem').join(', ')||'nenhum personagem')}</p></fieldset></form>`:''}</div></details>`;
  }
  function visibilitySummary(policy){
    if(policy.audience==='SELECTED'&&!policy.characters.length&&!policy.groups.length)return 'Somente o Mestre';
    const names=policy.characters.map(id=>context.characters.find(ch=>ch.id===id)?.name).filter(Boolean);
    return policy.audience==='ALL'?'Todos os personagens autorizados, respeitando restrições':[names.join(', '),policy.groups.length?'Grupos selecionados':''].filter(Boolean).join(' · ')+' — respeitando restrições';
  }
  function publicationChoices(policy){return `<section class="npc-publication-choices"><h2 class="head3">Quem pode ver o perfil?</h2><p data-npc-access-summary>${esc(visibilitySummary(policy))}</p><div class="group"><button type="button" class="btn ghost" data-npc-visibility="master">Somente o Mestre</button><button type="button" class="btn ghost" data-npc-visibility="characters">Escolher personagens</button><button type="button" class="btn ghost" data-npc-visibility="all">Todos os autorizados</button></div><p class="subtle">Guardar como rascunho mantém o perfil privado. Para publicar apenas no seu acervo, escolha “Somente o Mestre”, salve e publique. Para liberar a alunos, escolha os personagens, salve e publique. Informações progressivas continuam exigindo revelação manual.</p></section>`;}
  function editor(){
    if(!current&&!state.fullCreate)return quickCreateForm('npcs',context,{esc,label,button});
    const c=current,p=c?.payload??{name:'',description:'',role:'OTHER',houseId:null,locationId:null,relatedLocations:[],portraitFileId:null,portraitAlt:'',fragments:[]},archived=c?.status==='ARCHIVED';
    return `${label('OFICINA GERAL','NPCs')}<div class="workshop-title"><div><h1 class="display">${c?'Editar NPC':'Novo NPC'}</h1>${c?`<span class="badge">${statuses[c.status]} · revisão ${c.version}</span>${c.hasUnpublishedChanges?'<p class="draft-warning">Há alterações ainda não publicadas.</p>':''}`:''}</div>${button('Lista de NPCs',base,'user')}</div><div class="workshop-editor"><div><form class="card media-editor-form" data-npc-form="profile"><fieldset class="editor-fields" ${archived?'disabled':''}><legend class="sr-only">Perfil do NPC</legend>${field('name','Nome público',p.name,'required maxlength="120"')}${area('description','Descrição pública',p.description)}${select('role','Papel público',Object.entries(roles),p.role)}<details class="advanced-fields"><summary>Retrato e vínculos públicos</summary>${select('houseId','Casa ou vínculo',[['','Não informar'],...context.houses.map(h=>[h.id,h.name])],p.houseId??'')}${select('primaryLocation','Local principal',[['','Não informar'],...context.locations.map(l=>[l.id,l.title])],p.locationId??'')}${checkList('relatedLocations','Outros locais associados',context.locations.map(l=>[l.id,l.title]),p.relatedLocations)}<p class="subtle">Cada local mantém suas permissões. Associar um NPC não revela locais fechados nem torna o NPC conhecido automaticamente.</p><div class="field"><label for="npc-upload">Enviar retrato opcional</label><input id="npc-upload" type="file" name="upload" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG ou WebP · até 2 MB.</small></div>${select('asset','Ou escolher uma imagem aprovada',[['','Não selecionar'],...context.approvedAssets.map(a=>[a,a.replaceAll('_',' ').replace('.webp','')])])}${select('portraitFileId','Arquivo do retrato',[['','Sem retrato'],...context.files.map((f,i)=>[f.id,`Imagem ${i+1} · ${f.width} × ${f.height}`])],p.portraitFileId??'')}${field('portraitAlt','Texto alternativo do retrato',p.portraitAlt,'maxlength="300"')}${c?.portraitFile?`<img class="source-preview" src="${esc(c.portraitFile.image)}" alt="Retrato selecionado">${c.portraitFile.originalAlreadyPublic?'<p class="subtle">Esta imagem de ambientação já é pública na ambientação do portal.</p>':''}`:''}<p class="subtle">Publicar o NPC permite consultar seu retrato pelo perfil, segundo o público definido aqui.</p></details><details class="advanced-fields"><summary>Segredos do Mestre</summary>${area('privateNotes','Notas exclusivas do Mestre',c?.privateNotes??'',5000)}</details>${publicationChoices(c?.policy??defaultPolicy())}${compactPolicyFields(context,c?.policy??defaultPolicy(),esc,'npc-access')}${formError}<div class="group npc-main-actions"><button class="btn" type="submit">${c?'Salvar rascunho do NPC':'Criar rascunho do NPC'}</button>${c&&!archived?`<button class="btn" type="button" data-npc-action="ask-publish">${c.publishedRevision?'Atualizar perfil publicado':'Publicar perfil'}</button><button class="btn ghost" type="button" data-npc-open-preview>Ver como jogador</button>`:''}</div></fieldset></form>${c?`<section class="npc-fragments"><div class="rtitle"><h2>Informações progressivas</h2></div>${p.fragments.map(f=>fragmentEditor(f)).join('')}${!archived?fragmentEditor():''}</section>`:''}</div><aside class="editor-sidebar">${c?`<section class="card editor-actions"><h2 class="head3">Ações do NPC</h2><div class="editor-action-buttons">${!archived?`<details class="advanced-fields"><summary>Verificação opcional</summary><button class="btn ghost" data-npc-action="prepare" ${c.status==='PUBLISHED'?'disabled':''}>Preparar NPC</button></details><button class="btn ghost" data-npc-action="ask-archive">Arquivar NPC</button>`:'<button class="btn" data-npc-action="restore">Restaurar sem publicar</button>'}<button class="btn ghost" data-npc-action="duplicate">Duplicar como rascunho</button></div><div id="npc-confirm" aria-live="polite"></div><p class="subtle">Salvar uma alteração não substitui a revisão que os alunos já veem. Use Atualizar perfil publicado quando estiver pronta.</p></section><section class="card editor-preview npc-master-proof"><h2 class="head3">Prévia do Mestre</h2><p class="subtle">Sua apresentação em edição. A visão autorizada de cada aluno é conferida separadamente abaixo.</p>${c.portraitFile?`<img class="npc-portrait" src="${esc(c.portraitFile.image)}" alt="${esc(p.portraitAlt||p.name)}">`:`<div class="npc-ornament">${ico('user',35)}</div>`}<h3 class="head3" data-npc-proof-name>${esc(p.name)}</h3><p class="subtle" data-npc-proof-role>${roles[p.role]}</p><p class="biography" data-npc-proof-description>${esc(p.description)}</p></section><section class="card editor-preview" id="npc-player-preview"><h2 class="head3">Ver como jogador</h2><p class="subtle">Escolha um estudante e a revisão salva. A prévia respeita exatamente as permissões dele, sem revelar ou registrar leitura.</p><form data-npc-form="preview">${select('previewCharacter','Personagem da prévia',context.characters.map(ch=>[ch.id,ch.name]))}${select('previewSource','Revisão da prévia',[['draft','Rascunho salvo'],...(c.publishedRevision?[['published','Revisão publicada']]:[])])}${formError}<button class="btn ghost" type="submit">Conferir NPC</button></form><div id="npc-preview-result"></div></section><section class="card editor-history"><h2 class="head3">Histórico do NPC</h2><p class="subtle">Últimas 20 revisões · somente Mestre.</p>${history.map(h=>`<details><summary>Revisão ${h.version} · ${actions[h.action]??esc(h.action)}</summary><p class="subtle">${esc(context.authors.find(a=>a.id===h.actorId)?.email??'Mestre')} · ${new Date(h.createdAt*1000).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p><dl><dt>Nome</dt><dd>${esc(h.snapshot.payload.name)}</dd><dt>Estado</dt><dd>${statuses[h.snapshot.status]}</dd><dt>Descrição pública</dt><dd>${esc(h.snapshot.payload.description)}</dd><dt>Notas exclusivas do Mestre</dt><dd>${esc(h.snapshot.privateNotes)}</dd><dt>Informações preparadas</dt><dd>${h.snapshot.payload.fragments.map(f=>`<strong>${esc(f.title)}</strong><p>${esc(f.text)}</p>`).join('')||'Nenhuma'}</dd><dt>Revelações ativas</dt><dd>${h.snapshot.reveals.filter(r=>r.active).map(r=>esc(context.characters.find(ch=>ch.id===r.characterId)?.name??'Personagem')+' · '+esc(r.content.title)).join('<br>')||'Nenhuma'}</dd></dl></details>`).join('')}</section>`:empty('Salve o primeiro rascunho para preparar informações e conferir a prévia.')}</aside></div>`;
  }
  function page(){
    if(error)return `${label('ARQUIVOS MÁGICOS')}${empty(error)}${button('Voltar ao início','/portal/inicio')}`;
    if(state.page===base||state.page===publicBase){
      const management=state.page===base;
      return `${label(management?'OFICINA GERAL':'SEUS REGISTROS')}<div class="workshop-title"><div><h1 class="display">${management?'NPCs':'Pessoas conhecidas'}</h1><p class="muted">${management?'Prepare perfis e escolha o que cada personagem poderá conhecer.':'Os rostos que sua história já revelou.'}</p></div>${management?button('Novo NPC',base+'/novo','user'):''}</div><form data-npc-form="filters" class="workshop-filters">${field('q','Buscar pessoa',filters.q,'type="search" maxlength="120"')}${select('role','Papel',[['','Todos'],...Object.entries(roles)],filters.role)}${management?select('status','Estado',[['','Todos'],...Object.entries(statuses)],filters.status):''}<button class="btn ghost" type="submit">Buscar pessoas</button></form>${list?.items.length?`<div class="media-grid">${list.items.map(n=>card(n,management)).join('')}</div>`:empty(management?'Nenhum NPC neste filtro.':'Nenhuma pessoa registrada por enquanto.')}<nav class="workshop-pagination" aria-label="Páginas de pessoas">${list&&list.total>list.pageSize?`<button class="btn ghost" data-npc-action="previous" ${list.page<=1?'disabled':''}>Anterior</button><span>Página ${list.page}</span><button class="btn ghost" data-npc-action="next" ${list.page*list.pageSize>=list.total?'disabled':''}>Próxima</button>`:''}</nav>`;
    }
    if(state.page.startsWith(base))return editor();
    return `${label('PESSOAS CONHECIDAS')}<h1 class="display">${esc(current.name)}</h1>${personView(current)}${button('Pessoas conhecidas',publicBase,'user')}`;
  }
  async function submit(form,submitter){
    if(state.busy)return;state.busy=true;const data=new FormData(form),kind=form.dataset.npcForm,err=form.querySelector('.form-error'),submit=submitter??form.querySelector('button[type="submit"]');
    if(err)err.textContent='';if(submit)submit.disabled=true;
    try{
      if(kind==='filters'){filters={q:String(data.get('q')??''),role:String(data.get('role')??''),status:String(data.get('status')??''),page:1};state.dirty=false;await load();render();return;}
      if(!admin())throw new Error('Acesso reservado ao Mestre.');
      if(kind==='preview'){
        const value=await api(`/api/master/workshop/npcs/${current.id}/preview?character=${encodeURIComponent(data.get('previewCharacter'))}&source=${data.get('previewSource')}`);
        document.querySelector('#npc-preview-result').innerHTML=value.accessible?personView(value.npc,true):empty('Esta pessoa não está disponível para o personagem selecionado.');return;
      }
      let saved;
      if(kind==='profile'){
        let portraitFileId=data.get('portraitFileId')||null;const upload=data.get('upload'),asset=data.get('asset');
        if(upload?.size){if(upload.size>2*1024*1024)throw new Error('Use um retrato de até 2 MB.');portraitFileId=(await api('/api/master/workshop/files',{method:'POST',body:upload,raw:true})).id;}
        else if(asset)portraitFileId=(await api('/api/master/workshop/files',{method:'POST',body:{asset}})).id;
        const payload={name:data.get('name'),description:data.get('description'),role:data.get('role'),houseId:data.get('houseId')||null,locationId:data.get('primaryLocation')||null,relatedLocations:data.getAll('relatedLocations'),portraitFileId,portraitAlt:data.get('portraitAlt')};
        saved=await api('/api/master/workshop/npcs'+(current?'/'+current.id:''),{method:current?'PATCH':'POST',body:{...(current?{version:current.version}:{}),payload,policy:readPolicy(data),privateNotes:data.get('privateNotes')}});
      }else if(kind==='fragment'){
        saved=await api(`/api/master/workshop/npcs/${current.id}/fragments`,{method:'POST',body:{version:current.version,fragmentId:form.dataset.id||null,title:data.get('title'),text:data.get('text'),policy:readPolicy(data)}});
      }else if(kind==='reveal'){
        if(state.dirty)throw new Error('Salve as alterações antes desta ação.');
        saved=await api(`/api/master/workshop/npcs/${current.id}/${submitter.value}`,{method:'POST',body:{version:current.version,fragmentId:form.dataset.id,characters:data.getAll('recipients')}});
      }
      dirtyForms.delete(form);
      if(dirtyForms.size){current=saved;state.dirty=true;form.querySelector('fieldset').disabled=true;toast('Formulário salvo. Conclua os outros formulários em edição para atualizar a página.');return;}
      state.dirty=false;await navigate(base+'/'+saved.id,true);toast(kind==='reveal'?'Ação de conhecimento registrada.':'Rascunho salvo. Publique para atualizar o perfil disponível.');
    }catch(e){if(err){err.textContent=e.message;err.focus();}else toast(e.message,true);}
    finally{state.busy=false;if(submit)submit.disabled=false;}
  }
  function attach(root){
    root.addEventListener('input',event=>{const form=event.target.closest('[data-npc-form="profile"],[data-npc-form="fragment"]');if(form){dirtyForms.add(form);if(form.dataset.npcForm==='profile')for(const [name,key] of [['name','name'],['description','description'],['role','role']]){const proof=root.querySelector('[data-npc-proof-'+key+']');if(proof)proof.textContent=name==='role'?roles[form.elements[name].value]:form.elements[name].value;}const summary=form.querySelector('[data-npc-access-summary]');if(summary)summary.textContent=visibilitySummary(readPolicy(new FormData(form)));}});
    root.addEventListener('submit',event=>{if(!(event.target instanceof HTMLFormElement)||!event.target.dataset.npcForm)return;event.preventDefault();void submit(event.target,event.submitter);});
    root.addEventListener('click',async event=>{
      const opening=event.target.closest('[data-npc-open-preview]');if(opening){const panel=root.querySelector('#npc-player-preview');panel?.scrollIntoView({block:'center'});panel?.querySelector('select')?.focus();return;}
      const visibility=event.target.closest('[data-npc-visibility]');if(visibility){
        const form=visibility.closest('form'),policy=form.querySelector('[data-compact-policy]');if(!policy)return;
        const mode=visibility.dataset.npcVisibility;
        if(mode!=='characters'){form.querySelector('[name=audience]').value=mode==='all'?'ALL':'SELECTED';for(const input of policy.querySelectorAll('input[type=checkbox]'))input.checked=false;for(const name of ['regionId','locationId'])policy.querySelector('[name='+name+']').value='';}
        else{form.querySelector('[name=audience]').value='SELECTED';policy.open=true;policy.querySelector('[name=characters]')?.focus();}
        form.querySelector('[data-npc-access-summary]').textContent=visibilitySummary(readPolicy(new FormData(form)));state.dirty=true;dirtyForms.add(form);return;
      }
      const el=event.target.closest('[data-npc-action]');if(!el)return;event.preventDefault();if(state.busy)return;const action=el.dataset.npcAction;
      const confirm=root.querySelector('#npc-confirm');
      if(action.startsWith('ask-')){
        const target=action.slice(4),fragment=el.dataset.fragment;
        if(target==='publish'){
          if(state.dirty){toast('Salve o rascunho e o público escolhido antes de publicar.',true);return;}
          if(current.payload.portraitFileId&&!current.payload.portraitAlt){toast('Antes de publicar: preencha o texto alternativo do retrato.',true);return;}
          el.disabled=true;const checkingId=current.id,checkingVersion=current.version,checkingPage=state.page;
          try{const results=await Promise.all(context.characters.map(async ch=>({name:ch.name,...await api(`/api/master/workshop/npcs/${current.id}/preview?character=${encodeURIComponent(ch.id)}&source=draft`)})));
            if(current?.id!==checkingId||current.version!==checkingVersion||state.page!==checkingPage)return;
            const names=results.filter(r=>r.accessible).map(r=>r.name);
            confirm.innerHTML=`<div class="action-confirm"><h3 class="head3">${names.length?'Publicar para personagens':'Publicar apenas no meu acervo'}</h3><p>Quem verá o perfil: <strong>${esc(names.length?names.join(', '):'Somente o Mestre')}</strong>.</p><p>As informações progressivas e segredos não serão revelados automaticamente. Esta ação substitui a revisão pública anterior.</p><button class="btn" data-npc-action="publish">Confirmar publicação</button><button class="btn ghost" data-npc-action="cancel">Cancelar</button></div>`;
            confirm.scrollIntoView({block:'center'});confirm.querySelector('button').focus();
          }catch(err){toast('Não foi possível conferir os destinatários: '+err.message,true);}finally{el.disabled=false;}return;
        }
        confirm.innerHTML=`<div class="action-confirm"><p>${target==='publish'?'Publicar o perfil e preparar suas informações, sem revelá-las automaticamente?':target==='archive'?'Arquivar o NPC, preservando histórico e conhecimentos registrados?':'Remover esta informação do rascunho? A revisão publicada só muda ao republicar.'}</p><button class="btn" data-npc-action="${target}" ${fragment?'data-fragment="'+esc(fragment)+'"':''}>${target==='publish'?'Confirmar publicação':target==='archive'?'Confirmar arquivamento':'Confirmar remoção'}</button><button class="btn ghost" data-npc-action="cancel">Cancelar</button></div>`;
        confirm.querySelector('button').focus();return;
      }
      if(action==='cancel'){confirm.innerHTML='';return;}
      state.busy=true;el.disabled=true;
      try{
        if(action==='next'||action==='previous'){filters.page+=action==='next'?1:-1;await load();render();return;}
        if(!admin())throw new Error('Acesso reservado ao Mestre.');if(state.dirty)throw new Error('Salve ou recarregue suas alterações antes desta ação.');
        const saved=await api(`/api/master/workshop/npcs/${current.id}/${action==='remove'?'fragments':action}`,{method:action==='remove'?'DELETE':'POST',body:{version:current.version,...(action==='remove'?{fragmentId:el.dataset.fragment}:{})}});
        state.dirty=false;await navigate(base+'/'+saved.id,true);toast('Ação registrada.');
      }catch(e){toast(e.message,true);}finally{state.busy=false;el.disabled=false;}
    });
  }
  async function poll(){
    if(state.page===base||state.page===publicBase){const next=await api(`${state.page===base?'/api/master/workshop/npcs':'/api/workshop/npcs'}?${query()}`);if(JSON.stringify(next)!==JSON.stringify(list)){list=next;render();}}
    else if(state.page.startsWith(publicBase+'/')){try{const next=await api('/api/workshop/npcs/'+state.page.split('/').pop());if(JSON.stringify(next)!==JSON.stringify(current)){current=next;error=null;render();}}catch(e){if(error!==e.message){error=e.message;render();}}}
  }
  return {handles,load,page,attach,poll};
}
