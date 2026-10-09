import { SiteEditor } from "@/components/admin/site-editor";
import { getWhiteLabel } from "@/lib/queries";
import { getSiteContent } from "@/lib/site-content";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conteúdo do site" };

export default async function AdminSitePage() {
  const [content, wl] = await Promise.all([getSiteContent(), getWhiteLabel()]);

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
      <SiteEditor initial={content} whiteLabel={wl} />
    </div>
  );
}
