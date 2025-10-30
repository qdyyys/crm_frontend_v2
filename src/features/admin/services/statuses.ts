import { api } from "@/lib/axios";

export type AdminStatus = {
  status: string;
  color: string;
};

export async function fetchStatuses(): Promise<AdminStatus[]> {
  const { data } = await api.get("/panel/accounts/admin/statuses");
  const list = (Array.isArray(data) ? data : data?.statuses) ?? [];
  return list as AdminStatus[];
}

export async function addStatus(payload: { status: string; color: string }) {
  const { data } = await api.post(
    "/panel/accounts/admin/statuses/add",
    payload
  );
  return data;
}

export async function deleteStatus(status: string) {
  const { data } = await api.post("/panel/accounts/admin/statuses/delete", {
    status,
  });
  return data;
}
