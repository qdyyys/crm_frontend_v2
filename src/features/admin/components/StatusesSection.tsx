import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InputField from "@/components/InputField";
import { Plus, Trash2, RefreshCcw, Tags, Droplet } from "lucide-react";
import { toast } from "sonner";
import {
  fetchStatuses,
  addStatus,
  deleteStatus,
  type AdminStatus,
} from "@/features/admin/services/statuses";

export default function StatusesSection() {
  const me = useSelector((s: RootState) => s.user.user);
  const isAdmin = Array.isArray((me as any)?.perms)
    ? (me as any).perms.includes("admin") ||
      (me as any).perms.includes("chief_admin")
    : false;

  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<AdminStatus[]>([]);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#2b5278");

  const [busyBtn, setBusyBtn] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const list = await fetchStatuses();
      setStatuses(list);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Не удалось получить статусы";
      toast.error(msg);
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const onAdd = async () => {
    const status = newName.trim();
    const color = String(newColor || "").trim();
    if (!status) return toast.warning("Укажите название статуса");
    if (!color) return toast.warning("Выберите цвет статуса");
    try {
      setBusyBtn("add");
      await addStatus({ status, color });
      toast.success("Статус добавлен");
      setNewName("");
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Не удалось добавить статус";
      toast.error(msg);
    } finally {
      setBusyBtn(null);
    }
  };

  const onDelete = async (statusName: string) => {
    try {
      setBusyBtn(statusName);
      await deleteStatus(statusName);
      toast.success("Статус удалён");
      setStatuses((prev) => prev.filter((s) => s.status !== statusName));
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Не удалось удалить статус";
      toast.error(msg);
    } finally {
      setBusyBtn(null);
    }
  };

  const titleCount = useMemo(() => statuses.length, [statuses]);

  if (!isAdmin) return null;

  return (
    <Card className="modern-card">
      <CardHeader className="card-header">
        <CardTitle className="section-title">
          <div className="title-icon">
            <Tags className="w-5 h-5" />
          </div>
          <div>
            <h3>Статусы</h3>
            <p className="section-subtitle">
              Управление статусами для рассылок
            </p>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="card-content">
        {/* Add form */}
        <div className="rounded-xl border border-white/10 bg-[#0e1621] p-4 mb-4">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_auto_auto] items-end">
            <div>
              <p className="text-[#69b2f1] text-xs font-semibold mb-1">
                Название статуса
              </p>
              <InputField
                value={newName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewName(e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                  e.key === "Enter" && onAdd()
                }
                placeholder="Статус"
              />
            </div>

            <div className="flex items-center gap-2 md:justify-end">
              <div className="flex items-center gap-2">
                {/* ← оставляем только палитру */}
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#121a24] px-2 py-1">
                  <Droplet className="w-4 h-4 text-white/70" />
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-8 h-8 bg-transparent cursor-pointer"
                    title="Цвет статуса"
                  />
                </div>
              </div>

              <Button
                onClick={onAdd}
                disabled={busyBtn === "add"}
                className="outline-none cursor-pointer px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                variant="ghost"
                title="Добавить статус"
              >
                {busyBtn === "add" ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="rounded-xl border border-white/10 bg-[#0e1621] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-white/90 font-semibold">
              Доступные статусы ({titleCount})
            </div>
            <button
              onClick={load}
              className="ml-auto text-xs px-2 py-1 rounded-lg border border-white/10 hover:border-[#2b5278] cursor-pointer"
              title="Обновить"
            >
              <RefreshCcw size={15} />
            </button>
          </div>

          {loading ? (
            <div className="text-inactive text-sm">Загрузка…</div>
          ) : statuses.length === 0 ? (
            <div className="text-inactive text-sm">Пока нет статусов</div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-auto">
              {statuses.map((s) => {
                const key = s.status;
                const color = s.color || "#3b82f6";
                return (
                  <div
                    key={key}
                    className="px-3 py-2 rounded-lg border border-white/5 bg-[#101823] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <span
                        className="inline-block w-4 h-4 rounded-full border border-white/10 shrink-0"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                      <div className="min-w-0">
                        <div className="text-white/90 font-medium truncate">
                          {s.status}
                        </div>
                        <div className="text-xs text-inactive truncate">
                          Цвет: {color}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => onDelete(s.status)}
                      disabled={busyBtn === s.status}
                      className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                      variant="ghost"
                      title="Удалить статус"
                    >
                      {busyBtn === s.status ? (
                        <svg
                          className="w-4 h-4 animate-spin"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          ></path>
                        </svg>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
