"use client";

import { TYPE_LABELS } from "@/lib/labels";
import { RURAL_TYPES } from "@/lib/rural";
import { searchHref } from "@/lib/site-search";
import { cn } from "@/lib/utils";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type Tab = "venda" | "aluguel" | "rurais";

const PRICES: Record<Exclude<Tab, "rurais">, { v: string; label: string }[]> = {
  venda: [
    { v: "300000", label: "R$ 300 mil" },
    { v: "500000", label: "R$ 500 mil" },
    { v: "800000", label: "R$ 800 mil" },
    { v: "1000000", label: "R$ 1 milhão" },
    { v: "2000000", label: "R$ 2 milhões" },
    { v: "5000000", label: "R$ 5 milhões" },
  ],
  aluguel: [
    { v: "2000", label: "R$ 2 mil" },
    { v: "3000", label: "R$ 3 mil" },
    { v: "5000", label: "R$ 5 mil" },
    { v: "8000", label: "R$ 8 mil" },
    { v: "15000", label: "R$ 15 mil" },
  ],
};

/** Rurais buscam por tamanho, em alqueires ("min-max"; vazio = sem limite) */
const SIZES = [
  { v: "-10", label: "Até 10 alq" },
  { v: "10-50", label: "De 10 a 50 alq" },
  { v: "50-100", label: "De 50 a 100 alq" },
  { v: "100-300", label: "De 100 a 300 alq" },
  { v: "300-1000", label: "De 300 a 1.000 alq" },
  { v: "1000-", label: "Acima de 1.000 alq" },
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function Box({
  label,
  className,
  group,
  children,
}: {
  label: string;
  className?: string;
  /** Grupo de botões: usa <div role="group"> em vez de <label> */
  group?: boolean;
  children: ReactNode;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag
      role={group ? "group" : undefined}
      aria-label={group ? label : undefined}
      className={cn(
        "relative flex min-w-0 flex-col justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 transition-colors focus-within:border-white/40 hover:border-white/25",
        className,
      )}
    >
      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/55">{label}</span>
      {children}
    </Tag>
  );
}

const control =
  "w-full min-w-0 appearance-none truncate bg-transparent py-0.5 pr-5 text-[15px] text-white outline-none placeholder:text-white/45 [&>option]:bg-[#111110] [&>option]:text-white";

export function HomeSearch({
  urbanTypes,
  places,
  neighborhoods,
  cities,
  hasRural,
  hasRent,
  buttonLabel,
}: {
  /** Tipos urbanos com imóveis publicados */
  urbanTypes: string[];
  /** Sugestões do campo "Onde" (bairros e cidades) */
  places: string[];
  neighborhoods: string[];
  cities: string[];
  hasRural: boolean;
  hasRent: boolean;
  buttonLabel: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("venda");
  const [where, setWhere] = useState("");
  const [tipo, setTipo] = useState("");
  const [preco, setPreco] = useState("");
  const [quartos, setQuartos] = useState(0);

  const tabs = [
    { id: "venda" as const, label: "Comprar" },
    ...(hasRent ? [{ id: "aluguel" as const, label: "Alugar" }] : []),
    ...(hasRural ? [{ id: "rurais" as const, label: "Rurais" }] : []),
  ];
  const types = tab === "rurais" ? [...RURAL_TYPES] : urbanTypes;

  function pick(t: Tab) {
    setTab(t);
    setTipo("");
    setPreco("");
    if (t === "rurais") setQuartos(0);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // "Onde": bairro ou cidade conhecidos viram filtro exato; o resto vira texto livre
    const w = norm(where);
    const bairro = w ? neighborhoods.find((n) => norm(n) === w) : undefined;
    const cidade = w && !bairro ? cities.find((c) => norm(c) === w) : undefined;
    router.push(
      searchHref({
        categoria: tab === "rurais" ? "rurais" : undefined,
        finalidade: tab === "rurais" ? "" : tab,
        tipo,
        bairro,
        cidade,
        q: !bairro && !cidade ? where.trim() : "",
        precoMax: tab === "rurais" ? "" : preco,
        areaMin: tab === "rurais" ? preco.split("-")[0] : "",
        areaMax: tab === "rurais" ? preco.split("-")[1] ?? "" : "",
        quartos,
      }),
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full rounded-2xl border border-white/15 bg-black/45 p-2.5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-3"
    >
      <div className="mb-2.5 flex gap-1" role="tablist" aria-label="O que você procura">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => pick(t.id)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 sm:flex-none",
              tab === t.id ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-2",
          tab === "rurais"
            ? "md:grid-cols-[1.7fr_1fr_1fr_auto]"
            : "md:grid-cols-[1.5fr_1fr_1fr_1.15fr_auto]",
        )}
      >
        <Box label="Onde" className="col-span-2 md:col-span-1">
          <span className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-white/50" />
            <input
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              list="home-search-places"
              placeholder={tab === "rurais" ? "Cidade ou região" : "Bairro, cidade ou código"}
              className={control}
              enterKeyHint="search"
            />
          </span>
          <datalist id="home-search-places">
            {places.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Box>

        <Box label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={control}>
            <option value="">Todos</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute bottom-3 right-3 size-4 text-white/50" />
        </Box>

        <Box label={tab === "rurais" ? "Tamanho" : "Preço até"}>
          <select value={preco} onChange={(e) => setPreco(e.target.value)} className={control}>
            <option value="">Qualquer</option>
            {(tab === "rurais" ? SIZES : PRICES[tab]).map((p) => (
              <option key={p.v} value={p.v}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute bottom-3 right-3 size-4 text-white/50" />
        </Box>

        {tab !== "rurais" && (
          <Box label="Quartos" group className="col-span-2 md:col-span-1">
            <span className="flex gap-1 pt-0.5">
              {[0, 1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuartos(n)}
                  aria-pressed={quartos === n}
                  className={cn(
                    "h-7 flex-1 rounded-md text-xs font-medium transition-colors md:min-w-0",
                    quartos === n ? "bg-white text-black" : "text-white/70 hover:bg-white/10",
                  )}
                >
                  {n === 0 ? "Todos" : `${n}+`}
                </button>
              ))}
            </span>
          </Box>
        )}

        <button
          type="submit"
          className="col-span-2 inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-accent px-7 text-[15px] font-semibold text-on-accent transition-all duration-300 ease-expo hover:brightness-110 active:scale-[0.98] md:col-span-1 md:h-auto"
        >
          <Search className="size-4" />
          {buttonLabel}
        </button>
      </div>
    </form>
  );
}
