const disclosureState=new Map();
const disclosureKey=d=>d.querySelector(':scope>summary')?.textContent.trim()??'';
// Progressive disclosure changes the presentation, never the authorization.
export function enhanceSimplicity(root,state,{api,button,esc}){
 root.dataset.disclosurePage=state.page;
 const master=state.session?.role==='MASTER'&&!state.view;
 // No calendar destinations or duplicate workshops are offered in navigation.
 const retired=/^\/portal\/(?:mestre\/(?:calendario|oficinas\/(?:historias|conteudos\/(?:years|events|timetables|offers|templates|chocolatepools)))|calendario)(?:\/|$)/;
 root.querySelectorAll('[data-go]').forEach(a=>{if(retired.test(a.dataset.go)&&!a.closest('[data-integrated-tool]'))a.remove();});
 // Technical campaign-year bindings remain in the submitted form, out of the UI.
 if(master)for(const el of root.querySelectorAll('select[name="academicYear"],select[name="payload.academicYear"]')){const hidden=document.createElement('input');hidden.type='hidden';hidden.name=el.name;hidden.value=el.value;el.closest('.field')?.replaceWith(hidden);}
 if(master&&state.page==='/portal/mestre'){
  for(const id of ['regions','locations','characters','invites','groups']){const section=root.querySelector('#'+id);if(!section)continue;const details=document.createElement('details');details.className='master-section card';const summary=document.createElement('summary');summary.textContent=section.querySelector('h2')?.textContent??id;section.before(details);details.append(summary,section);}
 }
 // History, validation and unusual operations are kept, but are not primary actions.
 if(master)for(const section of root.querySelectorAll('.editor-history')){if(section.closest('details'))continue;const d=document.createElement('details');d.className='advanced-fields';if(section.dataset.editorPanel){d.dataset.editorPanel=section.dataset.editorPanel;d.hidden=section.hidden;}const summary=document.createElement('summary');summary.textContent='Histórico';section.before(d);d.append(summary,section);}
 // Search existing records without replacing the native select or its keyboard behavior.
 if(master)for(const select of root.querySelectorAll('select')){
  if(select.options.length<8||select.name==='previewCharacter'||select.dataset.searchable)continue;select.dataset.searchable='true';
  const input=document.createElement('input');input.type='search';input.placeholder='Buscar nas opções…';input.setAttribute('aria-label','Buscar opções de '+(select.labels?.[0]?.textContent.trim()||select.getAttribute('aria-label')||'seleção'));input.className='option-search';select.before(input);
  input.addEventListener('input',()=>{const q=input.value.toLocaleLowerCase('pt-BR');for(const o of select.options)o.hidden=!!q&&!o.text.toLocaleLowerCase('pt-BR').includes(q)&&!o.selected;});
 }
 const prize=root.querySelector('[data-document-form="immediate"]');if(prize){const update=()=>{const kind=prize.elements.kind.value;for(const group of prize.querySelectorAll('[data-prize]')){group.hidden=!group.dataset.prize.split(' ').includes(kind);group.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=group.hidden);}};prize.elements.kind.addEventListener('change',update);update();}
 if(master)for(const select of root.querySelectorAll('select[name="templateId"],select[name="payload.templateId"]')){if(select.closest('.quest-tabbed-editor'))continue;const link=document.createElement('a');link.href='/portal/mestre/oficinas/conteudos/templates/novo';link.dataset.go=link.getAttribute('href');link.textContent='Criar ou reutilizar modelo';link.className='btn ghost small';link.dataset.integratedTool='';select.closest('.field')?.append(link);}
 // Numeric marker inputs stay bound to their existing forms and endpoints.
 if(master){
  for(const fields of root.querySelectorAll('.coordinate-fields'))void mapControl(fields,state,api);
  const content=root.querySelector('[data-content-form="editor"]');if(content&&state.page.includes('/places/'))void contentMarker(content,state,api);
  for(const fields of root.querySelectorAll('.crop-fields'))if(fields.querySelector('[name^="crop-"],[name="cropX"]'))cropControl(fields,state);
 }
 const remembered=disclosureState.get(state.page);if(remembered)for(const d of root.querySelectorAll('details'))if(remembered.has(disclosureKey(d)))d.open=remembered.get(disclosureKey(d));
 // Editor-specific secondary tools stay within their owning flow.
 if(master&&state.page.includes('/shops/')){const title=root.querySelector('.workshop-title');if(title&&!root.querySelector('[data-shop-catalog]')){const id=state.page.split('/').pop();if(id!=='novo')void shopCatalog(root,id,state,{api,button,esc});}}
}
function hiddenInput(input){input.type='hidden';input.closest('.field')?.classList.add('sr-only');}
async function mapControl(fields,state,api){
 const form=fields.closest('form'),x=form.querySelector('[name=x]'),y=form.querySelector('[name=y]');if(!x||!y)return;
 const id=form.dataset.id,region=state.admin?.locations.find(l=>l.id===id)?.region_id;if(!region)return;
 await marker(fields,x,y,region,state,api);
}
async function contentMarker(form,state,api){
 const x=form.querySelector('[name="payload.x"]'),y=form.querySelector('[name="payload.y"]'),region=form.querySelector('[name="payload.regionId"]');if(!x||!y||!region)return;
 const stage=document.createElement('div');y.closest('.field').after(stage);await marker(stage,x,y,region.value,state,api);region.addEventListener('change',()=>{stage.replaceChildren();void marker(stage,x,y,region.value,state,api);});
}
async function marker(container,x,y,region,state,api){
 hiddenInput(x);hiddenInput(y);const info=document.createElement('p');info.className='subtle';info.textContent='Posicione o marcador no mapa por toque ou arraste. Use as setas do teclado para ajustar.';container.append(info);
 try{const data=await api('/api/world/regions/'+encodeURIComponent(region));if(!data.image){info.textContent='Adicione um mapa à região para posicionar este local visualmente. A posição atual será preservada.';return;}
 const stage=document.createElement('div');stage.className='visual-map-editor';const img=document.createElement('img');img.src=data.image;img.alt='Mapa de '+data.title;const pin=document.createElement('button');pin.type='button';pin.className='map-editor-pin';pin.textContent='✦';pin.setAttribute('aria-label','Mover marcador no mapa com as setas');stage.append(img,pin);container.append(stage);
 const paint=()=>{pin.style.left=(x.value||50)+'%';pin.style.top=(y.value||50)+'%';pin.setAttribute('aria-description',`Posição horizontal ${x.value||50}, vertical ${y.value||50}`);};paint();
 const write=(a,b)=>{x.value=Math.max(0,Math.min(100,a)).toFixed(1);y.value=Math.max(0,Math.min(100,b)).toFixed(1);state.dirty=true;paint();};
 stage.addEventListener('pointerdown',e=>{e.preventDefault();stage.setPointerCapture(e.pointerId);const move=ev=>{const r=stage.getBoundingClientRect();write((ev.clientX-r.left)/r.width*100,(ev.clientY-r.top)/r.height*100);};move(e);stage.onpointermove=move;stage.onpointerup=()=>stage.onpointermove=null;stage.onpointercancel=()=>stage.onpointermove=null;});
 pin.addEventListener('keydown',e=>{const dx={ArrowLeft:-1,ArrowRight:1}[e.key]??0,dy={ArrowUp:-1,ArrowDown:1}[e.key]??0;if(dx||dy){e.preventDefault();write(Number(x.value||50)+dx,Number(y.value||50)+dy);}});
 }catch{info.textContent='Não foi possível carregar o mapa. A posição salva foi preservada; tente novamente ao reabrir o local.';}
}
function cropControl(fields,state){
 const form=fields.closest('form'),image=form.querySelector('.source-preview'),inputs=Object.fromEntries(['x','y','width','height'].map(k=>[k,fields.querySelector('[name="crop-'+k+'"],[name="'+({x:'cropX',y:'cropY',width:'cropWidth',height:'cropHeight'}[k])+'"]')]));if(!Object.values(inputs).every(Boolean))return;
 for(const i of Object.values(inputs))hiddenInput(i);if(!image){const p=document.createElement('p');p.textContent='Salve a imagem para ajustar seu corte visualmente.';fields.append(p);return;}
 const stage=document.createElement('div');stage.className='visual-crop-editor';const img=image.cloneNode();img.alt='Imagem para ajustar o corte';new window.MutationObserver(()=>{img.src=image.src;}).observe(image,{attributes:true,attributeFilter:['src']});const rect=document.createElement('div');rect.className='crop-selection';rect.tabIndex=0;rect.setAttribute('role','button');rect.setAttribute('aria-label','Ajustar recorte: setas movem, Shift e setas redimensionam');const reset=document.createElement('button');reset.type='button';reset.className='btn ghost';reset.textContent='Usar imagem inteira';const instructions=document.createElement('p');instructions.textContent='Arraste na imagem para selecionar o recorte. Use o botão para restaurar a imagem inteira.';stage.append(img,rect);fields.append(instructions,stage,reset);
 const draw=()=>{for(const [k,css]of [['x','left'],['y','top'],['width','width'],['height','height']])rect.style[css]=inputs[k].value+'%';};draw();const save=(x,y,w,h)=>{Object.entries({x,y,width:w,height:h}).forEach(([k,v])=>inputs[k].value=(Math.floor(v*10)/10).toFixed(1));state.dirty=true;draw();};
 rect.addEventListener('keydown',e=>{const dx={ArrowLeft:-1,ArrowRight:1}[e.key]??0,dy={ArrowUp:-1,ArrowDown:1}[e.key]??0;if(!dx&&!dy)return;e.preventDefault();let x=Number(inputs.x.value),y=Number(inputs.y.value),w=Number(inputs.width.value),h=Number(inputs.height.value);if(e.shiftKey){w=Math.max(.1,Math.min(100-x,w+dx));h=Math.max(.1,Math.min(100-y,h+dy));}else{x=Math.max(0,Math.min(100-w,x+dx));y=Math.max(0,Math.min(100-h,y+dy));}save(x,y,w,h);});
 reset.onclick=()=>save(0,0,100,100);
 stage.onpointerdown=e=>{e.preventDefault();stage.setPointerCapture(e.pointerId);const bounds=stage.getBoundingClientRect(),at=ev=>[Math.max(0,Math.min(100,(ev.clientX-bounds.left)/bounds.width*100)),Math.max(0,Math.min(100,(ev.clientY-bounds.top)/bounds.height*100))],start=at(e);stage.onpointermove=ev=>{const end=at(ev),x=Math.min(99.9,start[0],end[0]),y=Math.min(99.9,start[1],end[1]);save(x,y,Math.max(.1,Math.min(100-x,Math.abs(end[0]-start[0]))),Math.max(.1,Math.min(100-y,Math.abs(end[1]-start[1]))));};stage.onpointerup=()=>stage.onpointermove=null;stage.onpointercancel=()=>stage.onpointermove=null;};
}
async function shopCatalog(root,id,state,{api,esc}){
 const panel=document.createElement('section');panel.className='card quest-operation-panel';panel.dataset.shopCatalog='';panel.innerHTML='<h2 class="head2">Catálogo desta loja</h2><p role="status">Carregando itens…</p>';root.querySelector('.workshop-editor')?.after(panel);
 try{const [context,offers]=await Promise.all([api('/api/master/content/context'),api('/api/master/content/offers')]);if(!panel.isConnected)return;
 panel.innerHTML=`<h2 class="head2">Catálogo desta loja</h2><p>Escolha um item existente. Preço e estoque ficam privados do Mestre.</p><form data-shop-offer><label class="field">Buscar item<input type="search" name="search" maxlength="120"></label><label class="field">Item existente<select name="item" aria-label="Item existente">${context.references.items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select></label><label class="field">Preço em Galeões<input name="price" type="number" min="0" step="1" required></label><label class="field">Estoque (vazio = ilimitado)<input name="stock" type="number" min="0" step="1"></label><details class="advanced-fields"><summary>Outras moedas</summary><label class="field">Sicles<input name="sickles" type="number" min="0" max="16" value="0"></label><label class="field">Nuques<input name="knuts" type="number" min="0" max="28" value="0"></label></details><p class="form-error" role="alert"></p><button class="btn" type="submit">Adicionar ao catálogo</button></form><details><summary>Itens e preços privados já cadastrados</summary>${offers.items.filter(o=>o.payload.shopId===id).map(o=>`<p>${esc(context.references.items.find(i=>i.id===o.payload.itemId)?.name??o.payload.title)} · ${o.payload.priceNuques??'Sem preço'} Nuques · estoque ${o.payload.stock??'ilimitado'} <a class="btn ghost small" data-integrated-tool href="/portal/mestre/oficinas/conteudos/offers/${esc(o.id)}" data-go="/portal/mestre/oficinas/conteudos/offers/${esc(o.id)}">Editar detalhes</a></p>`).join('')}</details>`;
 const form=panel.querySelector('form');form.elements.search.oninput=()=>{for(const option of form.elements.item.options)option.hidden=!option.text.toLocaleLowerCase('pt-BR').includes(form.elements.search.value.toLocaleLowerCase('pt-BR'))&&!option.selected;};
 form.onsubmit=async e=>{e.preventDefault();if(state.busy)return;state.busy=true;const submit=form.querySelector('button');submit.disabled=true;try{const data=new FormData(form),policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};const saved=await api('/api/master/content/offers',{method:'POST',body:{payload:{title:context.references.items.find(i=>i.id===data.get('item'))?.name??'',itemId:data.get('item'),shopId:id,available:true,priceNuques:Number(data.get('price'))*493+Number(data.get('sickles'))*29+Number(data.get('knuts')),stock:data.get('stock')===''?null:Number(data.get('stock')),conditions:''},policy,privateNotes:''}});try{await api('/api/master/content/offers/'+saved.id+'/publish',{method:'POST',body:{version:saved.version}});panel.innerHTML='<h2 class="head2">Item adicionado ao catálogo</h2><p>Nome, imagem e descrição são herdados do item. Reabra a loja para adicionar outros.</p>';}catch(err){form.querySelector('.form-error').textContent='Rascunho do catálogo preservado: '+err.message;}}catch(err){form.querySelector('.form-error').textContent=err.message;}finally{state.busy=false;submit.disabled=false;}};
 }catch{panel.innerHTML='<p role="alert">Não foi possível carregar o catálogo. Reabra esta loja para tentar novamente.</p>';}
}
export function attachSimplicity(root){
 root.addEventListener('toggle',e=>{if(!e.target.matches('details'))return;const page=root.dataset.disclosurePage;if(!page)return;if(!disclosureState.has(page))disclosureState.set(page,new Map());disclosureState.get(page).set(disclosureKey(e.target),e.target.open);},true);
 root.addEventListener('click',e=>{const link=e.target.closest('a[href^="#"]');if(!link)return;const section=root.querySelector(link.getAttribute('href'));if(section?.parentElement.matches('details'))section.parentElement.open=true;});
 root.addEventListener('invalid',e=>{let details=e.target.closest('details');while(details){details.open=true;details=details.parentElement.closest('details');}},true);
}
