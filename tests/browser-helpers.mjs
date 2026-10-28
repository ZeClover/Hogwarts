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
  await selectEditorStep(page,'Publicação');
  const details=page.locator('[data-compact-policy]').first();
  if(await details.count()&&await details.getAttribute('open')===null)await details.locator(':scope > summary').click();
}

// Secondary sections retain their state after saving. Open them only if closed.
export async function openDisclosure(page,title){
 const summary=page.getByText(title,{exact:true}).and(page.locator('summary'));
 if(!await summary.evaluate(el=>el.closest('details')?.open??false))await summary.click();
}

// Regression flows dismiss the new discovery overlay through its real UI.
// Dedicated discovery tests exercise the queue and persistence without this handler.
export async function dismissIncidentalDiscoveries(page,keepClues=false){
 if(page.__discoveryDismissal)return;page.__discoveryDismissal=true;
 const overlay=page.locator('.reveal-dialog:has([data-reveal-close])'+(keepClues?':not(:has-text("NOVA PISTA"))':''));
 await page.addLocatorHandler(overlay,async dialog=>{try{await dialog.locator('[data-reveal-close]').click({timeout:3000});}catch(error){if(await dialog.isVisible())throw error;}},{noWaitAfter:true});
}
