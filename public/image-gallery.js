// Uses the existing private workshop files. Only the Mestre can load this catalogue.
export function createImageGallery({api,state,esc,toast}) {
 let dialog=null,returnFocus=null;
 function close(){dialog?.close();dialog?.remove();dialog=null;if(returnFocus?.isConnected)returnFocus.focus();}
 async function open(select,button){
  if(dialog||state.session?.role!=='MASTER'||state.view)return;
  returnFocus=button;dialog=document.createElement('dialog');dialog.className='image-gallery';dialog.setAttribute('aria-label','Escolher imagem');
  dialog.innerHTML=`<div class="gallery-heading"><h2 class="head2">Escolher imagem</h2><button class="btn ghost" type="button" data-gallery-close>Fechar galeria</button></div><p class="subtle">Escolha uma miniatura ou envie uma imagem. O arquivo poderá ser reutilizado em outros conteúdos.</p><div class="gallery-tools"><label class="field">Buscar imagem<input type="search" data-gallery-search maxlength="180"></label><label class="field">Origem<select data-gallery-category aria-label="Origem"><option value="">Todas as imagens</option><option value="project">Imagens do projeto</option><option value="uploads">Biblioteca do Mestre</option></select></label><label class="btn ghost gallery-upload">Enviar nova imagem<input type="file" data-gallery-upload accept="image/jpeg,image/png,image/webp"></label></div><p class="form-error" role="alert"></p><div class="gallery-grid" aria-label="Imagens disponíveis" aria-busy="true"></div><div class="gallery-selection" aria-live="polite"></div><div class="group"><button class="btn" type="button" data-gallery-use disabled>Usar imagem</button><button class="btn ghost" type="button" data-gallery-remove>Remover imagem</button></div>`;
  const modal=dialog;document.body.append(modal);modal.showModal();modal.querySelector('[data-gallery-close]').onclick=close;modal.addEventListener('cancel',e=>{e.preventDefault();close();});
  let items=[],selected=null,busy=false;const grid=modal.querySelector('.gallery-grid'),use=modal.querySelector('[data-gallery-use]'),error=modal.querySelector('.form-error');
  function choose(item){selected=item;modal.querySelector('.gallery-selection').innerHTML=`<img src="${esc(item.image)}" alt="Prévia: ${esc(item.name)}"><span>${esc(item.name)}</span>`;use.disabled=false;grid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(items[Number(b.dataset.index)]===selected)));}
  function list(){const normalized=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');const q=normalized(modal.querySelector('[data-gallery-search]').value),category=modal.querySelector('[data-gallery-category]').value;grid.setAttribute('aria-busy','false');grid.innerHTML=items.map((item,i)=>({item,i})).filter(({item})=>(!q||normalized(item.name).includes(q))&&(!category||item.category===category)).map(({item,i})=>`<button type="button" class="gallery-tile" data-index="${i}" aria-pressed="${selected===item}" aria-label="Selecionar ${esc(item.name)}"><img src="${esc(item.image)}" alt="" loading="lazy" decoding="async" width="160" height="110"><span>${esc(item.name)}</span></button>`).join('')||'<p class="subtle">Nenhuma imagem encontrada.</p>';grid.querySelectorAll('[data-index]').forEach(b=>b.onclick=()=>choose(items[Number(b.dataset.index)]));}
  function apply(file){
   if(!select.isConnected){close();return;}
   if(file&&!Array.from(select.options).some(o=>o.value===file.id))select.add(new window.Option(file.name,file.id));
   select.value=file?.id??'';
   // Clear the older upload/approved asset so it cannot override the gallery choice.
   const form=select.form;const uploadName=select.name.startsWith('payload.')?'upload.'+select.name:select.name==='portraitFileId'?'upload':'upload';
   const oldUpload=form?.elements.namedItem(uploadName);if(oldUpload?.type==='file')oldUpload.value='';
   const quick=form?.elements.namedItem('quickPhoto');if(quick?.type==='file')quick.value='';
   const asset=form?.elements.namedItem('asset');if(asset)asset.value='';
   const altName=select.name.endsWith('.fileId')?select.name.slice(0,-6)+'alt':select.name==='portraitFileId'?'portraitAlt':'alt';
   const alt=form?.elements.namedItem(altName);if(file&&alt&&!alt.value)alt.value=file.name.replace(/\.[a-z0-9]+$/i,'');
   select.dispatchEvent(new window.Event('change',{bubbles:true}));select.dispatchEvent(new window.Event('input',{bubbles:true}));
   updatePreview(select,button,file?.image??null);close();
  }
  use.onclick=async()=>{if(busy||!selected)return;busy=true;use.disabled=true;error.textContent='';try{const file=selected.asset?await api('/api/master/workshop/files',{method:'POST',body:{asset:selected.asset}}):selected;if(!modal.isConnected)return;apply({...file,name:selected.name,image:file.image??selected.image});}catch(e){error.textContent=e.message;use.disabled=false;}finally{busy=false;}};
  modal.querySelector('[data-gallery-remove]').onclick=()=>apply(null);
  modal.querySelector('[data-gallery-search]').oninput=list;modal.querySelector('[data-gallery-category]').onchange=list;
  modal.querySelector('[data-gallery-upload]').onchange=async e=>{const file=e.target.files?.[0];if(!file||busy)return;busy=true;use.disabled=true;error.textContent='';try{if(file.size>2*1024*1024)throw new Error('Escolha uma imagem de até 2 MB.');const saved=await api('/api/master/workshop/files',{method:'POST',body:file,raw:true});if(!modal.isConnected)return;const item={...saved,name:saved.name||file.name,category:'uploads'};items.unshift(item);modal.querySelector('[data-gallery-search]').value='';modal.querySelector('[data-gallery-category]').value='uploads';list();choose(item);}catch(e){error.textContent=e.message;}finally{busy=false;use.disabled=!selected;}};
  try{items=(await api('/api/master/workshop/gallery')).items;if(!modal.isConnected)return;list();const chosen=items.find(i=>i.id===select.value);if(chosen)choose(chosen);modal.querySelector('[data-gallery-search]').focus();}catch(e){error.textContent=e.message;grid.setAttribute('aria-busy','false');toast(e.message,true);}
 }
 function updatePreview(select,button,image){const wrap=button.parentElement;wrap.querySelector('.gallery-chosen-preview')?.remove();if(image){const img=document.createElement('img');img.className='gallery-chosen-preview';img.src=image;img.alt='Imagem escolhida';img.width=160;img.height=100;wrap.append(img);}button.textContent=select.value?'Alterar imagem':'Adicionar imagem';}
 function enhance(root){
  if(dialog&&!returnFocus?.isConnected)close();
  if(state.session?.role!=='MASTER'||state.view)return;
  for(const select of root.querySelectorAll('select[name="fileId"],select[name="portraitFileId"],select[name$=".fileId"]')){
   if(select.dataset.galleryReady||select.disabled)continue;select.dataset.galleryReady='true';
   const wrap=document.createElement('div');wrap.className='inline-image-choice';const button=document.createElement('button');button.type='button';button.className='btn ghost';wrap.append(button);const field=select.closest('.field'),details=field.closest('details');if(details&&['fileId','portraitFileId','payload.fileId'].includes(select.name))details.before(wrap);else field.before(wrap);button.onclick=()=>void open(select,button);
   updatePreview(select,button,select.value?'/api/master/workshop/files/'+encodeURIComponent(select.value):null);
   select.addEventListener('change',()=>updatePreview(select,button,select.value?'/api/master/workshop/files/'+encodeURIComponent(select.value):null));
  }
 }
 return {enhance};
}
