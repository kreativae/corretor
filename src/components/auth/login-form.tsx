"use client";

import { Button, Field, Input } from "@/components/ui";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível entrar.");
        setLoading(false);
        return;
      }
      router.push(nextPath || data.redirect || "/crm");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <Field label="E-mail corporativo">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@imobiliaria.com.br"
          autoComplete="email"
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
