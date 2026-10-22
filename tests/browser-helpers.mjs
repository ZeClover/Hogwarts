// Audit the settled UI while keeping the normal entrance animations enabled.
// Infinite decorative animations must not block accessibility checks.
export async function settleAnimations(page) {
  await page.evaluate(async () => {
    const animations = window.document.getAnimations().filter(animation =>
      animation.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  });
}
