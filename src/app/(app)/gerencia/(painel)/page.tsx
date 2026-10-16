import { CompaniesList } from "@/components/gerencia/companies-list";
import { controlDb } from "@/db";
import { users } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { companyOverview } from "@/lib/gerencia";
import { listTenants } from "@/lib/tenant";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gerência", robots: { index: false } };

export default async function GerenciaPage() {
  const me = await requireSuperadmin();
  const tenants = await listTenants(true);
  const [overviews, managers] = await Promise.all([
    Promise.all(tenants.map((t) => companyOverview(t))),
    controlDb
      .select({ id: users.id, name: users.name, email: users.email, lastLoginAt: users.lastLoginAt })
      .from(users)
      .where(eq(users.role, "superadmin"))
      .orderBy(users.createdAt),
  ]);
  return (
    <CompaniesList
      me={{ id: me.id, name: me.name }}
      companies={tenants.map((t, i) => {
        const o = overviews[i];
        return {
          slug: t.slug,
          name: o.ok ? o.orgName : t.name,
          main: t.schemaName === "public",
          domains: t.domains,
          createdAt: t.createdAt,
          status: o.ok ? o.account.status : null,
          plan: o.ok ? o.account.plan : "",
          users: o.ok ? o.usage.activeUsers : 0,
          properties: o.ok ? o.usage.properties : 0,
          contacts: o.ok ? o.usage.contacts : 0,
          lastActivity: o.ok ? o.usage.lastActivity : null,
          error: o.ok ? null : o.error,
        };
      })}
      managers={managers.map((m) => ({ ...m, lastLoginAt: m.lastLoginAt?.toISOString() ?? null }))}
    />
  );
}
