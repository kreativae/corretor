import { GerenciaPanel } from "@/components/gerencia/gerencia-panel";
import { db } from "@/db";
import { activities, contacts, deals, properties, users } from "@/db/schema";
import { getAccount } from "@/lib/account";
import { requireSuperadmin } from "@/lib/auth";
import { emailConfigured } from "@/lib/notify";
import { getWhiteLabel } from "@/lib/queries";
import { isRuralType } from "@/lib/rural";
import { getWhatsAppConfig, whatsappReady } from "@/lib/whatsapp";
import { and, count, desc, eq, gte, ne } from "drizzle-orm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gerência", robots: { index: false } };

export default async function GerenciaPage() {
  const me = await requireSuperadmin();
  const since = new Date(new Date().getTime() - 30 * 86_400_000);
  const [account, wl, team, managers, props, [contactsN], [leads30], [openDeals], [closedDeals], [lastAct], wa, mail] =
    await Promise.all([
      getAccount(),
      getWhiteLabel(),
      db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active, lastLoginAt: users.lastLoginAt })
        .from(users)
        .where(ne(users.role, "superadmin"))
        .orderBy(desc(users.lastLoginAt)),
      db
        .select({ id: users.id, name: users.name, email: users.email, lastLoginAt: users.lastLoginAt })
        .from(users)
        .where(eq(users.role, "superadmin"))
        .orderBy(users.createdAt),
      db.select({ type: properties.type, published: properties.published, status: properties.status }).from(properties),
      db.select({ n: count() }).from(contacts),
      db.select({ n: count() }).from(contacts).where(and(eq(contacts.type, "lead"), gte(contacts.createdAt, since))),
      db.select({ n: count() }).from(deals).where(ne(deals.stage, "fechado")),
      db.select({ n: count() }).from(deals).where(eq(deals.stage, "fechado")),
      db.select({ at: activities.createdAt }).from(activities).orderBy(desc(activities.createdAt)).limit(1),
      getWhatsAppConfig(),
      emailConfigured(),
    ]);

  const usage = {
    activeUsers: team.filter((u) => u.active).length,
    properties: props.length,
    rurais: props.filter((p) => isRuralType(p.type)).length,
    published: props.filter((p) => p.published && p.status !== "inativo").length,
    contacts: contactsN.n,
    leads30: leads30.n,
    openDeals: openDeals.n,
    closedDeals: closedDeals.n,
    lastActivity: lastAct?.at?.toISOString() ?? null,
    whatsapp: whatsappReady(wa) ? (wa.provider === "evolution" ? "QR code (Evolution)" : "API oficial (Meta)") : null,
    email: mail,
  };

  return (
    <GerenciaPanel
      me={{ id: me.id, name: me.name }}
      client={wl.orgName}
      initial={account}
      usage={usage}
      team={team.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))}
      managers={managers.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))}
    />
  );
}
