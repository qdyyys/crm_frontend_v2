import { useEffect } from "react";

export function usePasteUpload(
  addFilesAsAttachments: (files: File[]) => void,
  deps: any[] = []
) {
  useEffect(() => {
    let lastTs = 0; // защита от мгновенного двойного вызова

    const onPaste = (e: ClipboardEvent) => {
      const cd = e.clipboardData;
      if (!cd) return;

      const picked: File[] = [];
      const seen = new Set<string>();

      const push = (f: File | null | undefined) => {
        if (!f) return;
        // только картинки
        if (!/^image\//i.test(f.type)) return;
        // macOS часто даёт PNG + TIFF — TIFF игнорим
        if (/image\/tiff/i.test(f.type)) return;

        const key = `${f.type}|${f.size}`;
        if (seen.has(key)) return; // дедуп между items/files
        seen.add(key);
        picked.push(f);
      };

      // 1) items
      for (const item of cd.items) {
        if (item.kind === "file") push(item.getAsFile() || undefined);
      }
      // 2) files (в некоторых браузерах дублирует items)
      for (const f of Array.from(cd.files || [])) push(f);

      if (!picked.length) return;

      // простая защита от двойного onPaste подряд
      const now = Date.now();
      if (now - lastTs < 150) return;
      lastTs = now;

      // не вставляем картинку как «текст»
      e.preventDefault();
      addFilesAsAttachments(picked);
    };

    // capture оставляем, чтобы успевать preventDefault до textarea
    window.addEventListener("paste", onPaste as any, { capture: true } as any);
    return () =>
      window.removeEventListener(
        "paste",
        onPaste as any,
        {
          capture: true,
        } as any
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
