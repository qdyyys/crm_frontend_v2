import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDispatch } from "react-redux";
import { clearUser } from "@/store/UserSlice";

export default function AdminHeader() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      ["token", "access_token", "refresh_token"].forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    } finally {
      dispatch(clearUser());
      navigate("/sign-in", { replace: true });
    }
  };

  return (
    <header className="glass-header">
      <div className="container mx-auto px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="logo-section flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="logo-icon shrink-0">
                <LayoutDashboard className="w-6 h-6 sm:w-[30px] sm:h-[30px]" />
              </div>
              <div className="min-w-0 leading-tight">
                <h1 className="font-bold text-white text-[15px] sm:text-2xl">
                  Админ панель
                </h1>
                <p className="text-[11px] sm:text-sm text-inactive">
                  Управление Telegram аккаунтами
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/"
              className="outline-none cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
            >
              <Settings size={16} />
              <span className="hidden xs:inline">Панель</span>
            </Link>

            <Button
              onClick={handleLogout}
              className="outline-none cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
              title="Выйти из аккаунта"
            >
              <LogOut size={16} />
              <span className="hidden xs:inline">Выйти</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
