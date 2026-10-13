"use client";

import { Input, Select } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import {
  ArrowLeftRight,
  Banknote,
  Calculator,
  Handshake,
  Home,
  Landmark,
  Percent,
  Ruler,
  Tag,
} from "lucide-react";
import { useState, type ReactNode } from "react";

/* ─────────────────────── utilidades ─────────────────────── */

/** "1.850.000", "2,5", "2.5" → número (vazio/ inválido = 0) */
function num(v: string) {
  const s = v.trim();
  if (!s) return 0;
  let t: string;
  if (s.includes(",")) t = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) t = s.replace(/\./g, "");
  else t = s;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

const dec = (n: number, max = 2) =>
  Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: max }) : "—";
const money = (n: number) => (Number.isFinite(n) && n ? formatBRL(n) : "—");
const pct = (n: number, max = 2) => (Number.isFinite(n) ? `${dec(n, max)}%` : "—");

/** Unidades de área em m² (alqueire paulista é o usado no PR/SP) */
const UNITS = [
  { id: "alq", label: "Alqueire paulista", short: "alq", m2: 24_200, hint: "2,42 ha · PR, SP" },
  { id: "alqmg", label: "Alqueire mineiro / goiano", short: "alq MG", m2: 48_400, hint: "4,84 ha · MG, GO, RJ" },
  { id: "alqba", label: "Alqueire baiano", short: "alq BA", m2: 96_800, hint: "9,68 ha" },
  { id: "alqn", label: "Alqueire do norte", short: "alq N", m2: 27_225, hint: "2,72 ha" },
  { id: "ha", label: "Hectare", short: "ha", m2: 10_000, hint: "10.000 m²" },
  { id: "m2", label: "Metro quadrado", short: "m²", m2: 1, hint: "" },
  { id: "km2", label: "Quilômetro quadrado", short: "km²", m2: 1_000_000, hint: "100 ha" },
  { id: "acre", label: "Acre", short: "acre", m2: 4_046.86, hint: "0,40 ha" },
] as const;
type UnitId = (typeof UNITS)[number]["id"];
const unit = (id: UnitId) => UNITS.find((u) => u.id === id)!;

/* ─────────────────────── peças de UI ─────────────────────── */

function Card({
  icon: Icon,
  title,
  desc,
  children,
  className,
}: {
  icon: typeof Calculator;
  title: string;
  desc?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex h-full flex-col rounded-2xl border border-hairline bg-card p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
          {desc && <p className="mt-0.5 text-xs text-subtle">{desc}</p>}
        </div>
      </div>
      {/* Resultados descem para o rodapé do card: cards lado a lado ficam alinhados */}
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function Num({
  label,
  value,
  onChange,
  suffix,
  prefix,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  prefix?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-xs font-medium text-subtle">{label}</span>
      <span className="relative block">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-xs text-subtle">
            {prefix}
          </span>
        )}
        <Input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          className={cn("h-10 font-mono tabular", prefix && "pl-10", suffix && "pr-16")}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-subtle">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

/** Valor em reais com separador de milhar enquanto digita */
function Money({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-xs font-medium text-subtle">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-xs text-subtle">
          R$
        </span>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 pl-10 font-mono tabular"
        />
      </span>
    </label>
  );
}

function Picks({
  values,
  current,
  onPick,
  suffix = "%",
}: {
  values: number[];
  current: string;
  onPick: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {values.map((v) => {
        const on = num(current) === v && current !== "";
        return (
          <button
            key={v}
            type="button"
            onClick={() => onPick(String(v).replace(".", ","))}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
              on ? "border-transparent bg-ink text-canvas" : "border-hairline text-subtle hover:text-ink",
            )}
          >
            {dec(v)}
            {suffix}
          </button>
        );
      })}
    </div>
  );
}

