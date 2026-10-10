"use client";

import { Kbd } from "@/components/ui";
import { crmPropertyPath, formatAlq, isRuralType, type RuralData } from "@/lib/rural";
import { cn, formatCompact } from "@/lib/utils";
import { Building2, CornerDownLeft, Loader2, Search, Tractor, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Results = {
  properties: {
    id: string;
    code: string;
    title: string;
    neighborhood: string;
    city: string;
    price: number;
    type: string;
    rural: Partial<RuralData> | null;
  }[];
  contacts: { id: string; name: string; phone: string; type: string }[];
};

type Group = "imoveis" | "rurais" | "contatos";
type Item = { group: Group; href: string; id: string; label: string; sub: string };

const GROUP_LABELS: Record<Group, string> = {
  imoveis: "Imóveis",
  rurais: "Propriedades rurais",
  contatos: "Contatos",
};

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>({ properties: [], contacts: [] });
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults({ properties: [], contacts: [] });
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !q.trim()) {
      setResults({ properties: [], contacts: [] });
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  // Ordem fixa dos grupos: imóveis, rurais, contatos
  const toItem = (p: Results["properties"][number]): Item => {
    const rural = isRuralType(p.type);
    return {
      group: rural ? "rurais" : "imoveis",
      href: crmPropertyPath(p),
      id: p.id,
      label: `${p.code} — ${p.title}`,
      sub: rural
        ? `${p.rural?.totalAlq ? `${formatAlq(p.rural.totalAlq)} alq · ` : ""}${p.city} · ${formatCompact(p.price)}`
        : `${p.neighborhood} · ${formatCompact(p.price)}`,
    };
  };
  const items: Item[] = [
    ...results.properties.filter((p) => !isRuralType(p.type)).map(toItem),
    ...results.properties.filter((p) => isRuralType(p.type)).map(toItem),
    ...results.contacts.map((c) => ({
      group: "contatos" as const,
      href: `/crm/contatos/${c.id}`,
      id: c.id,
      label: c.name,
      sub: c.phone,
    })),
  ];

  function go(item: Item) {
    router.push(item.href);
    onClose();
  }

  // Esc fecha a busca mesmo com o foco fora do campo
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && items[sel]) {
      go(items[sel]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 px-4 pt-[14vh] backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="animate-fade-in w-full max-w-xl overflow-hidden rounded-2xl border border-hairline bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-hairline px-5">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-subtle" />
          ) : (
            <Search className="size-4 text-subtle" />
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
            placeholder="Buscar por código, endereço, pessoa…"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle/60"
          />
          <Kbd>esc</Kbd>
        </div>

        <div data-lenis-prevent className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-subtle">
              {q.trim()
                ? "Nenhum resultado. Tente outro termo."
                : "Comece a digitar para buscar em toda a base."}
            </p>
          )}
          {items.map((item, i) => {
            const Icon = item.group === "rurais" ? Tractor : item.group === "imoveis" ? Building2 : User;
            return (
              <div key={`${item.group}-${item.id}`}>
                {item.group !== items[i - 1]?.group && (
                  <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
                    {GROUP_LABELS[item.group]}
                    <span className="opacity-60">
                      {items.filter((x) => x.group === item.group).length}
                    </span>
                  </p>
                )}
                <button
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    sel === i ? "bg-soft" : "",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      item.group === "rurais" ? "bg-emerald-500/10 text-emerald-600" : "bg-soft text-subtle",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    <span className="block truncate font-mono text-[11px] text-subtle">
                      {item.sub}
                    </span>
                  </span>
                  {sel === i && <CornerDownLeft className="size-3.5 text-subtle" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-hairline px-5 py-3 text-[11px] text-subtle">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navegar
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            abrir
          </span>
        </div>
      </div>
    </div>
  );
}
