"use client";

import { STAT_CARD_MODES, STAT_CARD_PAGES, type StatCardKey, type StatCardMode, type StatCards } from "@/lib/stat-cards";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/** Liga/desliga os cards de indicadores no topo de cada página do CRM. */
export function StatCardsCard({ initial }: { initial: StatCards }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [saving, setSaving] = useState<StatCardKey | "all" | null>(null);
  // Recolhido (sanfona); abre ao clicar no cabeçalho
  const [open, setOpen] = useState(false);
  const count = (m: StatCardMode) => STAT_CARD_PAGES.filter((p) => cards[p.key] === m).length;
  const summary = STAT_CARD_MODES.filter((m) => count(m.id))
    .map((m) => (count(m.id) === STAT_CARD_PAGES.length ? `${m.label} em todas as páginas` : `${m.label}: ${count(m.id)}`))
    .join(" · ");

  async function save(next: StatCards, key: StatCardKey | "all", msg: string) {
    const prev = cards;
    setCards(next);
    setSaving(key);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "statCards", value: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(msg);
      router.refresh();
    } catch {
      setCards(prev);
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(null);
    }
  }

  function setAll(v: StatCardMode) {
    const next = Object.fromEntries(STAT_CARD_PAGES.map((p) => [p.key, v])) as StatCards;
    const label = STAT_CARD_MODES.find((m) => m.id === v)?.label.toLowerCase();
    save(next, "all", `Cards ${label === "aberto" ? "abertos" : label === "minimizado" ? "minimizados" : "ocultos"} em todas as páginas.`);
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
          <BarChart3 className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold tracking-tight">
            Cards das páginas
          </span>
          <span className="mt-1 block max-w-xl text-xs text-subtle">
            {open
              ? "Cards de indicadores no topo de cada página do CRM: abertos, minimizados (abrem com um clique, liberando espaço na tela) ou ocultos. Vale para toda a equipe."
              : `${summary} — clique para gerenciar`}
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
            <div className="mb-3 flex justify-end gap-2 text-xs">
              <span className="mr-auto self-center text-subtle">Todas as páginas:</span>
              {STAT_CARD_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={saving !== null}
                  onClick={() => setAll(m.id)}
                  className="rounded-full border border-hairline px-3 py-1.5 text-subtle transition-colors hover:text-ink disabled:opacity-50"
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2">
              {STAT_CARD_PAGES.map((p) => (
                <div key={p.key} className="flex items-center gap-4 bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-subtle">{p.path}</p>
                  </div>
                  <div className="flex shrink-0 gap-0.5 rounded-lg border border-hairline p-0.5">
                    {STAT_CARD_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        disabled={saving !== null}
                        onClick={() =>
                          cards[p.key] !== m.id &&
                          save({ ...cards, [p.key]: m.id }, p.key, `${p.label}: cards ${m.label.toLowerCase()}.`)
                        }
                        aria-pressed={cards[p.key] === m.id}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60",
                          cards[p.key] === m.id ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
