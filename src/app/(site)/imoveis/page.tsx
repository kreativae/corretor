import { isRuralType } from "@/lib/rural";
import { ImoveisBrowser } from "@/components/site/imoveis-browser";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getWhiteLabel, listPublishedProperties } from "@/lib/queries";
import { getSiteContent } from "@/lib/site-content";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteContent();
  return { title: c.listing.title, description: c.seo.description };
}

export default async function ImoveisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const categoria = sp.categoria;
  const [wl, properties, content] = await Promise.all([
    getWhiteLabel(),
    listPublishedProperties(),
    getSiteContent(),
  ]);

  return (
    <div>
      <SiteHeader orgName={wl.orgName} hasRural={properties.some((x) => isRuralType(x.type))} />
      <main className="container-x pb-24 pt-24 md:pt-36">
        <p
          data-reveal
          className="font-mono text-[11px] uppercase tracking-[0.24em] text-subtle"
        >
          {content.listing.eyebrow}
        </p>
        <h1
          data-words
          className="mt-3 text-balance font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl md:text-7xl"
        >
          {content.listing.title}
        </h1>
        <ImoveisBrowser
          key={JSON.stringify(sp)}
          properties={properties}
          initialCategoria={categoria === "rurais" ? "rurais" : "urbanos"}
          initialSearch={sp}
        />
      </main>
      <SiteFooter
        orgName={wl.orgName}
        phone={wl.phone}
        footer={content.footer}
        email={wl.email}
        instagram={wl.instagram}
      />
    </div>
  );
}
