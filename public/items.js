import {quickCreateForm,compactPolicyFields} from '/quick-create.js';
import { defaultPolicy, readPolicy } from '/editorial-ui.js';
const base='/portal/mestre/oficinas/itens',publicBase='/portal/artigos';
const statuses={DRAFT:'Rascunho',PREPARED:'Preparado',PUBLISHED:'Publicado',ARCHIVED:'Arquivado'};
const actions={CREATED:'Criação',SAVED:'Item salvo',PREPARE:'Preparado',PUBLISH:'Publicado',ARCHIVE:'Arquivado',RESTORE:'Restaurado',DUPLICATED:'Cópia criada'};
const blankPrivate=()=>({category:'',quality:'',materials:'',properties:'',magicDegree:'',activation:'',uses:'',frequency:'',craftingComplexity:'',availability:'',rarity:'',requirements:'',secretText:'',notes:'',referenceValueNuques:null,chosenPriceNuques:null,effects:[]});
export function createItemOffice({api,esc,ico,label,empty,button,state,render,navigate,toast}){
  let context=null,current=null,list=null,history=[],error=null;
  let filters={q:'',status:'',category:'',page:1};
  let effectSequence=0;
  const admin=()=>state.session?.role==='MASTER'&&!state.view;
  const handles=path=>path===base||path.startsWith(base+'/')||path===publicBase||path.startsWith(publicBase+'/');
  const query=()=>new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''));
  const field=(name,title,value='',extra='',ns='item')=>`<div class="field"><label for="${ns}-${name}">${esc(title)}</label><input id="${ns}-${name}" name="${name}" value="${esc(value)}" ${extra}></div>`;
  const area=(name,title,value='',max=3000,ns='item')=>`<div class="field"><label for="${ns}-${name}">${esc(title)}</label><textarea id="${ns}-${name}" name="${name}" rows="4" maxlength="${max}">${esc(value)}</textarea></div>`;
  const select=(name,title,options,value='')=>`<div class="field"><label for="item-${name}">${esc(title)}</label><select id="item-${name}" name="${name}">${options.map(([id,title])=>`<option value="${esc(id)}" ${String(value)===String(id)?'selected':''}>${esc(title)}</option>`).join('')}</select></div>`;
  const formError='<p class="form-error" role="alert" tabindex="-1"></p>';
  async function load(){
    if(!handles(state.page))return;error=null;
    const management=state.page.startsWith(base);if(management&&!admin()){error='Acesso reservado ao Mestre.';return;}
    try{
      if(management)context=await api('/api/master/workshop/context',{preview:false});
      if(state.page===base||state.page===publicBase)list=await api(`${management?'/api/master/workshop/items':'/api/workshop/items'}?${query()}`);
      else{
        const id=state.page.split('/').pop();if(management&&id==='novo'){current=null;history=[];return;}
        current=await api(`${management?'/api/master/workshop/items/':'/api/workshop/items/'}${id}`);
        if(management)history=(await api(`/api/master/workshop/items/${id}/history`)).items;
      }
    }catch(e){error=e.message;}
  }
  const withView=image=>image+(state.view?'&view_as='+encodeURIComponent(state.view):'');
  function article(p,{preview=false,heading='h2'}={}){
    return `<article class="card item-article">${p.image?`<img class="item-illustration" src="${esc(preview?p.image:withView(p.image))}" alt="${esc(p.alt)}">`:`<div class="item-ornament">${ico('star',40)}</div>`}<div class="item-article-text"><${heading} class="head2">${esc(p.name)}</${heading}><p class="biography">${esc(p.description)}${p.effectsText?'\n\n'+esc(p.effectsText):''}</p></div></article>`;
  }
  function card(n,management){
    const p=management?n.payload:n,target=(management?base:publicBase)+'/'+n.id;
    const image=management?(p.fileId?`/api/master/workshop/items/${n.id}/image?version=${n.version}`:null):p.image;
    return `<article class="card item-record"><a href="${target}" data-go="${target}">${image?`<img src="${esc(management?image:withView(image))}" alt="${esc(p.alt||'Imagem em preparação')}">`:`<div class="item-ornament">${ico('star',35)}</div>`}<div class="media-record-body">${management?`<span class="badge">${statuses[n.status]}</span>`:''}<h2>${esc(p.name)}</h2>${management?`<p class="subtle">${esc(n.private.category||'Sem categoria')}</p>${n.hasUnpublishedChanges?'<p class="draft-warning">Há alterações não publicadas.</p>':''}`:`<p>${esc(p.description.slice(0,160))}</p>`}</div></a></article>`;
  }
  function moneyFields(name,title,value){
    const parts=value===null?['','','']:[Math.floor(value/493),Math.floor(value%493/29),value%29];
    return `<fieldset class="source-fields"><legend>${title}</legend><div class="item-money">${['Galeões','Sicles','Nuques'].map((unit,i)=>field(`${name}-${i}`,unit,parts[i],`type="number" min="0" max="${[2028397565,16,28][i]}" step="1"`)).join('')}</div><small>Opcional. Deixe os três campos vazios para não definir valor.</small></fieldset>`;
  }
  function moneyValue(data,name){
    const values=[0,1,2].map(i=>String(data.get(`${name}-${i}`)??''));if(values.every(v=>v===''))return null;
    const numbers=values.map(v=>v===''?0:Number(v));if(numbers.some(v=>!Number.isSafeInteger(v)||v<0)||numbers[1]>16||numbers[2]>28)throw new Error('Informe moedas inteiras: até 16 Sicles e 28 Nuques.');
    const total=numbers[0]*493+numbers[1]*29+numbers[2];if(!Number.isSafeInteger(total)||total>1_000_000_000_000)throw new Error('O valor excede o limite permitido.');return total;
  }
  const effectFields=[['magicDegree','Grau da magia'],['activation','Ativação'],['uses','Usos ou cargas'],['frequency','Frequência'],['requirements','Requisitos de uso']];
  function effectRow(effect={},index=0){
    const ns='effect-'+(++effectSequence);
    return `<fieldset class="source-fields effect-row" data-effect-id="${esc(effect.id??'')}"><legend>Efeito <span class="effect-position">${index+1}</span></legend>${field('effect-name','Nome do efeito',effect.name??'','required maxlength="120"',ns)}${area('effect-description','Descrição interna do efeito',effect.description??'',600,ns)}<details class="advanced-fields"><summary>Configuração deste efeito</summary>${effectFields.map(([name,title])=>field('effect-'+name,title,effect[name]??'',`maxlength="${({magicDegree:80,activation:200,uses:120,frequency:120,requirements:240})[name]}"`,ns)).join('')}</details><div class="group"><button type="button" class="btn ghost small" data-item-action="effect-up" aria-label="Mover efeito para cima">↑</button><button type="button" class="btn ghost small" data-item-action="effect-down" aria-label="Mover efeito para baixo">↓</button><button type="button" class="btn ghost small" data-item-action="effect-remove">Remover efeito</button></div></fieldset>`;
  }
  function editor(){
    if(!current&&!state.fullCreate)return quickCreateForm('items',context,{esc,label,button});
    const c=current,p=c?.payload??{name:'',description:'',fileId:null,alt:'',crop:{x:0,y:0,width:100,height:100}},internal=c?.private??blankPrivate(),archived=c?.status==='ARCHIVED';
    return `${label('OFICINA GERAL','Itens')}<div class="workshop-title"><div><h1 class="display">${c?'Editar item':'Novo item'}</h1>${c?`<span class="badge">${statuses[c.status]} · revisão ${c.version}</span>${c.hasUnpublishedChanges?'<p class="draft-warning">Há alterações ainda não publicadas.</p>':''}`:''}</div>${button('Lista de itens',base,'book')}</div><div class="workshop-editor"><form class="card media-editor-form" data-item-form="item"><fieldset class="editor-fields" ${archived?'disabled':''}><legend class="sr-only">Cadastro do item</legend>${field('name','Nome',p.name,'required maxlength="120"')}${area('description','Descrição revelada',p.description)}${area('effectsText','Efeitos (texto livre)',p.effectsText??'',4000)}${field('category','Categoria interna',internal.category,'maxlength="200" list="item-categories"')}<datalist id="item-categories">${['Poção','Ingrediente','Livro','Instrumento','Vestuário','Objeto mágico','Outro'].map(value=>`<option value="${value}"></option>`).join('')}</datalist><details class="advanced-fields"><summary>Imagem e corte</summary><div class="field"><label for="item-upload">Enviar imagem opcional</label><input id="item-upload" name="upload" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG ou WebP · até 2 MB.</small></div>${select('asset','Ou escolher uma imagem aprovada',[['','Não selecionar'],...context.approvedAssets.map(a=>[a,a.replaceAll('_',' ').replace('.webp','')])])}${select('fileId','Arquivo da imagem',[['','Sem imagem'],...context.files.map((f,i)=>[f.id,`Imagem ${i+1} · ${f.width} × ${f.height}`])],p.fileId??'')}${field('alt','Texto alternativo',p.alt,'maxlength="300"')}<div class="crop-fields">${[['x','Esquerda (%)'],['y','Topo (%)'],['width','Largura (%)'],['height','Altura (%)']].map(([key,title])=>field('crop-'+key,title,p.crop[key],`type="number" min="${['width','height'].includes(key)?'0.1':'0'}" max="100" step="0.1" required`)).join('')}</div>${c?.sourceImage?`<img class="source-preview" src="${esc(c.sourceImage.image)}" alt="Original selecionado">${c.sourceImage.originalAlreadyPublic?'<p class="subtle">Esta arte de ambientação já é pública na ambientação do portal.</p>':''}`:''}</details><details class="advanced-fields"><summary>Propriedades e fabricação</summary><p class="subtle">Campos exclusivos do Mestre. Para revelar algum detalhe, escreva-o na descrição revelada.</p>${field('quality','Qualidade',internal.quality,'maxlength="200"')}${area('materials','Materiais',internal.materials,1000)}${area('properties','Propriedades',internal.properties,1500)}${[...effectFields,['craftingComplexity','Complexidade de confecção'],['availability','Disponibilidade'],['rarity','Raridade']].map(([name,title])=>field(name,title,internal[name],'maxlength="200"')).join('')}</details><details class="advanced-fields"><summary>Avançado: efeitos estruturados antigos</summary><p class="subtle">Até 12 efeitos internos, na ordem que você escolher. Não aplicam mecânicas automaticamente.</p><div id="item-effects">${internal.effects.map(effectRow).join('')}</div><button class="btn ghost" type="button" data-item-action="effect-add">Adicionar efeito</button></details><details class="advanced-fields"><summary>Valores e segredos do Mestre</summary><p class="subtle">Estimativa e preço são independentes e privados. O preço de cada loja será definido na respectiva oferta. Nenhum valor aqui cria uma oferta.</p>${moneyFields('reference','Estimativa de referência',internal.referenceValueNuques)}${moneyFields('price','Preço interno escolhido',internal.chosenPriceNuques)}${area('secretText','Texto secreto',internal.secretText,4000)}${area('notes','Notas do Mestre',internal.notes,2000)}</details>${compactPolicyFields(context,c?.policy??defaultPolicy(),esc,'item-access')}<p class="subtle">Publicar libera este artigo aos destinatários, sem criar loja, posse, recompensa ou aprendizagem.</p>${formError}<button type="submit" class="btn">${c?'Salvar rascunho':'Criar rascunho'}</button></fieldset></form><aside class="editor-sidebar">${c?`<section class="card editor-actions"><h2 class="head3">Ações do item</h2><div class="editor-action-buttons">${archived?'<button class="btn" data-item-action="restore">Restaurar sem publicar</button>':`<button class="btn ghost" data-item-action="prepare" ${c.status==='PUBLISHED'?'disabled':''}>Preparar item</button><button class="btn" data-item-action="ask-publish">Revisar publicação</button><button class="btn ghost" data-item-action="ask-archive">Arquivar</button>`}<button class="btn ghost" data-item-action="duplicate">Duplicar como rascunho</button></div><div id="item-confirm" aria-live="polite"></div></section><section class="card editor-preview"><h2 class="head3">Prévia como personagem</h2><form data-item-form="preview">${select('previewCharacter','Personagem da prévia',context.characters.map(ch=>[ch.id,ch.name]))}${select('previewSource','Revisão da prévia',[['draft','Rascunho salvo'],...(c.publishedRevision?[['published','Revisão publicada']]:[])])}${formError}<button class="btn ghost" type="submit">Conferir artigo</button></form><div id="item-preview-result"></div></section><section class="card editor-history"><h2 class="head3">Histórico do item</h2><p class="subtle">Últimas 20 revisões · somente Mestre.</p>${history.map(h=>`<details><summary>Revisão ${h.version} · ${actions[h.action]??esc(h.action)}</summary><p class="subtle">${esc(context.authors.find(a=>a.id===h.actorId)?.email??'Mestre')} · ${new Date(h.createdAt*1000).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p><dl><dt>Estado</dt><dd>${statuses[h.snapshot.status]}</dd><dt>Artigo</dt><dd>${esc(h.snapshot.payload.name)}<p>${esc(h.snapshot.payload.description)}</p></dd><dt>Dados internos preservados</dt><dd><pre>${esc(JSON.stringify(h.snapshot.private,null,2))}</pre></dd></dl></details>`).join('')}</section>`:empty('Salve um rascunho para conferir a prévia e preparar o artigo.')}</aside></div>`;
  }
  function page(){
    if(error)return `${label('ARQUIVOS MÁGICOS')}${empty(error)}${button('Voltar ao início','/portal/inicio')}`;
    if(state.page===base||state.page===publicBase){
      const management=state.page===base;
      return `${label(management?'OFICINA GERAL':'SEUS REGISTROS')}<div class="workshop-title"><div><h1 class="display">${management?'Itens':'Artigos revelados'}</h1><p class="muted">${management?'Cadastre e prepare objetos para os próximos capítulos.':'Objetos e suas histórias.'}</p></div>${management?button('Novo item',base+'/novo','book'):''}</div><form data-item-form="filters" class="workshop-filters">${field('q','Buscar artigo',filters.q,'type="search" maxlength="120"')}${management?`${field('category','Categoria',filters.category,'maxlength="200"')}${select('status','Estado',[['','Todos'],...Object.entries(statuses)],filters.status)}`:''}<button class="btn ghost" type="submit">Buscar artigos</button></form>${list?.items.length?`<div class="media-grid">${list.items.map(i=>card(i,management)).join('')}</div>`:empty(management?'Nenhum item neste filtro.':'Nenhum artigo revelado por enquanto.')}<nav class="workshop-pagination" aria-label="Páginas de artigos">${list&&list.total>list.pageSize?`<button class="btn ghost" data-item-action="previous" ${list.page<=1?'disabled':''}>Anterior</button><span>Página ${list.page}</span><button class="btn ghost" data-item-action="next" ${list.page*list.pageSize>=list.total?'disabled':''}>Próxima</button>`:''}</nav>`;
    }
    if(state.page.startsWith(base)){window.requestAnimationFrame(numberEffects);return editor();}
    return `${label('ARTIGOS REVELADOS')}${article(current,{heading:'h1'})}<div class="group item-public-actions"><button class="btn ghost small" data-item-action="copy">${ico('scroll',16)} Copiar descrição</button>${button('Artigos revelados',publicBase,'book')}</div><div class="item-copy" hidden><div class="field"><label for="item-copy-text">Descrição para copiar</label><textarea id="item-copy-text" rows="6" readonly></textarea></div><p class="subtle" role="status"></p></div>`;
  }
  function numberEffects(){
    const rows=[...document.querySelectorAll('.effect-row')];rows.forEach((row,index)=>{row.querySelector('.effect-position').textContent=String(index+1);row.querySelector('[data-item-action="effect-up"]').disabled=index===0;row.querySelector('[data-item-action="effect-down"]').disabled=index===rows.length-1;});
    const add=document.querySelector('[data-item-action="effect-add"]');if(add)add.disabled=rows.length>=12||current?.status==='ARCHIVED';
  }
  async function submit(form){
    if(state.busy)return;state.busy=true;const data=new FormData(form),kind=form.dataset.itemForm,err=form.querySelector('.form-error'),submit=form.querySelector('button[type="submit"]');
    if(err)err.textContent='';submit.disabled=true;
    try{
      if(kind==='filters'){filters={q:String(data.get('q')??''),category:String(data.get('category')??''),status:String(data.get('status')??''),page:1};state.dirty=false;await load();render();return;}
      if(!admin())throw new Error('Acesso reservado ao Mestre.');
      if(kind==='preview'){
        const value=await api(`/api/master/workshop/items/${current.id}/preview?character=${encodeURIComponent(data.get('previewCharacter'))}&source=${data.get('previewSource')}`);
        document.querySelector('#item-preview-result').innerHTML=value.accessible?article(value.item,{preview:true}):empty('Este artigo não está disponível para o personagem selecionado.');return;
      }
      const internal=blankPrivate();for(const key of Object.keys(internal).filter(k=>!['effects','referenceValueNuques','chosenPriceNuques'].includes(k)))internal[key]=String(data.get(key)??'');
      internal.referenceValueNuques=moneyValue(data,'reference');internal.chosenPriceNuques=moneyValue(data,'price');
      internal.effects=[...form.querySelectorAll('.effect-row')].map(row=>Object.fromEntries([['id',row.dataset.effectId||null],...['name','description',...effectFields.map(([name])=>name)].map(key=>[key,row.querySelector(`[name="effect-${key}"]`).value])]));
      let fileId=data.get('fileId')||null;const upload=data.get('upload'),asset=data.get('asset');
      if(upload?.size){if(upload.size>2*1024*1024)throw new Error('Use uma imagem de até 2 MB.');fileId=(await api('/api/master/workshop/files',{method:'POST',body:upload,raw:true})).id;}
      else if(asset)fileId=(await api('/api/master/workshop/files',{method:'POST',body:{asset}})).id;
      const payload={name:data.get('name'),description:data.get('description'),effectsText:data.get('effectsText')??'',fileId,alt:data.get('alt'),crop:Object.fromEntries(['x','y','width','height'].map(key=>[key,Number(data.get('crop-'+key))]))};
      const saved=await api('/api/master/workshop/items'+(current?'/'+current.id:''),{method:current?'PATCH':'POST',body:{...(current?{version:current.version}:{}),payload,policy:readPolicy(data),private:internal}});
      state.dirty=false;await navigate(base+'/'+saved.id,true);numberEffects();toast('Rascunho salvo. Publique para atualizar o artigo disponível.');
    }catch(e){err.textContent=e.message;err.focus();}finally{state.busy=false;submit.disabled=false;}
  }
  function attach(root){
    root.addEventListener('submit',event=>{if(!(event.target instanceof HTMLFormElement)||!event.target.dataset.itemForm)return;event.preventDefault();void submit(event.target);});
    root.addEventListener('click',async event=>{
      const el=event.target.closest('[data-item-action]');if(!el)return;event.preventDefault();if(state.busy)return;const action=el.dataset.itemAction;
      if(action.startsWith('effect-')){
        if(!admin()||current?.status==='ARCHIVED')return;const rows=root.querySelector('#item-effects'),row=el.closest('.effect-row');
        if(action==='effect-add'){if(rows.children.length>=12)return;rows.insertAdjacentHTML('beforeend',effectRow({},rows.children.length));rows.lastElementChild.querySelector('input').focus();}
        else if(action==='effect-remove'){const next=row.nextElementSibling??row.previousElementSibling;row.remove();(next?.querySelector('input')??root.querySelector('[data-item-action="effect-add"]')).focus();}
        else if(action==='effect-up'&&row.previousElementSibling)row.previousElementSibling.before(row);
        else if(action==='effect-down'&&row.nextElementSibling)row.nextElementSibling.after(row);
        state.dirty=true;numberEffects();return;
      }
      const confirm=root.querySelector('#item-confirm');
      if(action.startsWith('ask-')){const target=action.slice(4);confirm.innerHTML=`<div class="action-confirm"><p>${target==='publish'?'Publicar o artigo salvo para o público escolhido? Nenhuma oferta, posse ou recompensa será criada.':'Arquivar o artigo, preservando suas revisões?'}</p><button class="btn" data-item-action="${target}">${target==='publish'?'Confirmar publicação':'Confirmar arquivamento'}</button><button class="btn ghost" data-item-action="cancel">Cancelar</button></div>`;confirm.querySelector('button').focus();return;}
      if(action==='cancel'){confirm.innerHTML='';return;}
      state.busy=true;el.disabled=true;
      try{
        if(action==='copy'){
          const value=await api(`/api/workshop/items/${current.id}/copy`),container=root.querySelector('.item-copy'),output=container.querySelector('textarea');output.value=value.text;container.hidden=false;
          try{await navigator.clipboard.writeText(value.text);container.querySelector('[role="status"]').textContent='Descrição copiada.';}catch{container.querySelector('[role="status"]').textContent='Selecione e copie o texto abaixo.';output.focus();output.select();}return;
        }
        if(action==='next'||action==='previous'){filters.page+=action==='next'?1:-1;await load();render();return;}
        if(!admin())throw new Error('Acesso reservado ao Mestre.');if(state.dirty)throw new Error('Salve ou recarregue as alterações antes desta ação.');
        const saved=await api(`/api/master/workshop/items/${current.id}/${action}`,{method:'POST',body:{version:current.version}});state.dirty=false;await navigate(base+'/'+saved.id,true);numberEffects();toast('Ação registrada.');
      }catch(e){toast(e.message,true);}finally{state.busy=false;el.disabled=false;}
    });
  }
  async function poll(){
    if(state.page===base||state.page===publicBase){const next=await api(`${state.page===base?'/api/master/workshop/items':'/api/workshop/items'}?${query()}`);if(JSON.stringify(next)!==JSON.stringify(list)){list=next;render();}}
    else if(state.page.startsWith(publicBase+'/')){try{const next=await api('/api/workshop/items/'+state.page.split('/').pop());if(JSON.stringify(next)!==JSON.stringify(current)){current=next;error=null;render();}}catch(e){if(error!==e.message){error=e.message;render();}}}
  }
  return {handles,load,page,attach,poll};
}
