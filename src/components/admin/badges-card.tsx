"use client";

import { Button, Input, Switch } from "@/components/ui";
import { BADGE_DEFAULTS, type BadgeDef, type BadgeSettings } from "@/lib/badges";
import { ArrowDown, ArrowUp, ChevronDown, Plus, RotateCcw, Save, Tag, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Cores prontas para os selos (fundo, texto) */
const SWATCHES: [string, string][] = [
  ["#F47525", "#FFFFFF"],
  ["#2B2B5D", "#FFFFFF"],
  ["#7C3AED", "#FFFFFF"],
  ["#15803D", "#FFFFFF"],
  ["#DC2626", "#FFFFFF"],
  ["#0E7490", "#FFFFFF"],
  ["#B45309", "#FFFFFF"],
  ["#111111", "#FFFFFF"],
  ["#FFFFFF", "#111111"],
  ["#FACC15", "#111111"],
];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);

/** Configurações › Selos do site: etiquetas coloridas que cada imóvel pode usar no card */
export function BadgesCard({ initial }: { initial: BadgeSettings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const change = (next: BadgeSettings) => {
    setS(next);
    setDirty(true);
  };
  const setItem = (i: number, patch: Partial<BadgeDef>) => {
    const items = [...s.items];
    items[i] = { ...items[i], ...patch };
    change({ ...s, items });
  };
  const move = (i: number, d: -1 | 1) => {
    const items = [...s.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    change({ ...s, items });
  };

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "badges", value: s }),
      });
      if (!res.ok) throw new Error();
      toast.success("Selos salvos.");
      setDirty(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar os selos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-elev rounded-2xl border border-hairline bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 p-6 text-left">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
          <Tag className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold tracking-tight">Selos do site</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-subtle">
            {open ? (
              "Etiquetas coloridas sobre a foto do imóvel (Exclusivo, Lançamento…). Cada imóvel escolhe o seu no cadastro."
            ) : !s.enabled ? (
              "Desligados — clique para gerenciar"
            ) : (
              s.items.slice(0, 6).map((b) => (
                <span key={b.id} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: b.bg, color: b.fg }}>
                  {b.label}
                </span>
              ))
            )}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-hairline p-6">
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["enabled", "Mostrar selos no site", "Desligado, nenhum aparece (a escolha dos imóveis fica guardada)"],
                ["onDetail", "Também na página do imóvel", "Ao lado do status, perto do título"],
                ["featuredAuto", "Destaque ganha selo", "Imóvel marcado como destaque e sem selo mostra o selo “Destaque”"],
              ] as const
            ).map(([k, label, hint]) => (
              <label key={k} className="flex items-start justify-between gap-3 rounded-xl bg-soft px-4 py-3">
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-[11px] text-subtle">{hint}</span>
                </span>
                <Switch checked={s[k]} onChange={(v) => change({ ...s, [k]: v })} />
              </label>
            ))}
          </div>

          <ul className="space-y-2">
            {s.items.map((b, i) => (
              <li key={i} className="rounded-xl border border-hairline p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex h-8 min-w-24 items-center justify-center rounded-full px-3 text-xs font-semibold shadow-sm"
                    style={{ background: b.bg, color: b.fg }}
                  >
                    {b.label || "Selo"}
                  </span>
                  <Input
                    value={b.label}
                    maxLength={32}
                    onChange={(e) => setItem(i, { label: e.target.value })}
                    placeholder="Texto do selo"
                    className="h-9 min-w-40 flex-1"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] text-subtle" title="Cor do fundo">
                    Fundo
                    <input type="color" value={b.bg} onChange={(e) => setItem(i, { bg: e.target.value })} className="size-8 cursor-pointer rounded-md border border-hairline bg-transparent" />
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-subtle" title="Cor do texto">
                    Texto
                    <input type="color" value={b.fg} onChange={(e) => setItem(i, { fg: e.target.value })} className="size-8 cursor-pointer rounded-md border border-hairline bg-transparent" />
                  </label>
                  <span className="ml-auto flex items-center">
                    <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === s.items.length - 1} aria-label="Descer">
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => change({ ...s, items: s.items.filter((_, j) => j !== i) })}
                      aria-label="Excluir selo"
                      title="Excluir (imóveis com este selo ficam sem selo)"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SWATCHES.map(([bg, fg]) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setItem(i, { bg, fg })}
                      className={cn("size-5 rounded-full border border-hairline-strong", b.bg.toLowerCase() === bg.toLowerCase() && "ring-2 ring-accent ring-offset-1 ring-offset-card")}
                      style={{ background: bg }}
                      aria-label={`Cor ${bg}`}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const n = s.items.length + 1;
                change({ ...s, items: [...s.items, { id: slug(`selo ${n} ${Date.now() % 1000}`), label: "Novo selo", bg: "#2B2B5D", fg: "#FFFFFF" }] });
              }}
              disabled={s.items.length >= 24}
            >
              <Plus className="size-4" /> Novo selo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => change(BADGE_DEFAULTS)}>
              <RotateCcw className="size-4" /> Selos padrão
            </Button>
            <Button variant="accent" size="sm" className="ml-auto" onClick={save} loading={saving} disabled={!dirty}>
              <Save className="size-4" /> Salvar selos
            </Button>
          </div>
          <p className="text-[11px] text-subtle">
            O texto pode ser trocado em cada imóvel (ex.: “Baixou 10%”), mantendo a cor do selo. Renomear aqui muda o texto de todos que usam o padrão.
          </p>
        </div>
      )}
    </section>
  );
}
