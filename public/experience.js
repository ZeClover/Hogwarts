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
