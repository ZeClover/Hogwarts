export function createDelivery({api,state,refresh,navigate,esc}){
  let source=null,identity='',busy=false,dialog=null,queue=[],active=null,historyButton=null;
  function close(){dialog?.close();dialog?.remove();dialog=null;active=null;}
  function clear(){source?.close();source=null;close();historyButton?.remove();historyButton=null;queue=[];}
  async function acknowledge(){if(!active)return;const id=active.id;close();try{await api('/api/events/'+id+'/ack',{method:'POST'});}catch{/* The persistent event remains retryable. */}await receive();}
  function show(event){
    close();active=event;dialog=document.createElement('dialog');dialog.className='reveal-dialog';dialog.setAttribute('aria-label','Revelação');
    dialog.innerHTML=`<span class="eyebrow">UMA NOVA DESCOBERTA</span><h2 class="head2">${esc(event.title)}</h2><p class="biography">${esc(event.text)}</p><div class="group"><button class="btn" data-reveal-close>Continuar</button><button class="btn ghost" data-reveal-open>Abrir registro</button></div>`;
    document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();void acknowledge();});dialog.querySelector('[data-reveal-close]').onclick=()=>void acknowledge();dialog.querySelector('[data-reveal-open]').onclick=async()=>{const href=event.href;await acknowledge();await navigate(href);};dialog.showModal();dialog.querySelector('button').focus();
  }
  async function receive(){
    if(busy||!identity||active)return;busy=true;const recipient=identity;
    try{queue=(await api('/api/events',{preview:false})).items;await refresh();if(identity!==recipient)return;for(const event of queue){if(event.presentation==='SILENT')await api('/api/events/'+event.id+'/ack',{method:'POST',preview:false});else{show(event);break;}}}catch{/* Reconnect retries without granting anything. */}finally{busy=false;}
  }
  async function history(){
    if(active)return;const recipient=identity;try{const items=(await api('/api/events/history',{preview:false})).items;if(identity!==recipient)return;close();dialog=document.createElement('dialog');dialog.className='reveal-dialog';dialog.setAttribute('aria-label','Revelações conhecidas');dialog.innerHTML=`<h2 class="head2">Revelações conhecidas</h2>${items.length?items.map(e=>`<p><button class="btn ghost" data-history-id="${esc(e.id)}">${esc(e.title)}</button></p>`).join(''):'<p>Nenhuma revelação registrada.</p>'}<button class="btn" data-history-close>Fechar</button>`;document.body.append(dialog);dialog.querySelector('[data-history-close]').onclick=close;dialog.addEventListener('cancel',close);dialog.querySelectorAll('[data-history-id]').forEach(el=>{el.onclick=async()=>{try{const fresh=await api('/api/events/'+el.dataset.historyId,{preview:false});show(fresh);}catch{close();}};});dialog.showModal();}catch{/* Authentication is checked by the API. */}
  }
  function sync(){
    const next=state.session?.role==='PLAYER'&&!state.view?state.portal?.character?.id??'':'';if(next===identity)return;clear();identity=next;if(!next)return;
    historyButton=document.createElement('button');historyButton.className='btn ghost small reveal-history';historyButton.textContent='Revelações';historyButton.onclick=()=>void history();document.body.append(historyButton);
    source=new window.EventSource('/api/events/stream');source.onmessage=()=>void receive();source.onerror=()=>{/* Native EventSource reconnects. */};void receive();
  }
  return {sync};
}
