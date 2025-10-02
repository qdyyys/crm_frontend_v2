import { api } from "../lib/axios";
import { setUser, clearUser, setLoading } from "../store/UserSlice";
import type { AppDispatch } from "../store";

export const fetchMe = async (dispatch: AppDispatch) => {
  try {
    const res = await api.get("/panel/accounts/me");
    dispatch(setUser(res.data));
    return res.data;
  } catch {
    dispatch(clearUser());
    return null;
  }
};

export const checkAuth = async (dispatch: AppDispatch) => {
  dispatch(setLoading(true));
  try {
    await api.get("/panel/accounts/check");
    return await fetchMe(dispatch);
  } catch {
    dispatch(clearUser());
    return null;
  }
};
