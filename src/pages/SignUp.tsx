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
  email: string;
  telegram: string;
}

const TELEGRAM_PATTERN = /^@[A-Za-z0-9_]{1,32}$/;

const SignUp = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const [serverError, setServerError] = useState<string | null>(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const onSubmit = async (data: FormValues) => {
    setServerError(null);

    // Подстраховка на случай обхода валидации браузером
    const telegram = (data.telegram || "").trim();
    if (!TELEGRAM_PATTERN.test(telegram)) {
      setServerError("Укажите Telegram в формате @username (5–32 символов, латиница/цифры/_)");
      return;
    }

    try {
      const res = await api.post("/panel/accounts/create", {
        email: data.email.trim(),
        login: data.username.trim(),
        password: data.password,
        telegram: telegram, // уже проверен, начинается с @
      });

      if (res.data?.access_token) {
        localStorage.setItem("access_token", res.data.access_token);
        await fetchMe(dispatch as any);
        navigate("/");
        return;
      }

      setServerError(res.data?.message || "Неожиданный ответ сервера");
    } catch (err: any) {
      setServerError(
        err?.response?.data?.message ||
          err?.message ||
          "Произошла ошибка, попробуйте снова"
      );
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[420px]">
        <h1 className="text-center text-lg sm:text-2xl font-semibold text-white">
          Регистрация
        </h1>

        <div className="flex flex-col gap-3 sm:gap-4 mt-5 mb-6">
          <div>
            <InputField
              autoComplete="email"
              placeholder="Email"
              className="w-full"
              {...register("email", {
                required: "Введите email",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Некорректный email",
                },
              })}
            />
            {errors.email && (
              <p className="text-[#ef5959] text-[12px] sm:text-xs mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

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
              placeholder="@username"
              autoComplete="off"
              className="w-full"
              {...register("telegram", {
                required: "Укажите ваш Telegram",
                pattern: {
                  value: TELEGRAM_PATTERN,
                  message:
                    "Формат: @username (1–32 символов, латиница/цифры/подчёркивание)",
                },
                validate: (v) => {
                  const value = (v || "").trim();
                  if (/^https?:\/\//i.test(value) || /t\.me\//i.test(value)) {
                    return "Не ссылка — только @username";
                  }
                  if (/\s/.test(value)) {
                    return "Без пробелов — только @username";
                  }
                  return true;
                },
              })}
            />
            {errors.telegram && (
              <p className="text-[#ef5959] text-[12px] sm:text-xs mt-1">
                {errors.telegram.message}
              </p>
            )}
          </div>

          <div>
            <InputField
              type="password"
              autoComplete="new-password"
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
          to="/sign-in"
        >
          У меня уже есть аккаунт
        </ActionButton>
      </form>
    </main>
  );
};

export default SignUp;
