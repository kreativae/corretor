import { RuralAreaSummary } from "@/components/crm/rural-fields";
import {
  ACESSO_LABELS,
  APTIDAO_LABELS,
  ENERGIA_LABELS,
  formatAlq,
  SOLO_LABELS,
  TOPOGRAFIA_LABELS,
  type RuralData,
} from "@/lib/rural";
import { Check, Droplets, Map as MapIcon, Warehouse } from "lucide-react";
import Link from "next/link";

/** Ficha técnica da propriedade rural (CRM e site). */
export function RuralDetails({
  r,
  mapHref,
  showDocs,
}: {
  r: RuralData;
  /** Página do mapa do KMZ, quando houver arquivo */
  mapHref?: string;
  /** Matrícula, CAR, CCIR — apenas no CRM */
  showDocs?: boolean;
}) {
  const rows: [string, string | null][] = [
    ["Aptidão", r.aptidao ? APTIDAO_LABELS[r.aptidao] : null],
    ["Culturas", r.culturas || null],
    ["Lotação", r.cabecas ? `${formatAlq(r.cabecas)} cabeças` : null],
    ["Topografia", r.topografia ? TOPOGRAFIA_LABELS[r.topografia] : null],
    ["Solo", r.solo ? SOLO_LABELS[r.solo] : null],
    ["Energia", r.energia ? ENERGIA_LABELS[r.energia] : null],
    ["Acesso", r.acesso ? ACESSO_LABELS[r.acesso] : null],
    ["Distância da cidade", r.distanciaCidadeKm != null ? `${formatAlq(r.distanciaCidadeKm)} km` : null],
    ["Distância do asfalto", r.distanciaAsfaltoKm != null ? `${formatAlq(r.distanciaAsfaltoKm)} km` : null],
  ];
  const docs: [string, string][] = showDocs
    ? ([
        ["Matrícula", r.matricula],
        ["CAR", r.car],
        ["CCIR", r.ccir],
        ["NIRF / ITR", r.nirf],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  return (
    <div className="space-y-6">
      <RuralAreaSummary r={r} compact />

      <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-hairline/60 pb-2">
              <dt className="text-subtle">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
      </dl>

      {r.agua.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-subtle">
            <Droplets className="size-3.5" /> Recursos hídricos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {r.agua.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs">
                <Check className="size-3 text-accent" />
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {r.benfeitorias.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-subtle">
            <Warehouse className="size-3.5" /> Benfeitorias
          </p>
          <div className="flex flex-wrap gap-1.5">
            {r.benfeitorias.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs">
                <Check className="size-3 text-accent" />
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div className="rounded-xl bg-soft p-4">
          <p className="mb-2 text-xs font-medium text-subtle">Documentação (interno)</p>
          <dl className="space-y-1.5 text-xs">
            {docs.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-subtle">{k}</dt>
                <dd className="break-all text-right font-mono">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {r.kmzUrl && mapHref && (
        <Link
          href={mapHref}
          target="_blank"
          className="flex items-center gap-3 rounded-xl border border-hairline p-4 transition-colors hover:bg-soft"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <MapIcon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Ver perímetro no mapa</span>
            <span className="block text-xs text-subtle">Imagem de satélite e download do KMZ</span>
          </span>
        </Link>
      )}
    </div>
  );
}
