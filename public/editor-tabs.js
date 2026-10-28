const tabs=[['story','História'],['links','NPCs/locais'],['objectives','Objetivos'],['clues','Pistas'],['participants','Participantes'],['outcomes','Desfechos'],['rewards','Recompensas'],['publication','Publicação']];
const activeEditors=new Map();
function activate(editor,key){
  if(!tabs.some(([id])=>id===key))key='story';
  activeEditors.set(editor.dataset.editorKey,key);editor.dataset.editorActive=key;
  editor.querySelectorAll('[data-editor-panel]').forEach(panel=>{panel.hidden=!panel.dataset.editorPanel.split(' ').includes(key);});
  editor.querySelector('.workshop-editor').setAttribute('aria-labelledby','quest-tab-'+key);
  editor.querySelectorAll('[data-editor-tab]').forEach(tab=>{const active=tab.dataset.editorTab===key;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
  if(key==='links')editor.querySelector('[data-editor-panel="links"]')?.setAttribute('open','');
}

// Enhance the existing forms in place. Inputs keep their form association and
// DOM values when a tab changes; no save, render or API mutation is triggered.
export function enhanceQuestEditor(root,state){
  if(state.session?.role!=='MASTER'||state.view||!/^\/portal\/mestre\/oficinas\/missoes\/[^/]+$/.test(state.page)||state.page.endsWith('/novo'))return;
  const grid=root.querySelector('.workshop-editor'),form=grid?.querySelector('[data-campaign-form="profile"]');if(!grid||!form)return;
  const editor=document.createElement('section');editor.className='quest-tabbed-editor';editor.dataset.editorKey=state.page;
  grid.before(editor);editor.append(grid);
  form.dataset.editorPanel='story links publication';
  for(const field of form.querySelector('.editor-fields').children){
    if(field.matches('.field'))field.dataset.editorPanel='story';
    if(field.matches('details'))field.dataset.editorPanel=field.hasAttribute('data-compact-policy')?'publication':field.querySelector('[name="npcId"]')?'links':'story';
    if(field.matches('p.subtle'))field.dataset.editorPanel='publication';
  }
  const sidebar=grid.querySelector('.editor-sidebar');
  sidebar?.querySelectorAll(':scope > section').forEach(section=>{section.dataset.editorPanel=section.classList.contains('campaign-access')?'participants':'publication';});
  const confirm=grid.querySelector('#campaign-confirm');
  if(confirm){const shared=document.createElement('section');shared.className='editor-confirm';shared.append(confirm);editor.prepend(shared);}
  const operations=grid.querySelector('.quest-operations');
  if(operations){operations.dataset.editorPanel='objectives clues outcomes';operations.querySelectorAll('.quest-operation-panel').forEach(section=>{const action=section.querySelector('form')?.dataset.campaignForm;section.dataset.editorPanel=action==='outcome'?'outcomes':action==='clue-reveal'||section.querySelector('h3')?.textContent==='Pistas'?'clues':'objectives';});}
  const rewards=document.createElement('section');rewards.className='card quest-operation-panel inline-quest-rewards';rewards.dataset.editorPanel='rewards';rewards.dataset.questRewards='';rewards.dataset.questId=state.page.split('/').pop();rewards.innerHTML='<h2 class="head2">Recompensas</h2><p class="subtle">Prepare, edite e entregue as recompensas desta missão aqui.</p><div data-inline-rewards-content></div>';grid.firstElementChild.append(rewards);
  const nav=document.createElement('div');nav.className='editor-step-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Etapas da missão');
  grid.id='quest-editor-panels';grid.setAttribute('role','tabpanel');grid.tabIndex=0;
  for(const [key,title] of tabs){const tab=document.createElement('button');tab.type='button';tab.id='quest-tab-'+key;tab.dataset.editorTab=key;tab.setAttribute('role','tab');tab.textContent=title;tab.setAttribute('aria-controls',grid.id);nav.append(tab);}
  editor.prepend(nav);activate(editor,activeEditors.get(state.page)??'story');
}

export function attachEditorTabs(root){
  root.addEventListener('click',e=>{const open=e.target.closest('[data-open-quest-rewards]');if(open){const editor=root.querySelector('.quest-tabbed-editor');if(editor){activate(editor,'rewards');editor.querySelector('[data-editor-tab=rewards]').focus();}return;}const tab=e.target.closest('[data-editor-tab]');if(tab)activate(tab.closest('.quest-tabbed-editor'),tab.dataset.editorTab);});
  root.addEventListener('keydown',e=>{const tab=e.target.closest('[data-editor-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const editor=tab.closest('.quest-tabbed-editor'),buttons=[...editor.querySelectorAll('[data-editor-tab]')],index=buttons.indexOf(tab),next=buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length];activate(editor,next.dataset.editorTab);next.focus();});
  root.addEventListener('invalid',e=>{const editor=e.target.closest('.quest-tabbed-editor'),panel=e.target.closest('[data-editor-panel]');if(!editor||!panel)return;activate(editor,panel.dataset.editorPanel.split(' ')[0]);let details=e.target.closest('details');while(details){details.open=true;details=details.parentElement.closest('details');}},true);
}
