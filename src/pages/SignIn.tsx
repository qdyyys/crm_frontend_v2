import { useForm } from "react-hook-form";
import InputField from "../components/InputField";
import ActionButton from "../components/ActionButton";
import { api } from "../lib/axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { fetchMe } from "../services/authService";

interface FormValues {
  username: string;
  password: string;
}

const SignIn = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<FormValues>();

  const [serverError, setServerError] = useState<string | null>(null);
  const [need2fa, setNeed2fa] = useState(false);
  const [twofaCode, setTwofaCode] = useState("");
  const [isSubmitting2fa, setIsSubmitting2fa] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    setNeed2fa(false);

    try {
      const res = await api.post("/panel/accounts/login", {
        login: data.username,
        password: data.password,
      });

      if (res.data?.access_token) {
        localStorage.setItem("access_token", res.data.access_token);
        await fetchMe(dispatch as any);
        navigate("/");
        return;
      }

      const status = res.data?.status || res.status;
      if (status === "2fa_required") {
        setNeed2fa(true);
        return;
      }

      setServerError(res.data?.message || "Неожиданный ответ сервера");
    } catch (err: any) {
      const status = err?.response?.data?.status;
      const msg = err?.response?.data?.message || err?.message;

      if (status === "2fa_required") {
        setNeed2fa(true);
        return;
      }
      setServerError(msg || "Ошибка входа, проверьте логин/пароль");
    }
  };

  const onSubmit2fa = async () => {
    setServerError(null);
    const login = getValues("username").trim();
    const password = getValues("password");
    const token = twofaCode.replace(/\D/g, "");

    if (!login || !password) {
      setServerError("Введите логин и пароль");
      return;
    }
    if (token.length < 6) {
      setServerError("Введите 6-значный код из приложения");
      return;
    }

    try {
      setIsSubmitting2fa(true);
      const res = await api.post("/panel/accounts/login/2fa", {
        login,
        password,
        token,
      });

      if (res.data?.access_token) {
        localStorage.setItem("access_token", res.data.access_token);
        await fetchMe(dispatch as any);
        navigate("/");
        return;
      }

      setServerError(res.data?.message || "Неожиданный ответ сервера");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Неверный код 2FA";
      setServerError(msg);
    } finally {
      setIsSubmitting2fa(false);
    }
  };

  const backToCreds = () => {
    setNeed2fa(false);
    setTwofaCode("");
    setServerError(null);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[420px]">
        <h1 className="text-center text-lg sm:text-2xl font-semibold text-white">
          Вход
        </h1>

        {!need2fa && (
          <>
            <div className="flex flex-col gap-3 sm:gap-4 mt-5 mb-6">
              <div>
                <InputField
                  autoComplete="username"
                  placeholder="Username"
                  className="w-full"
                  {...register("username", {
                    required: "Введите логин",
                    minLength: { value: 3, message: "Минимум 3 символа" },
                  })}
                />
                {errors.username && (
                  <p className="text-[#ef5959] text-[12px] sm:text-xs mt-1">
                    {errors.username.message}
                  </p>
                )}
              </div>

              <div>
                <InputField
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  className="w-full"
                  {...register("password", {
                    required: "Введите пароль",
                    minLength: { value: 6, message: "Минимум 6 символов" },
                  })}
                />
                {errors.password && (
                  <p className="text-[#ef5959] text-[12px] sm:text-xs mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {serverError && (
              <p className="text-red-400 text-center mb-4 text-[12px] sm:text-xs">
                {serverError}
              </p>
            )}

            <ActionButton className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Загрузка..." : "Продолжить"}
            </ActionButton>

            <ActionButton
              as="link"
              variant="link"
              className="mt-3 w-full text-center"
              to="/sign-up"
            >
              Регистрация
            </ActionButton>
          </>
        )}

        {need2fa && (
          <>
            <div className="flex flex-col gap-4 mt-5 mb-6">
              <div>
                <InputField
                  placeholder="Код из приложения (6 цифр)"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  value={twofaCode}
                  onChange={(e: any) =>
                    setTwofaCode(String(e.target.value).replace(/\D/g, ""))
                  }
                  className="w-full text-center"
                />
                <p className="text-[12px] sm:text-xs text-center text-white/60 mt-2">
                  Введите одноразовый код из приложения-аутентификатора.
                </p>
              </div>
            </div>

            {serverError && (
              <p className="text-red-400 text-center mb-4 text-[12px] sm:text-xs">
                {serverError}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <ActionButton
                onClick={onSubmit2fa}
                disabled={isSubmitting2fa}
                className="w-full sm:w-auto"
              >
                {isSubmitting2fa ? "Проверяем..." : "Подтвердить"}
              </ActionButton>
              <ActionButton onClick={backToCreds} className="w-full sm:w-auto">
                Назад
              </ActionButton>
            </div>
          </>
        )}
      </form>
    </main>
  );
};

export default SignIn;
