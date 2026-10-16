"use client";

import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Crown, KeyRound, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/** Entrada da gerência: login normal ou primeiro acesso com a chave GERENCIA_KEY */
export function GerenciaLogin({ keyConfigured }: { keyConfigured: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"entrar" | "primeiro">("entrar");
  const [f, setF] = useState({ name: "", email: "", password: "", key: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res =
        tab === "entrar"
          ? await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: f.email, password: f.password }),
            })
          : await fetch("/api/gerencia/setup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(f),
            });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error);
      if (tab === "entrar" && d.user?.role !== "superadmin") {
        toast.error("Este usuário não tem acesso de gerência.");
        router.push("/crm");
        return;
      }
      router.push("/gerencia");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-12 text-ink">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-ink text-canvas">
            <Crown className="size-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">Gerência</h1>
          <p className="mt-1 text-sm text-subtle">Acesso acima do administrador do sistema.</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-hairline p-1 text-sm">
          {(
            [
              ["entrar", "Entrar"],
              ["primeiro", "Primeiro acesso"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn("rounded-full py-1.5 font-medium", tab === id ? "bg-ink text-canvas" : "text-subtle hover:text-ink")}
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-hairline bg-card p-5">
          {tab === "primeiro" && (
            <>
              {!keyConfigured && (
                <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  Defina a variável <code className="font-mono">GERENCIA_KEY</code> (mínimo 12 caracteres) na Vercel e faça um
                  novo deploy para liberar o primeiro acesso.
                </p>
              )}
              <Field label="Chave de gerência">
                <Input type="password" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} autoComplete="off" />
              </Field>
              <Field label="Seu nome">
                <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="E-mail">
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
          </Field>
          <Field label={tab === "primeiro" ? "Crie uma senha (mín. 8)" : "Senha"}>
            <Input
              type="password"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              autoComplete={tab === "primeiro" ? "new-password" : "current-password"}
            />
          </Field>
          <Button type="submit" variant="accent" className="w-full" loading={busy}>
            {tab === "primeiro" ? <KeyRound className="size-4" /> : <LogIn className="size-4" />}
            {tab === "primeiro" ? "Criar acesso de gerência" : "Entrar"}
          </Button>
        </form>
      </div>
    </main>
  );
}