function Rows({ rows }: { rows: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean }[] }) {
  return (
    <div className="mt-auto pt-5">
      <dl className="space-y-2 rounded-xl bg-soft px-4 py-3.5 text-sm">
        {rows.map((r, i) => (
          <div
            key={i}
            className={cn(
              "flex items-baseline justify-between gap-4",
              r.strong && "border-t border-hairline pt-2 font-semibold",
              r.muted && "text-xs",
            )}
          >
            <dt className={cn(!r.strong && "text-subtle")}>{r.label}</dt>
            <dd className="shrink-0 text-right font-mono tabular">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="mb-4 flex gap-1 rounded-xl border border-hairline p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "h-8 flex-1 rounded-lg text-xs font-medium transition-colors",
            value === v ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function UnitSelect({ value, onChange, label = "Unidade" }: { value: UnitId; onChange: (v: UnitId) => void; label?: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-subtle">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value as UnitId)} className="h-10">
        {UNITS.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

/* ─────────────────────── calculadoras ─────────────────────── */

function CommissionCalc() {
  const [price, setPrice] = useState("");
  const [comm, setComm] = useState("6");
  const [share, setShare] = useState("");
  const [broker, setBroker] = useState("");
  const [tax, setTax] = useState("");

  const p = num(price);
  const total = (p * num(comm)) / 100;
  const partner = (total * num(share)) / 100;
  const ours = total - partner;
  const brokerV = (ours * num(broker)) / 100;
  const taxV = (ours * num(tax)) / 100;
  const net = ours - brokerV - taxV;

  return (
    <Card icon={Handshake} title="Comissão e divisão" desc="Comissão sobre o valor e como ela se divide.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Money label="Valor do imóvel / empreendimento" value={price} onChange={setPrice} className="sm:col-span-2" />
        <div>
          <Num label="Comissão" value={comm} onChange={setComm} suffix="% do valor" />
          <Picks values={[3, 5, 6, 8]} current={comm} onPick={setComm} />
        </div>
        <div>
          <Num label="Repasse ao parceiro" value={share} onChange={setShare} suffix="% da com." placeholder="0" />
          <Picks values={[30, 40, 50, 60]} current={share} onPick={setShare} />
        </div>
        <Num label="Corretor (sobre a parte da imobiliária)" value={broker} onChange={setBroker} suffix="%" placeholder="0" />
        <Num label="Impostos (sobre a parte da imobiliária)" value={tax} onChange={setTax} suffix="%" placeholder="0" />
      </div>
      <Rows
        rows={[
          { label: `Comissão total (${pct(num(comm))})`, value: money(total) },
          ...(num(share) ? [{ label: `Repasse ao parceiro (${pct(num(share))} da comissão)`, value: money(partner) }] : []),
          ...(num(share) || num(broker) || num(tax) ? [{ label: "Parte da imobiliária", value: money(ours) }] : []),
          ...(num(broker) ? [{ label: `Corretor (${pct(num(broker))})`, value: money(brokerV) }] : []),
          ...(num(tax) ? [{ label: `Impostos (${pct(num(tax))})`, value: money(taxV) }] : []),
          { label: "Fica líquido para a imobiliária", value: money(net), strong: true },
          ...(p && net ? [{ label: "Equivale a", value: `${pct((net / p) * 100, 3)} do valor`, muted: true }] : []),
        ]}
      />
    </Card>
  );
}

function AreaConverter() {
  const [value, setValue] = useState("10");
  const [from, setFrom] = useState<UnitId>("alq");
  const m2 = num(value) * unit(from).m2;

  return (
    <Card icon={ArrowLeftRight} title="Conversor de áreas" desc="Alqueire, hectare, metro quadrado e outras medidas.">
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <Num label="Quantidade" value={value} onChange={setValue} />
          <UnitSelect value={from} onChange={setFrom} label="Em" />
          <p className="text-[11px] text-subtle">
            No Paraná e em São Paulo, &quot;alqueire&quot; é o paulista: 24.200 m² = 2,42 ha.
          </p>
        </div>
        <dl className="grid gap-px overflow-hidden rounded-xl bg-hairline sm:grid-cols-2 xl:grid-cols-4">
          {UNITS.map((u) => (
            <div
              key={u.id}
              className={cn("flex flex-col justify-between gap-1 bg-soft px-4 py-3", u.id === from && "bg-accent/10")}
            >
              <dt className="text-xs text-subtle">
                <span className={cn("font-medium", u.id === from ? "text-accent" : "text-ink")}>{u.label}</span>
                {u.hint && <span className="block text-[10.5px]">{u.hint}</span>}
              </dt>
              <dd className="font-mono text-base tabular">
                {dec(m2 / u.m2, u.m2 >= 10_000 ? 4 : 2)} <span className="text-xs text-subtle">{u.short}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

function PricePerArea() {
  const [mode, setMode] = useState<"total" | "unit">("total");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [u, setU] = useState<UnitId>("alq");
  const m2 = num(area) * unit(u).m2;
  const total = mode === "total" ? num(price) : num(price) * num(area);
  const perM2 = m2 ? total / m2 : NaN;

  return (
    <Card icon={Tag} title="Preço por área" desc="Quanto custa o alqueire, o hectare ou o m² — ou o total a partir dele.">
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          ["total", "Tenho o valor total"],
          ["unit", "Tenho o preço por unidade"],
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Money
          label={mode === "total" ? "Valor total" : `Preço por ${unit(u).short}`}
          value={price}
          onChange={setPrice}
          className="sm:col-span-2"
        />
        <Num label="Área" value={area} onChange={setArea} />
        <UnitSelect value={u} onChange={setU} />
      </div>
      <Rows
        rows={[
          ...(mode === "unit" ? [{ label: "Valor total", value: money(total), strong: true }] : []),
          { label: "Por alqueire (paulista)", value: money(perM2 * 24_200) },
          { label: "Por hectare", value: money(perM2 * 10_000) },
          { label: "Por m²", value: Number.isFinite(perM2) && perM2 ? formatBRL(perM2) : "—" },
        ]}
      />
    </Card>
  );
}

function LotSize() {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  // Irregular: média das frentes × média das laterais (aproximação)
  const w = num(back) ? (num(front) + num(back)) / 2 : num(front);
  const d = num(right) ? (num(left) + num(right)) / 2 : num(left);
  const m2 = w * d;

  return (
    <Card icon={Ruler} title="Medidas do terreno" desc="Frente × fundo. Em terreno irregular, preencha os quatro lados.">
      <div className="grid grid-cols-2 gap-4">
        <Num label="Frente" value={front} onChange={setFront} suffix="m" />
        <Num label="Fundos (opcional)" value={back} onChange={setBack} suffix="m" placeholder="= frente" />
        <Num label="Lateral esquerda" value={left} onChange={setLeft} suffix="m" />
        <Num label="Lateral direita (opcional)" value={right} onChange={setRight} suffix="m" placeholder="= esquerda" />
      </div>
      <Rows
        rows={[
          { label: "Área", value: m2 ? `${dec(m2)} m²` : "—", strong: true },
          { label: "Em hectares", value: m2 ? `${dec(m2 / 10_000, 4)} ha` : "—" },
          { label: "Em alqueires (paulista)", value: m2 ? `${dec(m2 / 24_200, 4)} alq` : "—" },
        ]}
      />
      {(num(back) || num(right)) > 0 && (
        <p className="mt-3 text-[11px] text-subtle">
          Lados diferentes: cálculo aproximado pela média. Para a área exata, confira na matrícula ou no levantamento.
        </p>
      )}
    </Card>
  );
}

function Financing() {
  const [price, setPrice] = useState("");
  const [down, setDown] = useState("20");
  const [rate, setRate] = useState("11");
  const [years, setYears] = useState("30");
  const [sys, setSys] = useState<"sac" | "price">("sac");

  const p = num(price);
  const loan = p * (1 - num(down) / 100);
  const n = Math.round(num(years) * 12);
  const i = Math.pow(1 + num(rate) / 100, 1 / 12) - 1; // taxa efetiva mensal

  let first = NaN;
  let last = NaN;
  let totalPaid = NaN;
  if (loan > 0 && n > 0) {
    if (sys === "price") {
      first = last = i ? (loan * i) / (1 - Math.pow(1 + i, -n)) : loan / n;
      totalPaid = first * n;
    } else {
      const amort = loan / n;
      first = amort + loan * i;
      last = amort + amort * i;
      totalPaid = loan + (i * amort * n * (n + 1)) / 2;
    }
  }

  return (
    <Card icon={Landmark} title="Simulação de financiamento" desc="Estimativa sem seguros e taxas do banco.">
      <Seg
        value={sys}
        onChange={setSys}
        options={[
          ["sac", "SAC (parcela cai)"],
          ["price", "Price (parcela fixa)"],
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Money label="Valor do imóvel" value={price} onChange={setPrice} />
        <Num label="Juros ao ano" value={rate} onChange={setRate} suffix="% a.a." />
        <div>
          <Num label="Entrada" value={down} onChange={setDown} suffix="%" />
          <Picks values={[20, 30, 50]} current={down} onPick={setDown} />
        </div>
        <div>
          <Num label="Prazo" value={years} onChange={setYears} suffix="anos" />
          <Picks values={[10, 20, 30, 35]} current={years} onPick={setYears} suffix="" />
        </div>
      </div>
      <Rows
        rows={[
          { label: "Entrada", value: money(p - loan) },
          { label: "Valor financiado", value: money(loan) },
          { label: sys === "sac" ? "1ª parcela" : "Parcela", value: money(first), strong: true },
          ...(sys === "sac" ? [{ label: "Última parcela", value: money(last) }] : []),
          { label: "Total pago ao banco", value: money(totalPaid) },
          { label: "Total de juros", value: money(totalPaid - loan) },
          { label: "Renda familiar sugerida (parcela ≤ 30%)", value: money(first / 0.3), muted: true },
        ]}
      />
    </Card>
  );
}

function PurchaseCosts() {
  const [price, setPrice] = useState("");
  const [itbi, setItbi] = useState("2");
  const [notary, setNotary] = useState("1,5");
  const p = num(price);
  const itbiV = (p * num(itbi)) / 100;
  const notaryV = (p * num(notary)) / 100;

  return (
    <Card icon={Banknote} title="Custos de compra" desc="ITBI, escritura e registro — para o comprador se programar.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Money label="Valor do imóvel" value={price} onChange={setPrice} className="sm:col-span-2" />
        <Num label="ITBI (confira a alíquota da cidade)" value={itbi} onChange={setItbi} suffix="%" />
        <Num label="Escritura + registro (estimativa)" value={notary} onChange={setNotary} suffix="%" />
      </div>
      <Rows
        rows={[
          { label: "ITBI", value: money(itbiV) },
          { label: "Escritura e registro", value: money(notaryV) },
          { label: "Total de custos", value: money(itbiV + notaryV), strong: true },
          { label: "Valor + custos", value: money(p + itbiV + notaryV), muted: true },
        ]}
      />
    </Card>
  );
}

function RentCalc() {
  const [value, setValue] = useState("");
  const [rent, setRent] = useState("");
  const [fee, setFee] = useState("10");
  const v = num(value);
  const r = num(rent);
  const feeV = (r * num(fee)) / 100;

  return (
    <Card icon={Home} title="Aluguel e rentabilidade" desc="Quanto o imóvel rende e quanto fica para cada um.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Money label="Valor do imóvel" value={value} onChange={setValue} />
        <Money label="Aluguel mensal" value={rent} onChange={setRent} />
        <div className="sm:col-span-2">
          <Num label="Taxa de administração" value={fee} onChange={setFee} suffix="% do aluguel" />
          <Picks values={[6, 8, 10, 12]} current={fee} onPick={setFee} />
        </div>
      </div>
      <Rows
        rows={[
          { label: "Rentabilidade ao mês", value: v && r ? pct((r / v) * 100, 3) : "—" },
          { label: "Rentabilidade ao ano", value: v && r ? pct((r * 12 * 100) / v) : "—", strong: true },
          { label: "Taxa da imobiliária / mês", value: money(feeV) },
          { label: "Repasse ao proprietário / mês", value: money(r - feeV) },
          { label: "Aluguel sugerido (0,4% a 0,6% do valor)", value: v ? `${money(v * 0.004)} a ${money(v * 0.006)}` : "—", muted: true },
        ]}
      />
    </Card>
  );
}

function Negotiation() {
  const [mode, setMode] = useState<"offer" | "pct">("offer");
  const [ask, setAsk] = useState("");
  const [offer, setOffer] = useState("");
  const [disc, setDisc] = useState("5");
  const a = num(ask);
  const o = mode === "offer" ? num(offer) : a * (1 - num(disc) / 100);
  const diff = a - o;

  return (
    <Card icon={Percent} title="Negociação" desc="Desconto de uma proposta, ou o valor com X% de desconto.">
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          ["offer", "Comparar proposta"],
          ["pct", "Aplicar desconto"],
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Money label="Valor pedido" value={ask} onChange={setAsk} />
        {mode === "offer" ? (
          <Money label="Proposta" value={offer} onChange={setOffer} />
        ) : (
          <div>
            <Num label="Desconto" value={disc} onChange={setDisc} suffix="%" />
            <Picks values={[3, 5, 10, 15]} current={disc} onPick={setDisc} />
          </div>
        )}
      </div>
      <Rows
        rows={[
          ...(mode === "pct" ? [{ label: "Valor com desconto", value: money(o), strong: true }] : []),
          { label: "Diferença", value: money(diff) },
          { label: "Desconto", value: a && o ? pct((diff / a) * 100) : "—", strong: mode === "offer" },
        ]}
      />
    </Card>
  );
}

function PercentCalc() {
  const [mode, setMode] = useState<"of" | "which" | "change">("of");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const x = num(a);
  const y = num(b);

  const labels = {
    of: ["Valor", "Porcentagem", "%"],
    which: ["Valor", "É quantos % de", ""],
    change: ["Valor", "Aumentar / diminuir", "%"],
  } as const;
  const [la, lb, sb] = labels[mode];

  return (
    <Card icon={Percent} title="Porcentagem" desc="Conta rápida: quanto é X%, quantos % um valor representa, acréscimo e desconto.">
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          ["of", "X% de um valor"],
          ["which", "Quantos %"],
          ["change", "+ / − %"],
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Num label={la} value={a} onChange={setA} />
        <Num label={lb} value={b} onChange={setB} suffix={sb || undefined} />
      </div>
      <Rows
        rows={
          mode === "of"
            ? [
                { label: `${pct(y)} de ${dec(x)}`, value: x && y ? dec((x * y) / 100) : "—", strong: true },
                { label: "Valor + porcentagem", value: x && y ? dec(x + (x * y) / 100) : "—" },
                { label: "Valor − porcentagem", value: x && y ? dec(x - (x * y) / 100) : "—" },
              ]
            : mode === "which"
              ? [
                  { label: `${dec(x)} é de ${dec(y)}`, value: x && y ? pct((x / y) * 100) : "—", strong: true },
                  { label: "Diferença entre eles", value: x && y ? `${pct(((x - y) / y) * 100)}` : "—" },
                ]
              : [
                  { label: `${dec(x)} + ${pct(y)}`, value: x && y ? dec(x * (1 + y / 100)) : "—", strong: true },
                  { label: `${dec(x)} − ${pct(y)}`, value: x && y ? dec(x * (1 - y / 100)) : "—", strong: true },
                  { label: "Quanto é a porcentagem", value: x && y ? dec((x * y) / 100) : "—" },
                ]
        }
      />
    </Card>
  );
}

/* ─────────────────────── página ─────────────────────── */

function Group({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-10 first-of-type:mt-8">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline pb-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink">{title}</h2>
        <p className="text-xs text-subtle">{desc}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </div>
  );
}

export function Calculators() {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">Ferramentas</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Calculadora</h1>
      <p className="mt-1 text-sm text-subtle">
        Contas do dia a dia: porcentagem, comissão, conversão de áreas, preço por alqueire, financiamento e mais.
      </p>
      <Group title="Contas rápidas" desc="Porcentagens, descontos e propostas.">
        <PercentCalc />
        <Negotiation />
      </Group>

      <Group title="Venda" desc="O que fica para cada um e o que o comprador paga além do preço.">
        <CommissionCalc />
        <PurchaseCosts />
      </Group>

      <Group title="Áreas e terras" desc="Alqueire, hectare, m² e o preço de cada um.">
        <div className="lg:col-span-2">
          <AreaConverter />
        </div>
        <PricePerArea />
        <LotSize />
      </Group>

      <Group title="Financiamento e aluguel" desc="Parcelas do banco e quanto o imóvel rende.">
        <Financing />
        <RentCalc />
      </Group>

      <p className="mt-6 text-[11px] text-subtle">
        Valores estimados, para orientação. Alíquotas e taxas variam por cidade, cartório e banco.
      </p>
    </div>
  );
}
