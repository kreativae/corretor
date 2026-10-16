import { GerenciaPanel } from "@/components/gerencia/gerencia-panel";
import { requireSuperadmin } from "@/lib/auth";
import { companyOverview } from "@/lib/gerencia";
import { listTenants } from "@/lib/tenant";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Empresa · Gerência", robots: { index: false } };

export default async function EmpresaPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSuperadmin();
  const { slug } = await params;
  const t = (await listTenants(true)).find((x) => x.slug === slug);
  if (!t) notFound();
  const o = await companyOverview(t);
  if (!o.ok) throw new Error(o.error);
  return (
    <GerenciaPanel
      company={{ slug: t.slug, name: o.orgName, label: t.name, main: t.schemaName === "public", domains: t.domains }}
      initial={o.account}
      usage={o.usage}
      team={o.team}
    />
  );
}
