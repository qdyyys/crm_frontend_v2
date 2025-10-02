import type { JSX } from "react";
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import type { RootState } from "@/store";
import { Loader } from "./Loader";

type AllowedRole = "admin" | "chief_admin";

const hasAnyRole = (user: any, roles: AllowedRole[]) => {
  const userRoles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  const userPerms: string[] = Array.isArray(user?.perms) ? user.perms : [];
  return roles.some((r) => userRoles.includes(r) || userPerms.includes(r));
};

export default function ProtectedRoute({
  children,
  requireAnyRole,
}: {
  children: JSX.Element;
  requireAnyRole?: AllowedRole[];
}) {
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useSelector(
    (state: RootState) => state.user
  );

  if (isLoading) return <Loader />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  if (requireAnyRole?.length && !hasAnyRole(user, requireAnyRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
