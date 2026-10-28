const tabs=[['story','História'],['links','NPCs/locais'],['objectives','Objetivos'],['clues','Pistas'],['participants','Participantes'],['outcomes','Desfechos'],['rewards','Recompensas'],['certificates','Certificados'],['publication','Publicação']];
const draftForms='[data-campaign-form="profile"],[data-campaign-form="inline-objective"],[data-campaign-form="inline-clue"],[data-inline-reward-form],[data-inline-certificate-form]';
const activeEditors=new Map();
function revealActiveTab(editor){const nav=editor.querySelector('.editor-step-tabs'),tab=nav?.querySelector('[aria-selected="true"]');if(!tab||nav.scrollWidth<=nav.clientWidth)return;const n=nav.getBoundingClientRect(),t=tab.getBoundingClientRect();if(t.left<n.left)nav.scrollLeft-=n.left-t.left;else if(t.right>n.right)nav.scrollLeft+=t.right-n.right;}
function activate(editor,key){
  if(!tabs.some(([id])=>id===key))key='story';
  activeEditors.set(editor.dataset.editorKey,key);editor.dataset.editorActive=key;
  editor.querySelectorAll('[data-editor-panel]').forEach(panel=>{panel.hidden=!panel.dataset.editorPanel.split(' ').includes(key);});
  editor.querySelector('.workshop-editor').setAttribute('aria-labelledby','quest-tab-'+key);
  editor.querySelectorAll('[data-editor-tab]').forEach(tab=>{const active=tab.dataset.editorTab===key;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
  revealActiveTab(editor);
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
  const certificates=document.createElement('section');certificates.className='card quest-operation-panel inline-quest-certificates';certificates.dataset.editorPanel='certificates';certificates.dataset.questCertificates='';certificates.dataset.questId=rewards.dataset.questId;certificates.innerHTML='<h2 class="head2">Certificados</h2><p class="subtle">Prepare os documentos, confira o PDF e libere ao titular aqui.</p><div data-inline-certificates-content></div>';grid.firstElementChild.append(certificates);
  const nav=document.createElement('div');nav.className='editor-step-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Etapas da missão');
  grid.id='quest-editor-panels';grid.setAttribute('role','tabpanel');grid.tabIndex=0;
  for(const [key,title] of tabs){const tab=document.createElement('button');tab.type='button';tab.id='quest-tab-'+key;tab.dataset.editorTab=key;tab.setAttribute('role','tab');tab.textContent=title;tab.setAttribute('aria-controls',grid.id);nav.append(tab);}
  const toolbar=document.createElement('div');toolbar.className='quest-editor-toolbar';toolbar.append(nav);const actions=document.createElement('div');actions.className='quest-save-actions';actions.innerHTML='<button class="btn" type="button" data-quest-save>Salvar</button><span class="subtle" data-quest-save-status role="status" aria-live="polite">Alterações da missão</span>';toolbar.append(actions);editor.prepend(toolbar);root.querySelector('[data-open-quest-rewards]')?.remove();activate(editor,activeEditors.get(state.page)??'story');
}

export function attachQuestSave(root,{state,toast,campaignOffice,questRewards,questCertificates}){
 let failed=false;
 function enhance(){
  const editor=root.querySelector('.quest-tabbed-editor');if(!editor)return;
  for(const form of editor.querySelectorAll(draftForms))for(const button of form.querySelectorAll('button[type="submit"]')){const wrapper=button.closest('.action-with-caption');if(wrapper)wrapper.remove();else button.remove();}
  editor.style.setProperty('--quest-toolbar-top',(root.querySelector('.top')?.offsetHeight??0)+'px');
  revealActiveTab(editor);
  const status=editor.querySelector('[data-quest-save-status]'),text=state.questSaving?'Salvando…':failed?'Confira as alterações pendentes':state.dirty||state.objectiveDirty||state.clueDirty||state.rewardDirty||state.certificateDirty?'Alterações não salvas':status.textContent==='Alterações salvas'?'Alterações salvas':'Alterações da missão';if(status.textContent!==text)status.textContent=text;
 }
 function reveal(form){const editor=form?.closest('.quest-tabbed-editor'),panel=form?.closest('[data-editor-panel]');if(editor&&panel)activate(editor,panel.dataset.editorPanel.split(' ')[0]);}
 async function save(){
  const editor=root.querySelector('.quest-tabbed-editor');if(!editor||state.busy||state.questSaving)return;
  for(const form of editor.querySelectorAll(draftForms))if(!form.reportValidity())return;
  try{questRewards.validateDraft();}catch(e){reveal(e.questForm);e.questForm?.querySelector('[role=alert]')?.focus();return;}
  const path=state.page,csrf=state.session.csrf,grid=editor.querySelector('.workshop-editor'),button=editor.querySelector('[data-quest-save]');
  state.questSaving=true;state.busy=true;failed=false;button.disabled=true;button.setAttribute('aria-busy','true');grid.inert=true;enhance();
  const check=()=>{if(state.page!==path||state.session?.csrf!==csrf)throw new Error('A página mudou durante o salvamento.');};
  try{await campaignOffice.saveDrafts(root);check();await questRewards.saveDraft();check();await questCertificates.saveDraft();check();const status=editor.querySelector('[data-quest-save-status]');status.textContent='Alterações salvas';toast('Alterações salvas.');}
  catch(e){if(state.page===path&&state.session?.csrf===csrf){failed=true;grid.inert=false;reveal(e.questForm);e.questForm?.querySelector('[role=alert]')?.focus();toast(e.message,true);}}
  finally{state.questSaving=false;state.busy=false;grid.inert=false;button.disabled=false;button.removeAttribute('aria-busy');if(failed)enhance();else if(editor.isConnected)editor.querySelector('[data-quest-save-status]').textContent='Alterações salvas';}
 }
 root.addEventListener('click',e=>{if(e.target.closest('[data-quest-save]'))void save();});
 root.addEventListener('submit',e=>{if(e.target.matches(draftForms)&&e.target.closest('.quest-tabbed-editor')){e.preventDefault();e.stopImmediatePropagation();void save();}},true);
 const changed=e=>{if(e.target.closest('.quest-tabbed-editor')){failed=false;window.queueMicrotask(enhance);}};root.addEventListener('input',changed);root.addEventListener('change',changed);
 new window.MutationObserver(enhance).observe(root,{childList:true,subtree:true});window.addEventListener('resize',enhance);
 root.addEventListener('keydown',e=>{if(e.target.closest('.quest-tabbed-editor')&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void save();}});
}

export function attachEditorTabs(root){
  root.addEventListener('click',e=>{const open=e.target.closest('[data-open-quest-rewards]');if(open){const editor=root.querySelector('.quest-tabbed-editor');if(editor){activate(editor,'rewards');editor.querySelector('[data-editor-tab=rewards]').focus();}return;}const tab=e.target.closest('[data-editor-tab]');if(tab)activate(tab.closest('.quest-tabbed-editor'),tab.dataset.editorTab);});
  root.addEventListener('keydown',e=>{const tab=e.target.closest('[data-editor-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const editor=tab.closest('.quest-tabbed-editor'),buttons=[...editor.querySelectorAll('[data-editor-tab]')],index=buttons.indexOf(tab),next=buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length];activate(editor,next.dataset.editorTab);next.focus();});
  root.addEventListener('invalid',e=>{const editor=e.target.closest('.quest-tabbed-editor'),panel=e.target.closest('[data-editor-panel]');if(!editor||!panel)return;activate(editor,panel.dataset.editorPanel.split(' ')[0]);let details=e.target.closest('details');while(details){details.open=true;details=details.parentElement.closest('details');}},true);
}
