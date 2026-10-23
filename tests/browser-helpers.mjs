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
export async function openPolicy(page){
  await selectEditorStep(page,'Publicação');
  const details=page.locator('[data-compact-policy]').first();
  if(await details.count()&&await details.getAttribute('open')===null)await details.locator(':scope > summary').click();
}
