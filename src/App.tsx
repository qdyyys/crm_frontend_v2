import { Route, Routes } from "react-router-dom";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ProtectedRoute from "./components/ProtectedRoute";
import { useEffect } from "react";
import { checkAuth } from "./services/authService";
import { useDispatch } from "react-redux";
import PublicRoute from "./components/PublicRoute";
import Panel from "@/pages/Panel";
import Chats from "./pages/Chats";
import AdminPanel from "./pages/Admin";
function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    checkAuth(dispatch);
  }, []);

  return (
    <Routes>
      {/* public */}
      <Route
        path="/sign-in"
        element={
          <PublicRoute>
            <SignIn />
          </PublicRoute>
        }
      />
      <Route
        path="/sign-up"
        element={
          <PublicRoute>
            <SignUp />
          </PublicRoute>
        }
      />

      {/* private */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Panel />
          </ProtectedRoute>
        }
      />

      <Route
        path="/chats"
        element={
          <ProtectedRoute>
            <Chats />
          </ProtectedRoute>
        }
      />

      <Route
        path="/panel"
        element={
          <ProtectedRoute requireAnyRole={["admin", "chief_admin"]}>
            <AdminPanel />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
