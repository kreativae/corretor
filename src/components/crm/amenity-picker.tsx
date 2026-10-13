"use client";

import { Input } from "@/components/ui";
import { FEATURES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Check, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Comodidades: lista padrão + as cadastradas pela equipe (salvas no sistema,
 * aparecem em todos os imóveis). Dá para incluir novas na hora.
 */
export function AmenityPicker({
  selected,
  onToggle,
  onAdd,
  custom: initialCustom = [],
}: {
  selected: string[];
  onToggle: (f: string) => void;
  /** Seleciona a comodidade recém-cadastrada */
  onAdd: (f: string) => void;
  custom?: string[];
}) {
  const [custom, setCustom] = useState(initialCustom);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // Padrão + extras + alguma já marcada no imóvel que saiu da lista
  const all = [...new Set([...FEATURES, ...custom, ...selected])];
  const isCustom = (f: string) => custom.includes(f);

  async function add() {
    const v = name.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/amenities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCustom(data.list);
      if (!selected.includes(data.name)) onAdd(data.name);
      setName("");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar a comodidade.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: string) {
    if (!confirm(`Remover "${f}" da lista de comodidades? Imóveis que já têm essa comodidade continuam com ela.`)) return;
    const res = await fetch("/api/amenities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f }),
    }).catch(() => null);
    if (!res?.ok) return toast.error("Não foi possível remover.");
    setCustom((await res.json()).list);
    if (selected.includes(f)) onToggle(f);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {all.map((f) => {
          const on = selected.includes(f);
          return (
            <span
              key={f}
              className={cn(
                "inline-flex items-center rounded-full border text-xs font-medium transition-all duration-200",
                on
                  ? "border-transparent bg-accent text-on-accent"
                  : "border-hairline text-subtle hover:border-hairline-strong hover:text-ink",
              )}
            >
              <button
                type="button"
                onClick={() => onToggle(f)}
                aria-pressed={on}
                className={cn("inline-flex items-center gap-1.5 py-2 pl-3.5", isCustom(f) && !on ? "pr-1.5" : "pr-3.5")}
              >
                {on && <Check className="size-3.5" />}
                {f}
              </button>
              {isCustom(f) && !on && (
                <button
                  type="button"
                  onClick={() => remove(f)}
                  aria-label={`Remover ${f} da lista`}
                  title="Remover da lista"
                  className="mr-1.5 grid size-5 place-items-center rounded-full text-subtle/70 hover:bg-soft hover:text-ink"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Nova comodidade (ex.: Quadra de tênis)"
          maxLength={40}
          className="h-10 max-w-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={!name.trim() || busy}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-hairline px-4 text-xs font-medium text-ink transition-colors hover:bg-soft disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Incluir
        </button>
      </div>
      <p className="text-[11px] text-subtle">
        Fica salva no sistema e aparece para todos os imóveis. O <span className="font-mono">×</span> tira da lista as que você cadastrou.
      </p>
    </div>
  );
}
