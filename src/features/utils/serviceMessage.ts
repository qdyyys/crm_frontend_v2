export const userDisplayName = (u?: any) => {
  if (!u) return "Кто-то";
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return full || u.username || `ID ${u.id}`;
};

const titleFromMessage = (m: any): string => {
  if (!m) return "сообщение";
  const text = String(m.text || "").trim();
  if (text) return text;

  const mediaArr: any[] = Array.isArray(m.media) ? m.media : [];
  if (mediaArr.length) {
    const has = (t: string) => mediaArr.some((x) => x?.type === t);

    if (has("photo")) return "фото";
    if (has("video")) return "видео";
    if (has("round_video")) return "круглое видео";
    if (has("sticker")) return "стикер";
    if (has("audio")) return "аудио";
    if (has("document")) return "документ";
    if (has("animation")) return "анимация";
    return "медиа";
  }
  return "сообщение";
};

const findById = (arr: any[], id: any) => {
  const numId = Number(id);
  return arr.find((m) => Number(m?.id) === numId) || null;
};

export const buildServiceLabel = (
  msg: any,
  sorted: any[],
  idx: number
): string => {
  const who = userDisplayName(msg.from_user);
  const base = String(msg.text || "").toLowerCase();

  const isUnpin =
    base.includes("откреплено") ||
    base.includes("открепил") ||
    base.includes("unpin");
  const isPin =
    base.includes("закреплено") ||
    base.includes("закрепил") ||
    base.includes("pin");

  if (isPin || isUnpin) {
    const pinnedId =
      msg.pinned_message_id ?? msg.pinned_id ?? msg.message_id ?? msg.target_id;
    let pinned = pinnedId ? findById(sorted, pinnedId) : null;

    if (!pinned) {
      const pickNeighbor = (): any | null => {
        for (let i = idx - 1; i >= 0; i--) {
          const m = sorted[i];
          if (m?.message_type !== "service_message") return m;
        }
        for (let i = idx + 1; i < sorted.length; i++) {
          const m = sorted[i];
          if (m?.message_type !== "service_message") return m;
        }
        return null;
      };
      pinned = pickNeighbor();
    }

    const pinnedTitle = titleFromMessage(pinned);
    return `${who} ${isUnpin ? "открепил(а)" : "закрепил(а)"} «${pinnedTitle}»`;
  }

  return msg.from_user ? `${who}: ${msg.text}` : String(msg.text || "Событие");
};
