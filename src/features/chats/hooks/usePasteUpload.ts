import { useEffect } from "react";

export function usePasteUpload(
  addFilesAsAttachments: (files: File[]) => void,
  deps: any[] = []
) {
  useEffect(() => {
    let lastTs = 0;

    const onPaste = (e: ClipboardEvent) => {
      const cd = e.clipboardData;
      if (!cd) return;

      const picked: File[] = [];
      const seen = new Set<string>();

      const push = (f: File | null | undefined) => {
        if (!f) return;
        if (!/^image\//i.test(f.type)) return;
        if (/image\/tiff/i.test(f.type)) return;

        const key = `${f.type}|${f.size}`;
        if (seen.has(key)) return;
        seen.add(key);
        picked.push(f);
      };

      for (const item of cd.items) {
        if (item.kind === "file") push(item.getAsFile() || undefined);
      }
      for (const f of Array.from(cd.files || [])) push(f);

      if (!picked.length) return;

      const now = Date.now();
      if (now - lastTs < 150) return;
      lastTs = now;

      e.preventDefault();
      addFilesAsAttachments(picked);
    };

    window.addEventListener("paste", onPaste as any, { capture: true } as any);
    return () =>
      window.removeEventListener(
        "paste",
        onPaste as any,
        {
          capture: true,
        } as any
      );
  }, deps);
}
