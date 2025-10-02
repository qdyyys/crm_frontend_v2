import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import type { ReactNode } from "react";

/** нормализация прав: "Chief-Admin" -> "chief_admin" */
export const normalizePerm = (p?: string | null) =>
  (p ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

/** проверка одного права */
export const hasPerm = (
  holder: { perms?: string[] } | string[] | null | undefined,
  perm: string
) => {
  if (!perm) return false;
  const list = Array.isArray(holder) ? holder : holder?.perms ?? [];
  const norm = list.map(normalizePerm);
  return norm.includes(normalizePerm(perm));
};

/** проверка любого из набора */
export const hasAnyPerm = (
  holder: { perms?: string[] } | string[] | null | undefined,
  anyOf: string[]
) => anyOf.some((p) => hasPerm(holder, p));

/** удобный хук */
export const usePerms = () => {
  const user = useSelector((s: RootState) => s.user.user);
  return {
    user,
    perms: user?.perms ?? [],
    can: (p: string) => hasPerm(user, p),
    canAny: (arr: string[]) => hasAnyPerm(user, arr),
  };
};

/** условный рендер */
export const IfPerm = ({
  perm,
  anyOf,
  fallback = null,
  children,
}: {
  perm?: string;
  anyOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) => {
  const { can, canAny } = usePerms();
  const ok = anyOf?.length ? canAny(anyOf) : perm ? can(perm) : false;
  return <>{ok ? children : fallback}</>;
};
