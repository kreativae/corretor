import { PrintBar } from "./print-bar";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { getPropertyByCode, getWhiteLabel } from "@/lib/queries";
import { getSiteContent } from "@/lib/site-content";
import { formatBRL, TIME_ZONE } from "@/lib/utils";
import {
  BedDouble,
  Car,
  Check,
  MessageCircle,
  Ruler,
  ShowerHead,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ficha do imóvel" };

export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [wl, p, content] = await Promise.all([
    getWhiteLabel(),
    getPropertyByCode(id),
    getSiteContent(),
  ]);
  if (!p) notFound();

  const imgs = p.images.map((i) => i.url);
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: TIME_ZONE });
  const digits = wl.phone.replace(/\D/g, "");
  const phone =
    digits.length === 13
      ? `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
      : wl.phone;

  const specs = [
    { icon: Ruler, label: "Área construída", value: `${p.area} m²` },
    { icon: BedDouble, label: "Quartos", value: String(p.bedrooms) },
    { icon: ShowerHead, label: "Banheiros", value: String(p.bathrooms) },
    { icon: Car, label: "Vagas", value: String(p.garage) },
  ];

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <PrintBar />
      <div className="mx-auto max-w-4xl bg-white px-8 py-10 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none md:px-14 md:py-14">
        {/* Cabeçalho */}
        <header className="flex items-start justify-between border-b border-neutral-200 pb-6">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 64 64" className="size-9">
              <rect width="64" height="64" rx="14" fill="#0A0A0A" />
              <path
                d="M20 46V18l24 28V18"
                fill="none"
                stroke="#10B981"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <p className="font-semibold tracking-tight">{wl.orgName}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                {wl.domain}
              </p>
            </div>
          </div>
          <div className="text-right font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            <p>{p.code}</p>
            <p>{today}</p>
          </div>
        </header>

        {/* Título + preço */}
        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="max-w-xl text-3xl font-semibold tracking-tight">
              {p.title}
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              {p.street ? `${p.street}, ` : ""}
              {p.neighborhood} — {p.city}/{p.state}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-neutral-400">
              {TYPE_LABELS[p.type]} · {STATUS_LABELS[p.status]} ·{" "}
              {p.purpose === "venda" ? "Venda" : "Aluguel"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">
              Valor
            </p>
            <p className="mt-1 font-mono text-3xl font-medium tabular">
              {formatBRL(p.price)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {[
                p.condoFee ? `Cond. ${formatBRL(p.condoFee)}` : null,
                p.iptu ? `IPTU ${formatBRL(p.iptu)}/ano` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {/* Fotos */}
        {imgs.length > 0 && (
          <div className="mt-8 grid grid-cols-3 gap-2 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgs[0]}
              alt={p.title}
              className="col-span-3 aspect-[16/8] w-full rounded-lg object-cover"
            />
            {imgs.slice(1, 4).map((src, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={i}
                src={src}
                alt=""
                className="aspect-[4/3] w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}

        {/* Características */}
        <div className="mt-8 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 max-sm:grid-cols-2">
          {specs.map((s) => (
            <div key={s.label} className="bg-neutral-50 p-4">
              <s.icon className="size-4 text-neutral-400" />
              <p className="mt-2 font-mono text-base font-medium tabular">
                {s.value}
              </p>
              <p className="text-[11px] text-neutral-500">{s.label}</p>
            </div>
          ))}
        </div>

        {p.description && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Sobre o imóvel
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
              {p.description}
            </p>
          </section>
        )}

        {p.features.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Comodidades
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.features.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs"
                >
                  <Check className="size-3 text-emerald-600" />
                  {f}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Rodapé */}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-6 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-emerald-600" />
            <span className="font-mono tabular">{phone}</span>
            <span className="mx-1">·</span>
            <span>
              {content.detail.brokerName} — {content.detail.brokerRole}
            </span>
          </div>
          <p className="font-mono uppercase tracking-[0.16em]">
            Gerado por ImobManager · {today}
          </p>
        </footer>
      </div>
    </div>
  );
}
