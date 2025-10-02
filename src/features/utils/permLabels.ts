export const PERM_LABELS = {
  chief_admin: "Главный админ",
  manager: "Менеджер",
  shadow_manager: "Теневой менеджер",
  admin: "Админ",
} as const;

export type PermKey = keyof typeof PERM_LABELS;

function normalizePermKey(raw?: string | null): PermKey | null {
  if (!raw) return null;
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return key in PERM_LABELS ? (key as PermKey) : null;
}

export function permLabel(raw?: string | null): string {
  const k = normalizePermKey(raw);
  if (k) return PERM_LABELS[k];
  return (raw ?? "").trim() || "—";
}

export function formatPerms(perms?: unknown): string {
  if (!Array.isArray(perms) || perms.length === 0) return "—";
  const labels = Array.from(
    new Set(
      perms
        .map((p) => permLabel(typeof p === "string" ? p : String(p)))
        .filter(Boolean)
    )
  );
  return labels.length ? labels.join(", ") : "—";
}
