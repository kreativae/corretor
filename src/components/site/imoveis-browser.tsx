"use client";

import { PropertyCard } from "@/components/site/property-card";
import { EmptyState, Input, Select } from "@/components/ui";
import { TYPE_LABELS } from "@/lib/labels";
import type { PropertyWithImages } from "@/lib/queries";
import { cn, plural } from "@/lib/utils";
import { Building2, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

const TYPES = ["apartamento", "casa", "cobertura", "estudio", "terreno"];

export function ImoveisBrowser({
  properties,
}: {
  properties: PropertyWithImages[];
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [purpose, setPurpose] = useState("all");
  const [hood, setHood] = useState("all");
  const [sort, setSort] = useState("recent");

  const hoods = useMemo(
    () => [...new Set(properties.map((p) => p.neighborhood))].sort(),
    [properties],
  );

  const filtered = useMemo(() => {
    let list = properties;
    if (type !== "all") list = list.filter((p) => p.type === type);
    if (purpose !== "all") list = list.filter((p) => p.purpose === purpose);
    if (hood !== "all") list = list.filter((p) => p.neighborhood === hood);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(t) ||
          p.neighborhood.toLowerCase().includes(t) ||
          p.code.toLowerCase().includes(t),
      );
    }
    if (sort === "priceAsc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "priceDesc")
      list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [properties, q, type, purpose, hood, sort]);

  return (
    <div className="mt-10">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por bairro, nome ou código…"
            className="pl-10"
          />
        </div>
        <Select value={hood} onChange={(e) => setHood(e.target.value)} className="w-auto">
          <option value="all">Todos os bairros</option>
          {hoods.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto">
          <option value="recent">Mais recentes</option>
          <option value="priceAsc">Menor preço</option>
          <option value="priceDesc">Maior preço</option>
        </Select>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="size-4 text-subtle" />
        {["all", ...TYPES].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-300",
              type === t
                ? "border-transparent bg-ink text-canvas"
                : "border-hairline text-subtle hover:border-hairline-strong hover:text-ink",
            )}
          >
            {t === "all" ? "Todos" : TYPE_LABELS[t]}
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-hairline sm:block" />
        {[
          { id: "all", label: "Comprar e alugar" },
          { id: "venda", label: "Comprar" },
          { id: "aluguel", label: "Alugar" },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPurpose(p.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-300",
              purpose === p.id
                ? "border-transparent bg-accent text-on-accent"
                : "border-hairline text-subtle hover:border-hairline-strong hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-8 font-mono text-xs uppercase tracking-[0.16em] text-subtle">
        {filtered.length} {plural(filtered.length, "imóvel", "imóveis")}{" "}
        encontrados
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="Nada por aqui — ainda"
            description="Tente ampliar os filtros ou fale com um curador: temos imóveis off-market que não entram na vitrine."
            action={
              <button
                onClick={() => {
                  setQ("");
                  setType("all");
                  setPurpose("all");
                  setHood("all");
                }}
                className="rounded-full border border-hairline px-4 py-2 text-sm transition-colors hover:bg-soft"
              >
                Limpar filtros
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <PropertyCard property={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
