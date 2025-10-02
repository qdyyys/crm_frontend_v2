import { api } from "@/lib/axios";

export async function endWorkRequest() {
  const res = await api.post("/panel/accounts/end_work");
  return res.data;
}
