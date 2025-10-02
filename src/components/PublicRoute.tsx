import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import type { RootState } from "../store";
import type { JSX } from "react";
import { Loader } from "./Loader";

export default function PublicRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useSelector(
    (state: RootState) => state.user
  );

  if (isLoading) return <Loader />;

  if (isAuthenticated) return <Navigate to="/" replace />;

  return children;
}
