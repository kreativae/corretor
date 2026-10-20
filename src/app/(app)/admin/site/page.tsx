import { SiteEditor } from "@/components/admin/site-editor";
import { getWhiteLabel, listProperties, listPropertyViewTotals } from "@/lib/queries";
import { kindOf } from "@/lib/rural";
import type { DisplayItem } from "@/components/admin/display-editor";
import { getSiteContent } from "@/lib/site-content";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conteúdo do site" };

export default async function AdminSitePage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const [content, wl, props, viewTotals, { aba }] = await Promise.all([
    getSiteContent(),
    getWhiteLabel(),
    listProperties(),
    listPropertyViewTotals().catch(() => ({}) as Record<string, { total: number }>),
    searchParams,
  ]);
  const items: DisplayItem[] = props
    .filter((p) => p.status !== "inativo")
    .map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      kind: kindOf(p.type),
      featured: p.featured,
      published: p.published,
      available: ["disponivel", "reservado"].includes(p.status),
      price: p.price,
      area: p.area,
      purpose: p.purpose,
      neighborhood: p.neighborhood,
      city: p.city,
      createdAt: p.createdAt.toISOString(),
      cover: p.cover,
    }));
  const views = Object.fromEntries(Object.entries(viewTotals).map(([k, v]) => [k, v.total]));
  const cities = [...new Set(props.filter((p) => p.published).map((p) => p.city).filter(Boolean))].sort();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Vitrine web
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Conteúdo do site
          </h1>
        </div>
        <p className="max-w-sm text-right text-xs leading-relaxed text-subtle">
          Edite todos os textos, chamadas e mídias da vitrine pública. As
          alterações entram no ar imediatamente.
        </p>
      </div>
      <SiteEditor initial={content} whiteLabel={wl} items={items} views={views} cities={cities} initialTab={aba} />
    </div>
  );
}
