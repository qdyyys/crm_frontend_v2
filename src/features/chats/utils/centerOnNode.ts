export function centerOnNode(
  container: HTMLElement,
  node: HTMLElement,
  {
    retries = 8,
    settleFrames = 2,
  }: { retries?: number; settleFrames?: number } = {}
) {
  let lastRectTop: number | null = null;
  let stableFrames = 0;

  const doCenter = () => {
    const cRect = container.getBoundingClientRect();
    const nRect = node.getBoundingClientRect();
    const delta = nRect.top + nRect.height / 2 - (cRect.top + cRect.height / 2);
    container.scrollTop += delta;

    const nowTop = nRect.top;
    if (lastRectTop !== null && Math.abs(nowTop - lastRectTop) < 0.5) {
      stableFrames += 1;
    } else {
      stableFrames = 0;
    }
    lastRectTop = nowTop;
  };

  return new Promise<void>((resolve) => {
    let left = retries;

    const step = () => {
      doCenter();

      if (stableFrames >= settleFrames) {
        resolve();
        return;
      }
      if (left-- <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };

    const start = () => requestAnimationFrame(step);

    if (document.fonts?.ready instanceof Promise) {
      document.fonts.ready.finally(start);
    } else {
      start();
    }
  });
}
