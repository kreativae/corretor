"use client";

import { Button, Field, Input, Select } from "@/components/ui";
import {
  ACESSO_LABELS,
  AGUA_OPCOES,
  ALQUEIRE_HA,
  APTIDAO_LABELS,
  BENFEITORIAS_OPCOES,
  ENERGIA_LABELS,
  formatAlq,
  formatHa,
  formatPct,
  RESERVA_LEGAL_MIN_PCT,
  ruralAreas,
  SOLO_LABELS,
  TOPOGRAFIA_LABELS,
  type RuralData,
} from "@/lib/rural";
import { MAX_UPLOAD_BYTES, sendFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, FileUp, Loader2, Map as MapIcon, ShieldCheck, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const sectionCls = "rounded-2xl border border-hairline bg-card p-6";
const h2Cls = "mb-5 font-display text-base font-semibold tracking-tight";

/** "12,5" / "12.5" / "1.200,75" → número; vazio → null */
function parseDecimal(raw: string): number | null {
  const s = raw.replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const toText = (v: number | null) =>
  v == null ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 4, useGrouping: false });

/** Campo numérico com vírgula decimal (ex.: 12,5 alqueires). */
function DecimalInput({
  value,
  onChange,
  suffix,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => toText(value));
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.,]/g, "");
          setText(v);
          onChange(parseDecimal(v));
        }}
        onBlur={() => setText(toText(parseDecimal(text)))}
        className={cn("h-10 font-mono tabular", suffix && "pr-12")}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-subtle">
          {suffix}
        </span>
      )}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-all duration-200",
              on
                ? "border-transparent bg-accent text-on-accent"
                : "border-hairline text-subtle hover:border-hairline-strong hover:text-ink",
            )}
          >
            {on && <Check className="size-3.5" />}
            {o}
          </button>
        );
      })}
    </div>
  );
}

const SEGMENTS = [
  { key: "plantada", label: "Plantada", cls: "bg-amber-500" },
  { key: "pastagem", label: "Pastagem", cls: "bg-lime-500" },
  { key: "outras", label: "Outras áreas abertas", cls: "bg-neutral-400" },
  { key: "reserva", label: "Reserva legal", cls: "bg-emerald-700" },
  { key: "app", label: "APP", cls: "bg-sky-600" },
] as const;

/** Painel de cálculo: distribuição das áreas e checagem da reserva legal. */
export function RuralAreaSummary({ r, compact }: { r: RuralData; compact?: boolean }) {
  const a = ruralAreas(r);
  if (!a.total) {
    return (
      <p className="rounded-xl bg-soft p-4 text-xs text-subtle">
        Informe a área total para ver o cálculo da propriedade.
      </p>
    );
  }
  const values: Record<(typeof SEGMENTS)[number]["key"], number> = {
    plantada: a.plantada,
    pastagem: a.pastagem,
    outras: a.outras,
    reserva: a.reserva,
    app: a.app,
  };
  const base = Math.max(a.total, a.plantada + a.pastagem + a.reserva + a.app);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Total", a.total, "da propriedade"],
          ["Aberta", a.aberta, "total − reserva − APP"],
          ["Preservada", a.reserva + a.app, "reserva + APP"],
        ].map(([label, v, hint]) => (
          <div key={label as string} className="rounded-xl bg-soft p-3">
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-subtle">{label}</p>
            <p className="mt-1 font-mono text-lg font-medium leading-tight tabular">
              {formatAlq(v as number)} <span className="text-xs text-subtle">alq</span>
            </p>
            <p className="font-mono text-[10.5px] text-subtle">{formatHa(v as number)} ha</p>
            {!compact && <p className="mt-1 text-[10px] text-subtle">{hint}</p>}
          </div>
        ))}
      </div>

      <div className="flex h-3 overflow-hidden rounded-full bg-soft">
        {SEGMENTS.map((s) =>
          values[s.key] > 0 ? (
            <div
              key={s.key}
              className={s.cls}
              style={{ width: `${(values[s.key] / base) * 100}%` }}
              title={`${s.label}: ${formatAlq(values[s.key])} alq`}
            />
          ) : null,
        )}
      </div>

      <ul className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-sm", s.cls)} />
            <span className="text-subtle">{s.label}</span>
            <span className="ml-auto font-mono tabular">
              {formatAlq(values[s.key])} alq · {formatPct((values[s.key] / a.total) * 100)}
            </span>
          </li>
        ))}
      </ul>

      <div
        className={cn(
          "flex items-start gap-2.5 rounded-xl p-3 text-xs",
          a.reservaOk ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600",
        )}
      >
        {a.reservaOk ? (
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        )}
        <span>
          Reserva legal: <strong>{formatPct(a.reservaPct)}</strong> da área total
          {a.reservaOk
            ? ` — atende ao mínimo de ${RESERVA_LEGAL_MIN_PCT}%.`
            : ` — abaixo do mínimo de ${RESERVA_LEGAL_MIN_PCT}% (${formatAlq(a.reservaMin)} alq). Faltam ${formatAlq(a.reservaMin - a.reserva)} alq.`}
        </span>
      </div>

      {a.inconsistente && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 p-3 text-xs text-red-500">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Plantada + pastagem + reserva + APP somam {formatAlq(a.total + a.excesso)} alq,{" "}
            {formatAlq(a.excesso)} alq acima da área total. Revise os valores.
          </span>
        </div>
      )}
    </div>
  );
}

