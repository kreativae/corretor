import "server-only";
import { dbFor, withTenant } from "@/db";
import {
  activities,
  contacts,
  deals,
  properties,
  settings,
  users,
} from "@/db/schema";
import { getAccount, saveAccount } from "@/lib/account";
import { hashPassword } from "@/lib/password";
import { WL_DEFAULTS } from "@/lib/queries";
import { isRuralType } from "@/lib/rural";
import { connOf, createTenant, deleteTenant, type Tenant } from "@/lib/tenant";
import { and, count, desc, eq, gte, ne } from "drizzle-orm";

/** Resumo de uma empresa para a gerência (consulta o banco dela) */
export async function companyOverview(t: Tenant) {
  const conn = connOf(t);
  const db = dbFor(conn);
  const since = new Date(new Date().getTime() - 30 * 86_400_000);
  try {
    const [
      account,
      wlRow,
      team,
      props,
      [contactsN],
      [leads30],
      [openDeals],
      [closedDeals],
      [lastAct],
    ] = await Promise.all([
      withTenant(conn, () => getAccount()),
      db.select().from(settings).where(eq(settings.key, "whiteLabel")),
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          active: users.active,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(ne(users.role, "superadmin"))
        .orderBy(desc(users.lastLoginAt)),
      db
        .select({
          type: properties.type,
          published: properties.published,
          status: properties.status,
        })
        .from(properties),
      db.select({ n: count() }).from(contacts),
      db
        .select({ n: count() })
        .from(contacts)
        .where(and(eq(contacts.type, "lead"), gte(contacts.createdAt, since))),
      db.select({ n: count() }).from(deals).where(ne(deals.stage, "fechado")),
      db.select({ n: count() }).from(deals).where(eq(deals.stage, "fechado")),
      db
        .select({ at: activities.createdAt })
        .from(activities)
        .orderBy(desc(activities.createdAt))
        .limit(1),
    ]);
    const wl = (wlRow[0]?.value ?? {}) as { orgName?: string };
    return {
      ok: true as const,
      account,
      orgName: wl.orgName || t.name,
      team: team.map((u) => ({
        ...u,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      })),
      usage: {
        activeUsers: team.filter((u) => u.active).length,
        properties: props.length,
        rurais: props.filter((p) => isRuralType(p.type)).length,
        published: props.filter((p) => p.published && p.status !== "inativo")
          .length,
        contacts: contactsN.n,
        leads30: leads30.n,
        openDeals: openDeals.n,
        closedDeals: closedDeals.n,
        lastActivity: lastAct?.at?.toISOString() ?? null,
      },
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Falha ao ler a empresa.",
    };
  }
}

/** Prefixo dos códigos a partir do nome: "Silva Imóveis" → "SI" */
function prefixFrom(name: string) {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return (
    (words.length > 1
      ? words.map((w) => w[0]).join("")
      : (words[0] ?? "IMV")
    ).slice(0, 4) || "IMV"
  );
}

/** Nova empresa: banco zerado, identidade com o nome dela e o administrador */
export async function createCompany(input: {
  name: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  plan?: string;
}) {
  const tenant = await createTenant({ name: input.name, slug: input.slug });
  const conn = connOf(tenant);
  try {
    await withTenant(conn, async () => {
      const db = dbFor(conn);
      const name = input.name.trim();
      await db.insert(settings).values({
        key: "whiteLabel",
        value: {
          ...WL_DEFAULTS,
          orgName: name,
          shortName: name,
          domain: "",
          email: input.adminEmail,
          tagline: "",
          codePrefix: prefixFrom(name),
          codePrefixRural: "RUR",
          codePrefixLand: "",
        },
      });
      await db.insert(users).values({
        name: input.adminName.trim(),
        email: input.adminEmail.trim().toLowerCase(),
        role: "admin",
        passwordHash: hashPassword(input.adminPassword),
      });
      if (input.plan) await saveAccount({ plan: input.plan });
      await db.insert(activities).values({
        entity: "sistema",
        entityId: null,
        kind: "created",
        text: `Empresa criada pela gerência. Administrador: ${input.adminName.trim()}.`,
      });
    });
  } catch (e) {
    // Não deixa empresa pela metade
    await deleteTenant(tenant.slug).catch(() => undefined);
    throw e;
  }
  return tenant;
}
