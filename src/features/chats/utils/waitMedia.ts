export function waitImagesInside(root: HTMLElement, timeoutMs = 1200) {
  const imgs = Array.from(root.querySelectorAll("img")).filter(
    (img: any) => !(img as HTMLImageElement).complete
  );

  if (!imgs.length) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let left = imgs.length;
    const done = () => --left <= 0 && resolve();
    const t = window.setTimeout(() => resolve(), timeoutMs);

    imgs.forEach((img) => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });

    Promise.resolve().then(() => {
      if (left === 0) {
        clearTimeout(t);
        resolve();
      }
    });
  });
}
