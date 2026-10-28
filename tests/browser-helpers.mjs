// Audit the settled UI while keeping the normal entrance animations enabled.
// Infinite decorative animations must not block accessibility checks.
export async function settleAnimations(page) {
  await page.evaluate(async () => {
    const animations = window.document.getAnimations().filter(animation =>
      animation.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  });
}

export async function selectEditorStep(page,name){
  const tab=page.getByRole('tab',{name,exact:true});
  const path=new URL(page.url()).pathname;
  if(/^\/portal\/mestre\/oficinas\/missoes\/(?!novo(?:\/|$))[^/]+(?:\/|$)/.test(path)){await tab.waitFor({state:'visible'});await tab.click();}
  else if(await tab.count())await tab.click();
}
export async function saveDraft(page){
 const unified=page.getByRole('button',{name:'Salvar',exact:true});
 await (await unified.count()?unified:page.getByRole('button',{name:'Salvar rascunho',exact:true})).click();
}
export async function openPolicy(page){
  await selectEditorStep(page,await page.locator('.office-tabbed-editor').count()?'Acesso':'Publicação');
  const details=page.locator('[data-compact-policy]').first();
  if(await details.count()&&await details.getAttribute('open')===null)await details.locator(':scope > summary').click();
}

// Secondary sections retain their state after saving. Open them only if closed.
export async function openDisclosure(page,title){
 const summary=page.getByText(title,{exact:true}).and(page.locator('summary'));
 await revealOfficeField(page,summary);
 if(!await summary.evaluate(el=>el.closest('details')?.open??false))await summary.click();
}
export async function revealOfficeField(page,field){
 const chain=await field.evaluate(el=>{const rows=[];for(let node=el;node;node=node.parentElement){if(node.dataset.officePanel){const owner=node.closest('.office-tabbed-editor');if(owner)rows.push({key:owner.dataset.officeKey,panel:node.dataset.officePanel.split(' ')[0]});}}return rows.reverse();});
 for(const row of chain){const editors=page.locator('.office-tabbed-editor').filter({has:page.locator('[data-office-tab="'+row.panel+'"]')});const editor=editors.filter({has:page.locator('[data-office-tab]')});const matching=await editor.evaluateAll((nodes,key)=>nodes.findIndex(n=>n.dataset.officeKey===key),row.key);if(matching>=0)await editor.nth(matching).locator(':scope>.office-editor-toolbar [data-office-tab="'+row.panel+'"]').click();}
}
export async function officeAction(target,method,...args){await revealOfficeField(target.page(),target);return target[method](...args);}
export async function officeSubmit(target){const page=target.page(),unified=page.getByRole('button',{name:'Salvar',exact:true});if(await unified.count())return unified.click();return target.click();}

// Regression flows dismiss the new discovery overlay through its real UI.
// Dedicated discovery tests exercise the queue and persistence without this handler.
export async function dismissIncidentalDiscoveries(page,keepClues=false){
 if(page.__discoveryDismissal)return;page.__discoveryDismissal=true;
 const overlay=page.locator('.reveal-dialog:has([data-reveal-close])'+(keepClues?':not(:has-text("NOVA PISTA"))':''));
 await page.addLocatorHandler(overlay,async dialog=>{try{await dialog.locator('[data-reveal-close]').click({timeout:3000});}catch(error){if(await dialog.isVisible())throw error;}},{noWaitAfter:true});
}
