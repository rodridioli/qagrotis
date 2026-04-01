"use client"

import { useState, useId, useRef } from "react"
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Captcha, type CaptchaHandle } from "@/components/ui/captcha"
import { validateLogin } from "@/lib/actions/usuarios"

// Separate inactive check before attempting signIn
async function checkInactive(email: string, password: string) {
  const result = await validateLogin(email, password)
  if (!result.ok && result.reason === "inactive") return true
  return false
}

// ── Google brand icon ─────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" focusable="false">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.98 14.01 17.64 11.71 17.64 9.205z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-6.16-4.53H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

// ── Icon-wrapped input ────────────────────────────────────────
interface IconInputProps extends React.ComponentProps<"input"> {
  leadingIcon: React.ReactNode
  trailingElement?: React.ReactNode
  error?: string
}

function IconInput({ leadingIcon, trailingElement, error, className, id, ...props }: IconInputProps) {
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3.5 flex items-center text-text-secondary">
          {leadingIcon}
        </span>
        <input
          id={id}
          aria-invalid={!!error}
          className={cn(
            "flex h-12 w-full rounded-xl border border-border-default bg-surface-input",
            "pl-10 text-sm text-text-primary outline-none transition-colors",
            "placeholder:text-text-secondary",
            "focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20",
            "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            trailingElement ? "pr-11" : "pr-3.5",
            className
          )}
          {...props}
        />
        {trailingElement && (
          <span className="absolute right-1.5 flex items-center">{trailingElement}</span>
        )}
      </div>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  )
}

// ── Primary button ────────────────────────────────────────────
function PrimaryButton({ children, loading = false, className, ...props }: React.ComponentProps<"button"> & { loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || props.disabled}
      aria-busy={loading}
      style={{ color: "#ffffff" }}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-xl",
        "bg-brand-primary text-base font-semibold",
        "transition-opacity hover:opacity-90 active:opacity-80",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

// ── Divider ───────────────────────────────────────────────────
function Divider({ label = "ou" }: { label?: string }) {
  return (
    <div className="relative flex items-center gap-2" aria-hidden="true">
      <span className="flex-1 border-t border-border-default" />
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="flex-1 border-t border-border-default" />
    </div>
  )
}

// ── Login view ────────────────────────────────────────────────
function LoginView({ onForgotPassword, callbackUrl }: { onForgotPassword: () => void; callbackUrl: string }) {
  const emailId = useId()
  const passwordId = useId()
  const captchaRef = useRef<CaptchaHandle>(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [captchaError, setCaptchaError] = useState("")

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEmailError("")
    setPasswordError("")
    setCaptchaError("")

    let hasError = false

    if (!email.trim()) {
      setEmailError("Informe seu e-mail.")
      hasError = true
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("E-mail inválido.")
      hasError = true
    }

    if (!password) {
      setPasswordError("Informe sua senha.")
      hasError = true
    }

    if (!captchaRef.current?.isValid()) {
      setCaptchaError("Caracteres incorretos. Tente novamente.")
      captchaRef.current?.reset()
      hasError = true
    }

    if (hasError) return

    setLoading(true)
    try {
      // Check inactive before attempting signIn (NextAuth returns generic error for both cases)
      const inactive = await checkInactive(email, password)
      if (inactive) {
        toast.error("Usuário inativo.", {
          description: "Entre em contato com o administrador do sistema.",
        })
        captchaRef.current?.reset()
        return
      }

      await signIn("credentials", {
        email,
        password,
        redirectTo: callbackUrl,
      })
    } catch (err: unknown) {
      // Re-throw Next.js redirect errors so the browser actually redirects
      if (err instanceof Error && "digest" in err && typeof (err as { digest?: string }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")) {
        throw err
      }
      // NextAuth v5 throws AuthError on invalid credentials
      const message = err instanceof Error ? err.message : ""
      if (message.includes("CredentialsSignin") || message.includes("credentials")) {
        toast.error("E-mail ou senha incorretos.", {
          description: "Verifique suas credenciais e tente novamente.",
        })
        captchaRef.current?.reset()
      } else {
        toast.error("Erro ao autenticar. Tente novamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = () => {
    setGoogleLoading(true)
    signIn("google", { redirectTo: callbackUrl })
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} noValidate className="space-y-3" aria-label="Formulário de acesso">
        <IconInput
          id={emailId}
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError("") }}
          autoComplete="email"
          inputMode="email"
          leadingIcon={<Mail className="size-4" />}
          error={emailError}
        />

        <IconInput
          id={passwordId}
          type={showPassword ? "text" : "password"}
          placeholder="Senha"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setPasswordError("") }}
          autoComplete="current-password"
          leadingIcon={<Lock className="size-4" />}
          error={passwordError}
          trailingElement={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100"
            >
              {showPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          }
        />

        <Captcha ref={captchaRef} error={captchaError} />

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded"
          >
            Esqueci minha senha
          </button>
        </div>

        <PrimaryButton loading={loading}>Entrar</PrimaryButton>
      </form>

      <Divider />

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading || googleLoading}
        aria-busy={googleLoading}
        className={cn(
          "flex h-12 w-full items-center justify-center gap-2.5 rounded-xl",
          "border border-border-default bg-surface-card text-sm font-medium text-text-primary",
          "transition-colors hover:bg-neutral-grey-50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2"
        )}
      >
        {googleLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
        Entrar com Google
      </button>
    </div>
  )
}

// ── Forgot password view ──────────────────────────────────────
function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  const emailId = useId()
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEmailError("")

    if (!email.trim()) { setEmailError("Informe seu e-mail."); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("E-mail inválido."); return }

    setLoading(true)
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? "Erro ao enviar o e-mail."); return }
      toast.success("E-mail enviado!", { description: `Verifique sua caixa de entrada em ${email}.` })
      onBack()
    } catch {
      toast.error("Sem conexão. Verifique sua internet e tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3" aria-label="Recuperação de senha">
      <IconInput
        id={emailId}
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setEmailError("") }}
        autoComplete="email"
        inputMode="email"
        leadingIcon={<Mail className="size-4" />}
        error={emailError}
      />

      <PrimaryButton loading={loading}>Lembrar senha</PrimaryButton>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none"
        >
          <ArrowLeft className="size-3.5" />
          Voltar ao login
        </button>
      </div>
    </form>
  )
}

// ── Export ────────────────────────────────────────────────────
export function LoginForm({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [mode, setMode] = useState<"login" | "forgot">("login")

  if (mode === "forgot") return <ForgotPasswordView onBack={() => setMode("login")} />
  return <LoginView callbackUrl={callbackUrl} onForgotPassword={() => setMode("forgot")} />
}
