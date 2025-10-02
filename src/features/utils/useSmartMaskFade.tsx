import { useEffect } from "react";

export function useSmartMaskFade<E extends HTMLElement>(
  ref: React.RefObject<E | null>,
  edgePx: number = 12
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const px = `${edgePx}px`;

    const update = () => {
      const hasOverflow = el.scrollHeight - el.clientHeight > 1;
      if (!hasOverflow) {
        el.style.setProperty("--mask-top", "0px");
        el.style.setProperty("--mask-bottom", "0px");
        return;
      }

      const atTop = el.scrollTop <= 1;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      el.style.setProperty("--mask-top", atTop ? "0px" : px);
      el.style.setProperty("--mask-bottom", atBottom ? "0px" : px);
    };

    update();

    el.addEventListener("scroll", update, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);

    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });

    window.addEventListener("resize", update);

    return () => {
      el.removeEventListener("scroll", update as any);
      window.removeEventListener("resize", update);
      ro?.disconnect();
      mo.disconnect();
    };
  }, [ref, edgePx]);
}
