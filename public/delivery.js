import {magicIcon,discoveryIcon,themedImage} from '/magic-icons.js';
export function createDelivery({api,state,refresh,navigate,esc}){
 let source=null,identity='',busy=false,dialog=null,active=null,historyButton=null,focusBefore=null,acting=false;
 const key=()=>`hogwarts:revelations:dismissed:${identity}`;
 const pending=()=>{try{return JSON.parse(window.localStorage.getItem(key())||'[]');}catch{return [];}};
 function remember(id){try{window.localStorage.setItem(key(),JSON.stringify([...new Set([...pending(),id])].slice(-500)));}catch{/* Server persistence still applies when online. */}}
 function forget(id){try{window.localStorage.setItem(key(),JSON.stringify(pending().filter(x=>x!==id)));}catch{/* Retry later. */}}
 function close(){dialog?.close();dialog?.remove();dialog=null;active=null;if(focusBefore?.isConnected)focusBefore.focus();}
 function clear(){source?.close();source=null;close();historyButton?.remove();historyButton=null;}
 async function ack(id){await api('/api/events/'+id+'/ack',{method:'POST',preview:false});forget(id);}
 async function acknowledge(href){if(!active||acting)return;acting=true;const id=active.id;remember(id);close();try{await ack(id);}catch{/* A per-character local receipt retries on reconnect, without replaying the animation. */}try{if(href)await navigate(href);}finally{acting=false;void receive();}}
 function show(event){
  close();focusBefore=document.activeElement;active=event;dialog=document.createElement('dialog');dialog.className='reveal-dialog';dialog.setAttribute('aria-label','Revelação');dialog.setAttribute('aria-labelledby','reveal-title');
  const kind=event.kind||'UMA NOVA DESCOBERTA',fallback=/CORRESPONDÊNCIA/.test(kind)?'correio_envelope.webp':/LIVRO|PÁGINA/.test(kind)?themedImage('books'): /MISSÃO|SIDE-QUEST/.test(kind)?'hogwarts_corredor_velas.webp':null;
  const image=event.image||(fallback?'/assets/'+fallback:null);
  dialog.innerHTML=`<div class="reveal-illustration">${image?`<img class="reveal-image" src="${esc(image)}" alt="${esc(event.image?event.alt??'':'')}">`:''}<span class="reveal-emblem">${magicIcon(discoveryIcon(kind),42)}</span></div><div class="reveal-copy"><span class="eyebrow">${esc(kind)}</span><h2 class="head2" id="reveal-title">${esc(event.title)}</h2><p class="biography">${esc(String(event.text??'').slice(0,280))}</p><div class="group"><button class="btn" data-reveal-open>Ver mais detalhes</button><button class="btn ghost" data-reveal-close>Fechar</button></div></div>`;
  document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();void acknowledge();});dialog.querySelector('[data-reveal-close]').onclick=()=>void acknowledge();dialog.querySelector('[data-reveal-open]').onclick=()=>void acknowledge(event.href);dialog.showModal();dialog.querySelector('[data-reveal-open]').focus();
 }
 async function receive(){
  if(busy||!identity||acting||document.hidden)return;busy=true;const recipient=identity;
  try{
   for(const id of pending()){try{await ack(id);}catch{/* Offline receipts remain queued. */}}
   const queue=(await api('/api/events',{preview:false})).items;if(identity!==recipient)return;
   if(active){if(!queue.some(e=>e.id===active.id)){try{await api('/api/events/'+active.id,{preview:false});}catch{close();}}if(active)return;}
   if(dialog||document.querySelector('dialog[open]'))return;
   if(!state.dirty)await refresh();if(identity!==recipient)return;
   for(const event of queue){if(pending().includes(event.id))continue;if(event.presentation==='SILENT')await ack(event.id);else{const fresh=await api('/api/events/'+event.id,{preview:false});if(identity===recipient)show(fresh);break;}}
  }catch{/* EventSource, polling and online callbacks retry through the same queue. */}finally{busy=false;}
 }
 async function history(){
  if(active||dialog)return;const recipient=identity;try{const items=(await api('/api/events/history',{preview:false})).items;if(identity!==recipient)return;focusBefore=document.activeElement;dialog=document.createElement('dialog');dialog.className='reveal-dialog reveal-history-dialog';dialog.setAttribute('aria-label','Revelações conhecidas');dialog.innerHTML=`<h2 class="head2">Revelações conhecidas</h2><p class="subtle">Fechar uma apresentação não marca o conteúdo como lido.</p>${items.length?items.map(e=>`<p><button class="btn ghost" data-history-id="${esc(e.id)}">${magicIcon(discoveryIcon(e.kind))}${esc(e.title)}</button></p>`).join(''):'<p>Nenhuma revelação registrada.</p>'}<button class="btn" data-history-close>Fechar</button>`;document.body.append(dialog);dialog.querySelector('[data-history-close]').onclick=()=>{close();void receive();};dialog.addEventListener('cancel',e=>{e.preventDefault();close();void receive();});dialog.querySelectorAll('[data-history-id]').forEach(el=>{el.onclick=async()=>{try{const fresh=await api('/api/events/'+el.dataset.historyId,{preview:false});show(fresh);}catch{close();}};});dialog.showModal();}catch{/* Authentication and current permission are checked by the API. */}
 }
 function sync(){
  const next=state.session?.role==='PLAYER'&&!state.view?state.portal?.character?.id??'':'';if(next===identity)return;clear();identity=next;if(!next)return;
  historyButton=document.createElement('button');historyButton.className='btn ghost small reveal-history';historyButton.innerHTML=magicIcon('wand',18)+'Revelações';historyButton.onclick=()=>void history();document.body.append(historyButton);
  source=new window.EventSource('/api/events/stream');source.onmessage=()=>void receive();void receive();
 }
 window.addEventListener('online',()=>void receive());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void receive();});setInterval(()=>void receive(),15000);
 return {sync};
}
