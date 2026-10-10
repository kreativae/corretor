"use client";

import { Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ChevronDown, Handshake, LayoutGrid } from "lucide-react";
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
  // Recolhido (sanfona); abre ao clicar no cabeçalho
  const [open, setOpen] = useState(false);
  const active = MODULES.filter((m) => features[m.key]).map((m) => m.label);

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
    <section className="card-elev rounded-2xl border border-hairline bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-6 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
          <LayoutGrid className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold tracking-tight">
            Módulos do CRM
          </span>
          <span className="mt-1 block max-w-xl text-xs text-subtle">
            {open
              ? "Ative só as páginas que a equipe usa. Desativar esconde a página do menu; os dados continuam guardados."
              : `${active.length ? `Ativos: ${active.join(", ")}` : "Nenhum módulo opcional ativo"} — clique para gerenciar`}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-subtle transition-transform duration-300", open && "rotate-180")}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-expo",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
      <div className="min-h-0 overflow-hidden" inert={!open}>
      <div className="border-t border-hairline p-6">
      <div className="divide-y divide-hairline rounded-xl border border-hairline">
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
      </div>
      </div>
      </div>
    </section>
  );
}
