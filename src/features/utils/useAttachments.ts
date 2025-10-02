import { useState } from "react";
import { toast } from "sonner";
import type { AttachItem } from "../chats/types";

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as unknown as { randomUUID: () => string }).randomUUID()
    : Math.random().toString(36).slice(2);

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export function useAttachments() {
  const [attachments, setAttachments] = useState<AttachItem[]>([]);

  const addFilesAsAttachments = (files: FileList | File[]) => {
    const all = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    const rejected = Array.from(files).filter(
      (f) => !f.type.startsWith("image/") && !f.type.startsWith("video/")
    );
    if (rejected.length) toast.warning("Поддерживаются фото и видео");

    const free = Math.max(0, 10 - attachments.length);
    if (all.length > free) toast.warning("Макс. 10 медиа за сообщение");

    const take = all.slice(0, free);
    const next: AttachItem[] = take.map((f) => ({
      id: genId(),
      file: f,
      url: URL.createObjectURL(f),
      kind: f.type.startsWith("image/") ? "image" : "video",
    }));
    if (next.length)
      setAttachments((prev: AttachItem[]) => [...prev, ...next]);
  };

  const clearAttachments = () => {
    setAttachments((prev: AttachItem[]) => {
      prev.forEach((a) => URL.revokeObjectURL(a.url));
      return [];
    });
  };

  return {
    attachments,
    setAttachments,
    addFilesAsAttachments,
    clearAttachments,
  };
}
