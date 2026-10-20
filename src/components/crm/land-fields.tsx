"use client";

import { Field, Input, Select } from "@/components/ui";
import {
  DOCUMENTACAO_OPCOES,
  FORMATO_TERRENO,
  INFRA_OPCOES,
  landNumbers,
  POSICAO_SOLAR,
  SITUACAO_OPCOES,
  TOPOGRAFIA_TERRENO,
  USO_PERMITIDO,
  VANTAGENS_OPCOES,
  formatM2,
  type LandData,
} from "@/lib/land";
import { formatBRL } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Chips, Collapsible, DecimalInput } from "./rural-fields";

const sectionCls = "scroll-mt-32 rounded-2xl border border-hairline bg-card p-6";
const h2Cls = "mb-5 font-display text-base font-semibold tracking-tight";
const sub = "mb-2.5 text-xs font-medium text-subtle";

/**
 * Seções do cadastro de terreno (coluna principal do formulário).
 * part "medidas": área, medidas, relevo e situação · "vantagens" · "tecnico": zoneamento,
 * infraestrutura e documentação.
 */
export function LandFields({
  part,
  value: l,
  onChange,
  area,
  onAreaChange,
  price,
}: {
  part: "medidas" | "vantagens" | "tecnico";
  value: LandData;
  onChange: (v: LandData) => void;
  /** Área do terreno em m² (campo `area` do anúncio) */
  area: string;
  onAreaChange: (v: string) => void;
  price: number;
}) {
  const set = <K extends keyof LandData>(k: K, v: LandData[K]) => onChange({ ...l, [k]: v });
  const nums = landNumbers(price, Number(area) || 0, l);

  if (part === "medidas") {
    const calc = l.frenteM && l.fundoM ? Math.round(l.frenteM * l.fundoM) : null;
    return (
      <section id="sec-medidas" className={sectionCls}>
        <h2 className={h2Cls}>Medidas e terreno</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Área total (m²)" className="col-span-2 sm:col-span-1">
            <Input type="number" min={0} value={area} onChange={(e) => onAreaChange(e.target.value)} className="h-10 font-mono tabular" />
          </Field>
          <Field label="Frente">
            <DecimalInput value={l.frenteM} onChange={(v) => set("frenteM", v)} suffix="m" />
          </Field>
          <Field label="Fundo">
            <DecimalInput value={l.fundoM} onChange={(v) => set("fundoM", v)} suffix="m" />
          </Field>
          <Field label="Lateral esquerda">
            <DecimalInput value={l.ladoEsqM} onChange={(v) => set("ladoEsqM", v)} suffix="m" />
          </Field>
          <Field label="Lateral direita">
            <DecimalInput value={l.ladoDirM} onChange={(v) => set("ladoDirM", v)} suffix="m" />
          </Field>
        </div>
        {calc != null && calc !== Number(area) && (
          <button
            type="button"
            onClick={() => onAreaChange(String(calc))}
            className="mt-3 text-xs text-subtle underline underline-offset-2 hover:text-ink"
          >
            Frente × fundo = {formatM2(calc)}. Usar como área total?
          </button>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="Formato">
            <Select value={l.formato} onChange={(e) => set("formato", e.target.value as LandData["formato"])}>
              <option value="">—</option>
              {Object.entries(FORMATO_TERRENO).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Topografia">
            <Select value={l.topografia} onChange={(e) => set("topografia", e.target.value as LandData["topografia"])}>
              <option value="">—</option>
              {Object.entries(TOPOGRAFIA_TERRENO).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Frente voltada para">
            <Select value={l.posicaoSolar} onChange={(e) => set("posicaoSolar", e.target.value as LandData["posicaoSolar"])}>
              <option value="">—</option>
              {Object.entries(POSICAO_SOLAR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-5">
          <p className={sub}>Situação atual</p>
          <Chips options={SITUACAO_OPCOES} value={l.situacao} onChange={(v) => set("situacao", v)} />
        </div>
        <div className="mt-5">
          <Field label="Distância do centro">
            <div className="max-w-[12rem]">
              <DecimalInput value={l.distanciaCentroKm} onChange={(v) => set("distanciaCentroKm", v)} suffix="km" />
            </div>
          </Field>
        </div>
      </section>
    );
  }

  if (part === "vantagens") {
    return (
      <section id="sec-vantagens" className={sectionCls}>
        <h2 className={h2Cls}>
          Vantagens do terreno
          <span className="ml-2 font-mono text-[11px] font-normal text-subtle">{l.vantagens.length} selecionadas</span>
        </h2>
        <p className="-mt-3 mb-4 text-xs text-subtle">
          Os motivos para comprar: aparecem em destaque no site e na ficha. Marque as que valem ou escreva outras.
        </p>
        <Chips options={[...new Set([...VANTAGENS_OPCOES, ...l.vantagens])]} value={l.vantagens} onChange={(v) => set("vantagens", v)} />
        <AddCustom onAdd={(v) => !l.vantagens.includes(v) && set("vantagens", [...l.vantagens, v])} />
      </section>
    );
  }

  const zoneSummary = [
    l.zoneamento && `Zona ${l.zoneamento}`,
    l.usoPermitido.join("/"),
    l.coeficiente && `CA ${String(l.coeficiente).replace(".", ",")}`,
    l.taxaOcupacao && `TO ${l.taxaOcupacao}%`,
  ]
    .filter(Boolean)
    .join(" · ");
  const docSummary = [
    l.loteamento,
    l.quadra && `Quadra ${l.quadra}`,
    l.lote && `Lote ${l.lote}`,
    l.matricula && `Matrícula ${l.matricula}`,
    ...l.documentacao,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <Collapsible id="sec-zona" title="Zoneamento e potencial construtivo" summary={zoneSummary} defaultOpen={!zoneSummary}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zoneamento (prefeitura)">
            <Input value={l.zoneamento} onChange={(e) => set("zoneamento", e.target.value)} placeholder="Ex.: ZR-2" className="h-10" />
          </Field>
          <Field label="Gabarito (pavimentos)">
            <DecimalInput value={l.gabarito} onChange={(v) => set("gabarito", v)} suffix="pav." />
          </Field>
          <Field label="Coeficiente de aproveitamento" hint="Quantas vezes a área do terreno dá para construir">
            <DecimalInput value={l.coeficiente} onChange={(v) => set("coeficiente", v)} suffix="×" placeholder="1,4" />
          </Field>
          <Field label="Taxa de ocupação" hint="Quanto do terreno a construção pode cobrir">
            <DecimalInput value={l.taxaOcupacao} onChange={(v) => set("taxaOcupacao", v)} suffix="%" placeholder="60" />
          </Field>
        </div>
        <div className="mt-5">
          <p className={sub}>Uso permitido</p>
          <Chips options={USO_PERMITIDO} value={l.usoPermitido} onChange={(v) => set("usoPermitido", v)} />
        </div>
        {(nums.buildable || nums.footprint) && (
          <div className="mt-5 grid gap-3 rounded-xl bg-soft px-4 py-3 sm:grid-cols-2">
            {nums.buildable && (
              <p className="text-xs text-subtle">
                Área construível
                <span className="block font-mono text-base text-ink">{formatM2(nums.buildable)}</span>
              </p>
            )}
            {nums.footprint && (
              <p className="text-xs text-subtle">
                Ocupação máxima no chão
                <span className="block font-mono text-base text-ink">{formatM2(nums.footprint)}</span>
              </p>
            )}
          </div>
        )}
      </Collapsible>

      <section id="sec-infra" className={sectionCls}>
        <h2 className={h2Cls}>Infraestrutura</h2>
        <Chips options={INFRA_OPCOES} value={l.infraestrutura} onChange={(v) => set("infraestrutura", v)} />
      </section>

      <Collapsible id="sec-docs" title="Loteamento e documentação" summary={docSummary} defaultOpen={!docSummary}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Loteamento / condomínio" className="sm:col-span-3">
            <Input value={l.loteamento} onChange={(e) => set("loteamento", e.target.value)} placeholder="Ex.: Jardim das Acácias" className="h-10" />
          </Field>
          <Field label="Quadra">
            <Input value={l.quadra} onChange={(e) => set("quadra", e.target.value)} className="h-10" />
          </Field>
          <Field label="Lote">
            <Input value={l.lote} onChange={(e) => set("lote", e.target.value)} className="h-10" />
          </Field>
          <Field label="Matrícula">
            <Input value={l.matricula} onChange={(e) => set("matricula", e.target.value)} className="h-10" />
          </Field>
        </div>
        <div className="mt-5">
          <p className={sub}>Documentação</p>
          <Chips options={DOCUMENTACAO_OPCOES} value={l.documentacao} onChange={(v) => set("documentacao", v)} />
        </div>
        <p className="mt-4 text-[11px] text-subtle">Quadra, lote e matrícula ficam só no CRM; no site aparece a documentação marcada.</p>
      </Collapsible>
    </>
  );
}

/** Preço do m² do terreno (coluna Valores) */
export function LandPricePerM2({ price, area }: { price: number; area: string }) {
  const v = landNumbers(price, Number(area) || 0, { coeficiente: null, taxaOcupacao: null } as LandData).pricePerM2;
  return (
    <div className="rounded-xl bg-soft px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Preço por m²</p>
      <p className="mt-1 font-mono text-lg tabular">{v ? formatBRL(v) : "—"}</p>
    </div>
  );
}

function AddCustom({ onAdd }: { onAdd: (v: string) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim().slice(0, 80);
    if (v) onAdd(v);
    setText("");
  };
  return (
    <div className="mt-4 flex max-w-md gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder="Outra vantagem (ex.: 50 m da praia)"
        className="h-10"
      />
      <button
        type="button"
        onClick={add}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-hairline px-4 text-xs font-medium text-subtle transition-colors hover:text-ink"
      >
        <Plus className="size-3.5" />
        Adicionar
      </button>
    </div>
  );
}