function KmzField({
  url,
  name,
  onChange,
}: {
  url: string;
  name: string;
  onChange: (url: string, name: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function upload(file: File) {
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "kmz" && ext !== "kml") {
      toast.error("Envie um arquivo .kmz ou .kml (Google Earth).");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Arquivo acima de 4 MB.");
      return;
    }
    setProgress(0);
    try {
      const uploaded = await sendFile(file, setProgress, "kmz");
      onChange(uploaded, file.name);
      toast.success("Mapa anexado. Salve a propriedade para publicar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      {url ? (
        <div className="flex items-center gap-3 rounded-xl border border-hairline p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <MapIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name || "perímetro.kmz"}</p>
            <a href={url} className="text-[11px] text-subtle underline-offset-2 hover:underline">
              Baixar arquivo
            </a>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
            Trocar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("", "")} aria-label="Remover KMZ">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline-strong px-4 py-7 text-center transition-colors hover:bg-soft"
        >
          {progress !== null ? (
            <>
              <Loader2 className="size-5 animate-spin text-subtle" />
              <span className="font-mono text-xs tabular">{Math.round(progress)}%</span>
            </>
          ) : (
            <>
              <FileUp className="size-6 text-subtle" />
              <span className="text-sm font-medium">Anexar KMZ do perímetro</span>
              <span className="text-xs text-subtle">
                Arquivo do Google Earth (.kmz ou .kml). Vira mapa no site e QR code na ficha.
              </span>
            </>
          )}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Seções do cadastro rural (coluna principal do formulário). */
export function RuralFields({
  value,
  onChange,
}: {
  value: RuralData;
  onChange: (next: RuralData) => void;
}) {
  const set = <K extends keyof RuralData>(k: K, v: RuralData[K]) => onChange({ ...value, [k]: v });
  const showCabecas = value.aptidao === "pecuaria" || value.aptidao === "dupla";

  return (
    <>
      {/* Áreas */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>
          Áreas
          <span className="ml-2 font-mono text-[11px] font-normal text-subtle">
            alqueire paulista (PR) · 1 alq = {ALQUEIRE_HA.toLocaleString("pt-BR")} ha
          </span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Área total da propriedade" className="sm:col-span-2">
            <DecimalInput value={value.totalAlq} onChange={(v) => set("totalAlq", v)} suffix="alq" placeholder="Ex.: 120" />
          </Field>
          <Field label="Reserva legal" hint={`Mínimo ${RESERVA_LEGAL_MIN_PCT}% da área total`}>
            <DecimalInput value={value.reservaAlq} onChange={(v) => set("reservaAlq", v)} suffix="alq" />
          </Field>
          <Field label="APP (preservação permanente)" hint="Matas ciliares, nascentes">
            <DecimalInput value={value.appAlq} onChange={(v) => set("appAlq", v)} suffix="alq" />
          </Field>
          <Field label="Área plantada (lavoura)">
            <DecimalInput value={value.plantadaAlq} onChange={(v) => set("plantadaAlq", v)} suffix="alq" />
          </Field>
          <Field label="Pastagem formada">
            <DecimalInput value={value.pastagemAlq} onChange={(v) => set("pastagemAlq", v)} suffix="alq" />
          </Field>
        </div>
        <div className="mt-6">
          <RuralAreaSummary r={value} />
        </div>
      </section>

      {/* Aptidão */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>Aptidão e uso</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(APTIDAO_LABELS).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => set("aptidao", value.aptidao === k ? "" : (k as RuralData["aptidao"]))}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                value.aptidao === k
                  ? "border-transparent bg-accent text-on-accent"
                  : "border-hairline text-subtle hover:border-hairline-strong hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-subtle">
          Dupla aptidão = serve tanto para pecuária quanto para agricultura.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Culturas" hint="Atuais ou aptas" className={showCabecas ? "" : "sm:col-span-2"}>
            <Input
              value={value.culturas}
              onChange={(e) => set("culturas", e.target.value)}
              placeholder="Soja, milho safrinha, trigo"
              className="h-10"
            />
          </Field>
          {showCabecas && (
            <Field label="Capacidade de lotação" hint="Cabeças">
              <DecimalInput value={value.cabecas} onChange={(v) => set("cabecas", v)} suffix="cab." />
            </Field>
          )}
        </div>
      </section>

      {/* Terreno e infraestrutura */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>Terreno e infraestrutura</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Topografia">
            <Select value={value.topografia} onChange={(e) => set("topografia", e.target.value as RuralData["topografia"])}>
              <option value="">—</option>
              {Object.entries(TOPOGRAFIA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Solo">
            <Select value={value.solo} onChange={(e) => set("solo", e.target.value as RuralData["solo"])}>
              <option value="">—</option>
              {Object.entries(SOLO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Energia elétrica">
            <Select value={value.energia} onChange={(e) => set("energia", e.target.value as RuralData["energia"])}>
              <option value="">—</option>
              {Object.entries(ENERGIA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Acesso">
            <Select value={value.acesso} onChange={(e) => set("acesso", e.target.value as RuralData["acesso"])}>
              <option value="">—</option>
              {Object.entries(ACESSO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Distância da cidade">
            <DecimalInput value={value.distanciaCidadeKm} onChange={(v) => set("distanciaCidadeKm", v)} suffix="km" />
          </Field>
          <Field label="Distância do asfalto">
            <DecimalInput value={value.distanciaAsfaltoKm} onChange={(v) => set("distanciaAsfaltoKm", v)} suffix="km" />
          </Field>
        </div>
        <div className="mt-6 space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium text-subtle">Recursos hídricos</p>
            <Chips options={AGUA_OPCOES} value={value.agua} onChange={(v) => set("agua", v)} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-subtle">Benfeitorias</p>
            <Chips options={BENFEITORIAS_OPCOES} value={value.benfeitorias} onChange={(v) => set("benfeitorias", v)} />
          </div>
        </div>
      </section>

      {/* Documentação */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>Documentação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Matrícula">
            <Input value={value.matricula} onChange={(e) => set("matricula", e.target.value)} className="h-10" />
          </Field>
          <Field label="CAR" hint="Cadastro Ambiental Rural">
            <Input value={value.car} onChange={(e) => set("car", e.target.value)} className="h-10 font-mono text-xs" placeholder="PR-4113700-…" />
          </Field>
          <Field label="CCIR">
            <Input value={value.ccir} onChange={(e) => set("ccir", e.target.value)} className="h-10" />
          </Field>
          <Field label="NIRF / ITR">
            <Input value={value.nirf} onChange={(e) => set("nirf", e.target.value)} className="h-10" />
          </Field>
        </div>
        <p className="mt-3 text-[11px] text-subtle">
          Documentos ficam só no CRM — não aparecem no site nem na ficha.
        </p>
      </section>

      {/* KMZ */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>Mapa do perímetro (KMZ)</h2>
        <KmzField
          url={value.kmzUrl}
          name={value.kmzName}
          onChange={(url, name) => onChange({ ...value, kmzUrl: url, kmzName: name })}
        />
      </section>
    </>
  );
}
