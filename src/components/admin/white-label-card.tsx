"use client";

import { Button, Field, Input } from "@/components/ui";
import type { WhiteLabel } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const ACCENTS = [
  { name: "Esmeralda", value: "#10b981" },
  { name: "Azul elétrico", value: "#4f7cff" },
  { name: "Laranja queimado", value: "#f26a1b" },
  { name: "Dourado grafite", value: "#d4a94e" },
];

export function WhiteLabelCard({ initial }: { initial: WhiteLabel }) {
  const router = useRouter();
  const [wl, setWl] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "whiteLabel", value: wl }),
      });
      if (!res.ok) throw new Error();
      toast.success("Identidade aplicada em toda a plataforma.");
      router.refresh();
    } catch {
      toast.error("Erro ao salvar identidade.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-elev rounded-2xl border border-hairline bg-card p-6">
      <h2 className="font-display text-base font-semibold tracking-tight">
        White label — identidade da marca
      </h2>
      <p className="mt-1 text-xs text-subtle">
        Aplicada ao site público, CRM e materiais exportados.
      </p>

      <div className="mt-5 space-y-4">
        <Field label="Nome da organização">
          <Input
            value={wl.orgName}
            onChange={(e) => setWl({ ...wl, orgName: e.target.value })}
          />
        </Field>
        <Field label="Domínio do site">
          <Input
            value={wl.domain}
            onChange={(e) => setWl({ ...wl, domain: e.target.value })}
          />
        </Field>
        <Field label="WhatsApp comercial" hint="DDI + DDD + número, só dígitos">
          <Input
            value={wl.phone}
            onChange={(e) => setWl({ ...wl, phone: e.target.value })}
            className="font-mono tabular"
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-subtle">
            Cor de acento
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                title={a.name}
                onClick={() => setWl({ ...wl, accent: a.value })}
                className={cn(
                  "size-9 rounded-full border-2 transition-transform duration-200 hover:scale-110",
                  wl.accent === a.value ? "border-ink" : "border-transparent",
                )}
                style={{ background: a.value }}
              />
            ))}
            <input
              type="color"
              value={wl.accent}
              onChange={(e) => setWl({ ...wl, accent: e.target.value })}
              className="size-9 cursor-pointer rounded-full border border-hairline bg-transparent"
              aria-label="Cor personalizada"
            />
            <code className="font-mono text-xs text-subtle">{wl.accent}</code>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="accent" loading={saving} onClick={save}>
          <Check className="size-4" />
          Aplicar identidade
        </Button>
      </div>
    </section>
  );
}
