"use client";

import { Button, Field, Input } from "@/components/ui";
import { browserSupportsWebAuthn, startAuthentication, WebAuthnError } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { AlertCircle, ArrowRight, Eye, EyeOff, Fingerprint, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LoginForm({ nextPath, passkeys = false }: { nextPath?: string; passkeys?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Segunda etapa: código do app autenticador (ou de recuperação)
  const [step, setStep] = useState<"senha" | "codigo">("senha");
  const [code, setCode] = useState("");
  // Só caminhos internos: ?next= não pode levar para outro site
  const next = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
  const [bioSupported, setBioSupported] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    // Só dá para saber no navegador
    if (passkeys) queueMicrotask(() => setBioSupported(browserSupportsWebAuthn()));
  }, [passkeys]);

  /** Face ID / Touch ID / Windows Hello: sem e-mail e senha */
  async function biometric() {
    setError(null);
    setBioBusy(true);
    try {
      const post = async (body: unknown) => {
        const res = await fetch("/api/auth/passkey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Não foi possível entrar com biometria.");
        return data;
      };
      const options = await post({ step: "options" });
      const response = await startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON });
      const data = await post({ step: "verify", response });
      router.push(next || data.redirect || "/crm");
      router.refresh();
    } catch (e) {
      if (e instanceof WebAuthnError && e.code === "ERROR_CEREMONY_ABORTED") setError(null);
      else if (e instanceof Error && e.name === "NotAllowedError") {
        setError("Cancelado, ou nenhuma biometria cadastrada neste aparelho. Entre com e-mail e senha e ative em Minha conta.");
      } else setError(e instanceof Error ? e.message : "Não foi possível entrar com biometria.");
      setBioBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        step === "senha"
          ? await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            })
          : await fetch("/api/auth/2fa", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível entrar.");
        // Conta de outra empresa: vai para o login no domínio dela
        if (data.url) {
          window.setTimeout(() => window.location.assign(data.url), 1500);
          return;
        }
        if (data.restart) {
          setStep("senha");
          setCode("");
        }
        setLoading(false);
        return;
      }
      if (data.twoFactor) {
        setStep("codigo");
        setLoading(false);
        return;
      }
      router.push(next || data.redirect || "/crm");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  if (step === "codigo") {
    return (
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-hairline bg-soft/50 p-3.5 text-sm">
          <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-accent" />
          <p className="text-subtle">
            Digite o código de 6 dígitos do app autenticador. Sem o celular, use um dos códigos de recuperação.
          </p>
        </div>
        <Field label="Código">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            autoFocus
            className="h-11 text-center font-mono text-lg tracking-[0.3em]"
          />
        </Field>
        {error && (
          <p className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-500">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" variant="accent" size="lg" loading={loading} className="w-full">
          Confirmar
          <ArrowRight className="size-4" />
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("senha");
            setCode("");
            setError(null);
          }}
          className="w-full text-center text-xs text-subtle transition-colors hover:text-ink"
        >
          Voltar
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      {bioSupported && (
        <>
          <Button type="button" variant="outline" size="lg" loading={bioBusy} onClick={biometric} className="w-full">
            <Fingerprint className="size-4.5 text-accent" />
            {bioBusy ? "Aguardando biometria…" : "Entrar com biometria"}
          </Button>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-subtle">
            <span className="h-px flex-1 bg-hairline" />
            ou com e-mail
            <span className="h-px flex-1 bg-hairline" />
          </div>
        </>
      )}
      <Field label="E-mail corporativo">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@imobiliaria.com.br"
          autoComplete="username webauthn"
          autoFocus
          className="h-11"
        />
      </Field>

      <Field label="Senha">
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle transition-colors hover:text-ink"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-500">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="accent"
        size="lg"
        loading={loading}
        className="w-full"
      >
        Entrar
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
