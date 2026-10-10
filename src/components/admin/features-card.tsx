"use client";

import { Switch } from "@/components/ui";
import { Handshake, LayoutGrid } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Features = { closedDeals: boolean };

const MODULES: { key: keyof Features; label: string; description: string; icon: typeof Handshake }[] = [
  {
    key: "closedDeals",
    label: "Negócios fechados",
    description:
      "Página no menu do CRM com a lista de negócios fechados, indicadores (volume, ticket e ciclo médio), filtros e exportação CSV.",
    icon: Handshake,
  },
];

/** Liga/desliga páginas opcionais do CRM. */
export function FeaturesCard({ initial }: { initial: Features }) {
  const router = useRouter();
  const [features, setFeatures] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(key: keyof Features, v: boolean) {
    const prev = features;
    const next = { ...features, [key]: v };
    setFeatures(next);
    setSaving(key);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "features", value: next }),
      });
      if (!res.ok) throw new Error();
      const label = MODULES.find((m) => m.key === key)?.label;
      toast.success(v ? `${label} ativado.` : `${label} desativado.`);
      router.refresh();
    } catch {
      setFeatures(prev);
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="card-elev rounded-2xl border border-hairline bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
          <LayoutGrid className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">Módulos do CRM</h2>
          <p className="mt-1 max-w-xl text-xs text-subtle">
            Ative só as páginas que a equipe usa. Desativar esconde a página do menu; os dados
            continuam guardados.
          </p>
        </div>
      </div>
      <div className="mt-5 divide-y divide-hairline rounded-xl border border-hairline">
        {MODULES.map((m) => (
          <div key={m.key} className="flex items-center gap-4 p-4">
            <m.icon className="size-4 shrink-0 text-subtle" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{m.label}</p>
              <p className="mt-0.5 text-xs text-subtle">{m.description}</p>
            </div>
            <Switch
              checked={features[m.key]}
              disabled={saving === m.key}
              onChange={(v) => toggle(m.key, v)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
