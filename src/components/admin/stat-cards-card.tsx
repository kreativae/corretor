"use client";

import { Switch } from "@/components/ui";
import { STAT_CARD_PAGES, type StatCardKey, type StatCards } from "@/lib/stat-cards";
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
  const on = STAT_CARD_PAGES.filter((p) => cards[p.key]);

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

  function setAll(v: boolean) {
    const next = Object.fromEntries(STAT_CARD_PAGES.map((p) => [p.key, v])) as StatCards;
    save(next, "all", v ? "Cards ativados em todas as páginas." : "Cards ocultos em todas as páginas.");
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
              ? "Escolha em quais páginas do CRM aparecem os cards de indicadores no topo. Vale para toda a equipe."
              : `${
                  on.length === STAT_CARD_PAGES.length
                    ? "Ativos em todas as páginas"
                    : on.length
                      ? `Ativos em: ${on.map((p) => p.label).join(", ")}`
                      : "Ocultos em todas as páginas"
                } — clique para gerenciar`}
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
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => setAll(true)}
                className="rounded-full border border-hairline px-3 py-1.5 text-subtle transition-colors hover:text-ink disabled:opacity-50"
              >
                Ativar todos
              </button>
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => setAll(false)}
                className="rounded-full border border-hairline px-3 py-1.5 text-subtle transition-colors hover:text-ink disabled:opacity-50"
              >
                Ocultar todos
              </button>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2">
              {STAT_CARD_PAGES.map((p) => (
                <div key={p.key} className="flex items-center gap-4 bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-subtle">{p.path}</p>
                  </div>
                  <Switch
                    checked={cards[p.key]}
                    disabled={saving !== null}
                    onChange={(v) =>
                      save(
                        { ...cards, [p.key]: v },
                        p.key,
                        `Cards ${v ? "ativados" : "ocultos"} em ${p.label}.`,
                      )
                    }
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
