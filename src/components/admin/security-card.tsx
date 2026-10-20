"use client";

import { Switch } from "@/components/ui";
import type { SecuritySettings } from "@/lib/security-settings";
import { Fingerprint, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/** Configurações › Segurança: biometria no login (não precisa de chave nem conta externa) */
export function SecurityCard({ initial }: { initial: SecuritySettings }) {
  const router = useRouter();
  const [opts, setOpts] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save(next: SecuritySettings, message: string) {
    const prev = opts;
    setOpts(next);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "security", value: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(message);
      router.refresh();
    } catch {
      setOpts(prev);
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-elev rounded-2xl border border-hairline bg-card p-5 md:p-6">
      <div className="flex items-start gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Segurança do acesso</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-subtle">
            Cada pessoa ativa a biometria e a verificação em duas etapas em{" "}
            <Link href="/crm/conta" className="text-ink underline underline-offset-2">
              Minha conta
            </Link>{" "}
            (clique no nome, no rodapé do menu). Não é preciso chave de API nem conta externa.
          </p>
        </div>
      </div>
      <div className="mt-5 divide-y divide-hairline rounded-xl border border-hairline">
        <div className="flex items-center gap-4 p-4">
          <Fingerprint className="size-4 shrink-0 text-subtle" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Entrar com biometria</p>
            <p className="mt-0.5 text-xs text-subtle">
              Face ID, Touch ID, Windows Hello ou digital no Android, no lugar de e-mail e senha. Desligar bloqueia o
              login por biometria de todos; os aparelhos cadastrados voltam a valer ao religar.
            </p>
          </div>
          <Switch
            checked={opts.passkeys}
            disabled={saving}
            onChange={(v) => void save({ ...opts, passkeys: v }, v ? "Biometria liberada no login." : "Biometria desligada no login.")}
          />
        </div>
      </div>
    </section>
  );
}
