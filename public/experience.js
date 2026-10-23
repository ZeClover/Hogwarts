// Enhancements decorate only records already authorized by the existing APIs.
// They never obtain permissions, make writes or populate the campaign.
export function attachImageFallback(root){
 root.addEventListener('error',event=>{const img=event.target;if(img?.tagName!=='IMG'||img.dataset.failed)return;img.dataset.failed='true';const fallback=document.createElement('span');fallback.className='image-fallback';if(img.alt){fallback.setAttribute('role','img');fallback.setAttribute('aria-label',img.alt);fallback.textContent='✧';}else fallback.setAttribute('aria-hidden','true');img.replaceWith(fallback);},true);
}
export function enhanceExperience(root,state){
 const main=root.querySelector('main');if(!main)return;
 main.querySelectorAll('.vacant').forEach(el=>el.classList.add('themed-empty'));
 if(state.session?.role==='MASTER'&&!state.view){
  const art={'Narrativa':'correio_pergaminhos.webp','Mundo/NPCs':'hogwarts_claustro.webp','Hogwarts/Ensino':'aula_classe_ornamentada.webp','Comércio':'loja_olivaras.webp','Acervos/Coleções':'biblioteca_hogwarts.webp','Publicações':'correio_carta_hogwarts.webp','Sistema':'hogwarts_escadarias.webp'};
  main.querySelectorAll('.office-area>summary').forEach(summary=>{const file=art[summary.textContent.trim()];if(!file)return;const img=document.createElement('img');img.src='/assets/'+file;img.alt='';img.loading='lazy';summary.prepend(img);});
 }
}
export function organizeItemFields(root){
 const form=root.querySelector('[data-item-form="item"]');if(!form)return;
 const category=form.querySelector('[name=category]');
 const section=[...form.querySelectorAll('details')].find(d=>d.querySelector(':scope>summary')?.textContent==='Propriedades e fabricação');if(!section)return;
 const groups=[['appearance','Aparência e composição',['quality','materials','properties']],['use','Uso e magia',['magicDegree','activation','uses','frequency','requirements']],['craft','Fabricação',['craftingComplexity']],['circulation','Raridade e circulação',['availability','rarity']]];
 const note=document.createElement('p');note.className='subtle';note.dataset.itemTypeHelp='';section.prepend(note);
 for(const [key,title,names] of groups){const details=document.createElement('details');details.className='item-metadata-group';details.dataset.itemMetadata=key;const summary=document.createElement('summary');summary.textContent=title;details.append(summary);for(const name of names){const field=form.querySelector('[name='+name+']')?.closest('.field');if(field)details.append(field);}section.append(details);}
 function update(){const kind=category.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();note.textContent=/vestuario|roupa/.test(kind)?'Vestuário: comece por aparência e composição. Use magia apenas se a peça tiver efeitos.':/pocao|varinha|magico/.test(kind)?'Objeto mágico ou poção: descreva o uso e a magia quando forem relevantes. Nenhuma mecânica é aplicada automaticamente.':/livro/.test(kind)?'Livro: descreva o objeto aqui; páginas e leitura pertencem à oficina de Livros.':'Todos estes detalhes são opcionais e privados. Abra só o grupo que ajudar a descrever este item.';}
 category.addEventListener('input',update);update();
}
