import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Check,
  Phone,
  Settings,
  Shield,
  X,
  BadgePlus,
  ChevronDown,
} from "lucide-react";
import {
  getStatus,
  sendCode,
  sendPassword,
  sendPhone,
  startAuth,
  type ProxyData,
} from "../services/telegramAuth";
import InputField from "@/components/InputField";

type Step = "list" | "proxyAsk" | "proxyForm" | "phone" | "code" | "password";

const PROXY_TYPES: ProxyData["type"][] = [
  "http",
  "https",
  "socks4",
  "socks4a",
  "socks5",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ErrorText = ({ children }: { children?: React.ReactNode }) =>
  children ? (
    <p className="mt-1 text-[12px] leading-4 text-red-400">{children}</p>
  ) : null;

function ProxyTypeSelect({
  value,
  onChange,
  error,
  label = "Тип прокси",
}: {
  value: ProxyData["type"];
  onChange: (v: ProxyData["type"]) => void;
  error?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(
    Math.max(
      0,
      PROXY_TYPES.findIndex((t) => t === value)
    )
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoverIdx((i) => (i + 1) % PROXY_TYPES.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIdx((i) => (i - 1 + PROXY_TYPES.length) % PROXY_TYPES.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const v = PROXY_TYPES[hoverIdx] ?? value;
      onChange(v);
      setOpen(false);
    }
  };

  const currentLabel = value.toUpperCase();

  return (
    <div className="w-full" ref={wrapRef}>
      <Label className="text-[#69b2f1] text-xs font-semibold">{label}</Label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          onKeyDown={onKeyDown}
          className={`w-full mt-1 px-3 py-2 rounded-lg bg-[#121a24] border text-white/90 outline-none flex items-center justify-between
            ${
              error
                ? "border-red-500/60"
                : "border-[#1e2c3a] hover:border-[#2b5278]"
            }`}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="w-4 h-4 opacity-80" />
        </button>

        {open && (
          <ul
            role="listbox"
            tabIndex={-1}
            className="absolute left-0 top-[calc(100%+4px)] w-full z-50 rounded-lg border border-[#1e2c3a] bg-[#0e1621] shadow-xl overflow-hidden"
          >
            {PROXY_TYPES.map((opt, idx) => {
              const active = opt === value;
              const hovered = idx === hoverIdx;
              return (
                <li key={opt}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setHoverIdx(idx)}
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm
                      ${
                        active ? "bg-[#182432] text-[#9ec1ff]" : "text-white/90"
                      }
                      ${hovered ? "bg-[#17212b]" : ""}`}
                  >
                    {opt.toUpperCase()}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

type ProxyErrors = Partial<Record<keyof ProxyData, string>>;

function isValidHostnameOrIp(host: string) {
  const h = host.trim();

  if (h === "localhost") return true;

  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(h);
  if (ipv4) {
    return h.split(".").every((oct) => {
      const n = Number(oct);
      return n >= 0 && n <= 255;
    });
  }

  const hostname = /^(?=.{1,253}$)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/.test(
    h
  );
  return hostname;
}

function validateProxy(data: ProxyData): ProxyErrors {
  const errors: ProxyErrors = {};
  if (!PROXY_TYPES.includes(data.type)) {
    errors.type = "Некорректный тип.";
  }
  if (!data.host.trim()) {
    errors.host = "Укажитете хост.";
  } else if (!isValidHostnameOrIp(data.host)) {
    errors.host = "Некорректный хост или IP.";
  }

  const portNum = Number(data.port);
  if (!data.port.toString().trim()) {
    errors.port = "Укажитете порт.";
  } else if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    errors.port = "Порт должен быть числом 1–65535.";
  }

  const hasUser = Boolean(data.username?.trim());
  const hasPass = Boolean(data.password?.trim());
  if ((hasUser && !hasPass) || (!hasUser && hasPass)) {
    errors.username =
      "Укажитете и логин, и пароль, или оставьте оба поля пустыми.";
    errors.password = errors.username;
  }

  return errors;
}
const hasErrors = (e: ProxyErrors) => Object.keys(e).length > 0;

export default function AddTelegramAccountWizard({
  onAdded,
}: {
  onAdded: () => Promise<void> | void;
}) {
  const [step, setStep] = useState<Step>("list");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const [proxyData, setProxyData] = useState<ProxyData>({
    type: "http",
    host: "",
    port: "",
    username: "",
    password: "",
  });
  const [proxyErrors, setProxyErrors] = useState<ProxyErrors>({});

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password2FA, setPassword2FA] = useState("");

  const reset = () => {
    setStep("list");
    setSessionId(null);
    setAuthBusy(false);
    setAttemptsLeft(null);
    setProxyData({
      type: "http",
      host: "",
      port: "",
      username: "",
      password: "",
    });
    setProxyErrors({});
    setPhone("");
    setCode("");
    setPassword2FA("");
  };

  const handleStart = async (useProxy: boolean) => {
    try {
      const sid = await startAuth(useProxy, proxyData);
      setSessionId(sid);
      setStep("phone");
    } catch (e) {
      toast.error("Ошибка запуска аутентификации");
    }
  };

  const handlePhone = async () => {
    if (!sessionId || !phone.trim()) return;
    try {
      await sendPhone(sessionId, phone);
      setStep("code");
    } catch {
      toast.error("Ошибка отправки сообщения");
    }
  };

  const proceedByStatus = async (sid: string) => {
    const r = await getStatus(sid);
    const { status, required_input, message, attempts_left } = r || {};
    setAttemptsLeft(
      Number.isFinite(attempts_left as any) ? (attempts_left as number) : null
    );

    if (status === "success") {
      toast.success(message || "Аккаунт добавлен");
      await onAdded();
      reset();
      return;
    }
    const need = required_input || status;
    if (need === "password" || need === "password_required") {
      setStep("password");
      if (message) toast.info(message);
      return;
    }
    if (need === "code" || need === "code_required") {
      setStep("code");
      if (message) toast.info(message);
      return;
    }
    if (need === "phone" || need === "phone_required") {
      setStep("phone");
      if (message) toast.info(message);
    }
  };

  const handleCode = async () => {
    if (!sessionId || !code.trim()) return;
    try {
      setAuthBusy(true);
      await sendCode(sessionId, code);
      await sleep(1500);
      await proceedByStatus(sessionId);
    } catch {
      toast.error("Ошибка отправки кода");
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePassword = async () => {
    if (!sessionId || !password2FA.trim()) return;
    try {
      setAuthBusy(true);
      await sendPassword(sessionId, password2FA);
      setPassword2FA("");
      await sleep(1500);
      await proceedByStatus(sessionId);
    } catch {
      toast.error("Неверный пароль 2FA");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleStartWithProxyValidated = () => {
    const errs = validateProxy(proxyData);
    setProxyErrors(errs);
    if (hasErrors(errs)) {
      toast.error("Проверьте параметры прокси");
      return;
    }
    handleStart(true);
  };

  const proxyFormValid = !hasErrors(validateProxy(proxyData));

  return (
    <section>
      {step === "list" && (
        <Card className="modern-card mb-6">
          <CardContent className="p-6 text-center">
            <h3 className="text-xl font-semibold text-white mb-2">
              Добавить новый аккаунт
            </h3>
            <p className="text-inactive mb-4">
              Подключение Telegram аккаунта к системе
            </p>
            <Button onClick={() => setStep("proxyAsk")} className="primary-btn">
              <BadgePlus className="w-4 h-4 mr-2" />
              Начать добавление
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "proxyAsk" && (
        <Card className="modern-card">
          <CardHeader className="card-header">
            <CardTitle className="section-title">
              <div className="title-icon">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3>Шаг 1: Использовать прокси?</h3>
                <p className="section-subtitle">
                  Можно продолжить без прокси или настроить его сейчас
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="card-content">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => handleStart(false)}
                className="outline-none cursor-pointer px-4 py-2 rounded-lg border transition select-none border-[#2b5278] bg-[#17212b] text-white/90 hover:border-[#3a6aa1] hover:bg-[#1e2a38]"
              >
                Нет, продолжить без прокси
              </Button>
              <Button
                onClick={() => setStep("proxyForm")}
                className="primary-btn"
              >
                Да, настроить прокси
              </Button>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={reset} className="cancel-btn cursor-pointer">
                <X className="w-4 h-4 mr-2" />
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "proxyForm" && (
        <Card className="modern-card">
          <CardHeader className="card-header">
            <CardTitle className="section-title">
              <div className="title-icon">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3>Шаг 1: Настройка прокси</h3>
                <p className="section-subtitle">Заполните параметры прокси</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="card-content">
            <div className="grid sm:grid-cols-2 gap-4">
              <ProxyTypeSelect
                value={proxyData.type}
                onChange={(v) => {
                  setProxyData((d) => ({ ...d, type: v }));
                  if (proxyErrors.type) {
                    setProxyErrors((e) => ({ ...e, type: undefined }));
                  }
                }}
                error={proxyErrors.type}
              />

              <div>
                <Label className="text-[#69b2f1] text-xs font-semibold">
                  Хост
                </Label>
                <InputField
                  value={proxyData.host}
                  onChange={(e) => {
                    setProxyData({ ...proxyData, host: e.target.value });
                    if (proxyErrors.host)
                      setProxyErrors((er) => ({ ...er, host: undefined }));
                  }}
                  placeholder="proxy.example.com"
                />

                <ErrorText>{proxyErrors.host}</ErrorText>
              </div>

              <div>
                <Label className="text-[#69b2f1] text-xs font-semibold">
                  Порт
                </Label>
                <InputField
                  value={proxyData.port}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "");
                    setProxyData({ ...proxyData, port: v });
                    if (proxyErrors.port)
                      setProxyErrors((er) => ({ ...er, port: undefined }));
                  }}
                  placeholder="8080"
                  inputMode="numeric"
                />
                <ErrorText>{proxyErrors.port}</ErrorText>
              </div>

              <div>
                <Label className="text-[#69b2f1] text-xs font-semibold">
                  Логин (опц.)
                </Label>

                <InputField
                  type="text"
                  value={proxyData.username}
                  onChange={(e) => {
                    setProxyData({ ...proxyData, username: e.target.value });
                    if (proxyErrors.username || proxyErrors.password)
                      setProxyErrors((er) => ({
                        ...er,
                        username: undefined,
                        password: undefined,
                      }));
                  }}
                  placeholder="username"
                />
                <ErrorText>{proxyErrors.username}</ErrorText>
              </div>

              <div>
                <Label className="text-[#69b2f1] text-xs font-semibold">
                  Пароль (опц.)
                </Label>
                <InputField
                  type="password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  spellCheck={false}
                  autoCapitalize="off"
                  name="proxy-off"
                  value={proxyData.password}
                  onChange={(e) => {
                    setProxyData({ ...proxyData, password: e.target.value });
                    if (proxyErrors.username || proxyErrors.password)
                      setProxyErrors((er) => ({
                        ...er,
                        username: undefined,
                        password: undefined,
                      }));
                  }}
                  placeholder="password"
                />
                <ErrorText>{proxyErrors.password}</ErrorText>
              </div>
            </div>

            <div className="flex justify-between gap-2 mt-6">
              <div className="flex gap-2">
                <Button onClick={reset} className="cancel-btn cursor-pointer">
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button
                  onClick={handleStartWithProxyValidated}
                  className="primary-btn"
                  disabled={!proxyFormValid}
                  title={!proxyFormValid ? "Заполните корректно поля" : ""}
                >
                  Продолжить
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "phone" && (
        <Card className="modern-card">
          <CardHeader className="card-header">
            <CardTitle className="section-title">
              <div className="title-icon">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h3>Шаг 2: Номер телефона</h3>
                <p className="section-subtitle">Мы отправим код в Telegram</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="card-content">
            <Label className="text-[#69b2f1] text-xs font-semibold">
              Номер телефона
            </Label>

            <InputField
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (999) 123-45-67"
            />
            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={reset} className="cancel-btn cursor-pointer">
                <X className="w-4 h-4 mr-2" />
                Отмена
              </Button>
              <Button onClick={handlePhone} className="primary-btn">
                Отправить код
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "code" && (
        <Card className="modern-card">
          <CardHeader className="card-header">
            <CardTitle className="section-title">
              <div className="title-icon">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3>Шаг 3: Код подтверждения</h3>
                <p className="section-subtitle">Введите код из Telegram</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="card-content">
            <Label className="text-[#69b2f1] text-xs font-semibold">Код</Label>
            <InputField
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="00000"
              maxLength={5}
            />

            <div className="flex justify-between gap-2 mt-6">
              <Button
                onClick={() => setStep("phone")}
                className="back-step-btn cursor-pointer"
                disabled={authBusy}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <Button
                onClick={handleCode}
                className="success-btn"
                disabled={authBusy}
              >
                <Check className="w-4 h-4 mr-2" />
                Завершить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "password" && (
        <Card className="modern-card">
          <CardHeader className="card-header">
            <CardTitle className="section-title">
              <div className="title-icon">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3>Шаг 4: Пароль 2FA</h3>
                <p className="section-subtitle">
                  Введите пароль двухфакторной аутентификации Telegram
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="card-content">
            <Label className="text-[#69b2f1] text-xs font-semibold">
              Пароль 2FA
            </Label>

            <InputField
              type="password"
              value={password2FA}
              onChange={(e) => setPassword2FA(e.target.value)}
              placeholder="••••••••"
              disabled={authBusy}
            />
            {attemptsLeft !== null && (
              <p className="text-xs text-inactive mt-2">
                Осталось попыток: {attemptsLeft}
              </p>
            )}
            <div className="flex justify-between gap-2 mt-6">
              <Button
                onClick={() => setStep("code")}
                className="back-step-btn cursor-pointer"
                disabled={authBusy}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <Button
                onClick={handlePassword}
                className="success-btn"
                disabled={authBusy}
              >
                <Check className="w-4 h-4 mr-2" />
                Подтвердить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
