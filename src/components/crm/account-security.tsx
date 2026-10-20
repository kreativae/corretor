"use client";

import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Copy, KeyRound, LogOut, MonitorSmartphone, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Device = { id: string; label: string; ip: string | null; createdAt: string; current: boolean };

const sectionCls = "rounded-2xl border border-hairline bg-card p-5 md:p-6";
const h2Cls = "flex items-center gap-2 font-display text-lg font-semibold tracking-tight";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}

/** Minha conta: troca de senha, verificação em duas etapas e aparelhos conectados */
export function AccountSecurity({
  twoFactor,
  recoveryLeft,
  devices,
}: {
  twoFactor: boolean;
  recoveryLeft: number;
  devices: Device[];
}) {
  return (
    <>
      <PasswordCard />
      <TwoFactorCard enabled={twoFactor} recoveryLeft={recoveryLeft} />
      <DevicesCard devices={devices} />
    </>
  );
}

function PasswordCard() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) return toast.error("A confirmação não confere com a nova senha.");
    setBusy(true);
    try {
      await call("/api/account/password", "POST", { current, next });
      toast.success("Senha trocada. Os outros aparelhos foram desconectados.");
      setCurrent("");
      setNext("");
      setConfirm("");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={sectionCls}>
      <h2 className={h2Cls}>
        <KeyRound className="size-4.5 text-subtle" />
        Senha
      </h2>
      <p className="mt-1 text-xs text-subtle">Mínimo de 8 caracteres, com letras e números. Ao trocar, os outros aparelhos saem.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Senha atual">
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="Nova senha">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirmar">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit" variant="accent" loading={busy} disabled={!current || !next || !confirm}>
          Trocar senha
        </Button>
      </div>
    </form>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <p className="text-sm font-medium">Guarde estes códigos de recuperação</p>
      <p className="mt-1 text-xs text-subtle">
        Cada um vale uma vez, para entrar se você perder o celular. Eles não aparecem de novo.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
        {codes.map((c) => (
          <span key={c} className="rounded-lg bg-card px-2 py-1.5 text-center">
            {c}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(codes.join("\n"));
            toast.success("Códigos copiados.");
          }}
        >
          <Copy className="size-3.5" />
          Copiar
        </Button>
        <Button type="button" variant="accent" size="sm" onClick={onDone}>
          Já guardei
        </Button>
      </div>
    </div>
  );
}

function TwoFactorCard({ enabled, recoveryLeft }: { enabled: boolean; recoveryLeft: number }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"disable" | "codes" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    run(async () => {
      setSetup(await call("/api/account/2fa", "POST", { action: "start" }));
      setCode("");
    });

  const enable = () =>
    run(async () => {
      const data = await call("/api/account/2fa", "POST", { action: "enable", code });
      setSetup(null);
      setCode("");
      setCodes(data.codes);
      toast.success("Verificação em duas etapas ativada.");
    });

  const confirmMode = () =>
    run(async () => {
      const data = await call("/api/account/2fa", "POST", { action: mode, code });
      setCode("");
      setMode(null);
      if (data.codes) setCodes(data.codes);
      else {
        toast.success("Verificação em duas etapas desativada.");
        router.refresh();
      }
    });

  return (
    <section className={sectionCls}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={h2Cls}>
            <ShieldCheck className="size-4.5 text-subtle" />
            Verificação em duas etapas
          </h2>
          <p className="mt-1 max-w-xl text-xs text-subtle">
            Além da senha, o login pede um código de 6 dígitos do app autenticador do celular (Google Authenticator,
            Microsoft Authenticator, Authy, 1Password…). Quem descobrir a sua senha não entra sem o celular.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium",
            enabled || codes
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
              : "border-amber-500/20 bg-amber-500/10 text-amber-500",
          )}
        >
          {enabled || codes ? "Ativada" : "Desativada"}
        </span>
      </div>

      {codes && (
        <RecoveryCodes
          codes={codes}
          onDone={() => {
            setCodes(null);
            router.refresh();
          }}
        />
      )}

      {!enabled && !codes && !setup && (
        <div className="mt-4 flex justify-end">
          <Button variant="accent" onClick={start} loading={busy}>
            Ativar
          </Button>
        </div>
      )}

      {setup && (
        <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
          <div
            className="size-44 overflow-hidden rounded-xl border border-hairline bg-white p-2 [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: setup.qr }}
          />
          <div className="space-y-3 text-sm">
            <p>
              <strong>1.</strong> No app autenticador, toque em adicionar e leia o QR code.
            </p>
            <p className="text-xs text-subtle">
              Sem câmera? Digite a chave:{" "}
              <span className="break-all font-mono text-ink">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</span>
            </p>
            <p>
              <strong>2.</strong> Digite o código que aparece no app:
            </p>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="max-w-[10rem] text-center font-mono tracking-[0.3em]"
              />
              <Button variant="accent" onClick={enable} loading={busy} disabled={code.replace(/\D/g, "").length !== 6}>
                Confirmar
              </Button>
              <Button variant="ghost" onClick={() => setSetup(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {enabled && !codes && (
        <div className="mt-4">
          <p className="text-xs text-subtle">
            {recoveryLeft} {recoveryLeft === 1 ? "código de recuperação restante" : "códigos de recuperação restantes"}.
          </p>
          {mode ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                placeholder={mode === "disable" ? "Código do app ou de recuperação" : "Código do app"}
                className="max-w-[16rem] font-mono"
                autoFocus
              />
              <Button variant={mode === "disable" ? "danger" : "accent"} onClick={confirmMode} loading={busy} disabled={!code.trim()}>
                {mode === "disable" ? "Desativar" : "Gerar novos códigos"}
              </Button>
              <Button variant="ghost" onClick={() => setMode(null)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setMode("codes")}>
                Novos códigos de recuperação
              </Button>
              <Button variant="outline" onClick={() => setMode("disable")}>
                <ShieldOff className="size-4" />
                Desativar
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DevicesCard({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const others = devices.filter((d) => !d.current).length;

  async function signOutOthers() {
    if (!confirm("Desconectar todos os outros aparelhos? Eles vão precisar entrar de novo.")) return;
    setBusy(true);
    try {
      await call("/api/account/sessions", "DELETE");
      toast.success("Outros aparelhos desconectados.");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={sectionCls}>
      <h2 className={h2Cls}>
        <MonitorSmartphone className="size-4.5 text-subtle" />
        Aparelhos conectados
      </h2>
      <p className="mt-1 text-xs text-subtle">Se aparecer um aparelho que não é seu, troque a senha: todos os outros saem.</p>
      <ul className="mt-4 divide-y divide-hairline rounded-xl border border-hairline">
        {devices.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {d.label}
                {d.current && <span className="ml-2 text-xs font-normal text-accent">este aparelho</span>}
              </p>
              <p className="text-xs text-subtle">
                Entrou em {new Date(d.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                {d.ip ? ` · IP ${d.ip}` : ""}
              </p>
            </div>
          </li>
        ))}
        {!devices.length && <li className="px-4 py-3 text-sm text-subtle">Nenhum aparelho.</li>}
      </ul>
      {others > 0 && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={signOutOthers} loading={busy}>
            <LogOut className="size-4" />
            Sair dos outros aparelhos ({others})
          </Button>
        </div>
      )}
    </section>
  );
}
