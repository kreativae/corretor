import "server-only";
import path from "node:path";
import { controlDb, dbFor, DEFAULT_SCHEMA, dropConn, urlFor, type TenantConn } from "@/db";
import { Client } from "pg";
import { BASE_SCHEMA_SQL } from "@/db/base-schema";
import { RUNTIME_MIGRATIONS } from "@/db/migrations";
import { sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { randomBytes } from "node:crypto";

/** Cookie com a empresa em uso (slug). A sessão é validada no banco da própria empresa. */
export const TENANT_COOKIE = "imob_tenant";
/** Cabeçalho interno com o ?t= da URL (o middleware descarta o que vier do cliente) */
export const TENANT_HEADER = "x-imob-tenant";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  schemaName: string;
  dbUser: string | null;
  dbPassword: string | null;
  domains: string[];
  createdAt: string;
};

type Row = {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  db_user: string | null;
  db_password: string | null;
  domains: string[] | null;
  created_at: Date | string;
};

const toTenant = (r: Row): Tenant => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  schemaName: r.schema_name,
  dbUser: r.db_user,
  dbPassword: r.db_password,
  domains: Array.isArray(r.domains) ? r.domains : [],
  createdAt: new Date(r.created_at).toISOString(),
});

// Lista de empresas em memória por 30 s (consultada a cada requisição)
let cached: { at: number; list: Tenant[] } | null = null;

export async function listTenants(fresh = false): Promise<Tenant[]> {
  if (!fresh && cached && Date.now() - cached.at < 30_000) return cached.list;
  const res = await controlDb.execute(sql`select * from tenants order by created_at`);
  const list = (res.rows as Row[]).map(toTenant);
  cached = { at: Date.now(), list };
  return list;
}

export const connOf = (t: Pick<Tenant, "schemaName" | "dbUser" | "dbPassword">): TenantConn =>
  t.schemaName === DEFAULT_SCHEMA
    ? { schema: DEFAULT_SCHEMA }
    : { schema: t.schemaName, user: t.dbUser ?? undefined, password: t.dbPassword ?? undefined };

/** Empresa da requisição: cookie escolhido no login › domínio próprio › principal */
export const currentTenant = cache(async (): Promise<Tenant | null> => {
  const list = await listTenants().catch(() => [] as Tenant[]);
  if (!list.length) return null;
  const h = await headers();
  // 1) ?t=empresa na URL (webhooks, feed de portais, prévia do site) — repassado pelo middleware
  const param = h.get(TENANT_HEADER);
  const byParam = param ? list.find((t) => t.slug === param) : undefined;
  if (byParam) return byParam;
  // 2) Domínio próprio da empresa
  const host = (h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  const byHost = host ? list.find((t) => t.domains.includes(host)) : undefined;
  if (byHost) return byHost;
  // 3) Empresa escolhida no login
  const slug = (await cookies()).get(TENANT_COOKIE)?.value;
  const bySlug = slug ? list.find((t) => t.slug === slug) : undefined;
  return bySlug ?? list.find((t) => t.schemaName === DEFAULT_SCHEMA) ?? null;
});

export async function resolveTenant(): Promise<TenantConn> {
  const t = await currentTenant();
  return t ? connOf(t) : { schema: DEFAULT_SCHEMA };
}

/** Empresa principal (esquema public)? */
export async function isMainTenant() {
  const t = await currentTenant();
  return !t || t.schemaName === DEFAULT_SCHEMA;
}

/* ─────────────────────── Criar / excluir empresa ─────────────────────── */

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Cria a empresa: um esquema e um usuário de banco só dela (com search_path
 * no próprio esquema), as tabelas e as migrações. Devolve o cadastro.
 */
export async function createTenant(input: { name: string; slug: string }): Promise<Tenant> {
  const slug = slugify(input.slug || input.name);
  if (!slug || slug === "principal") throw new Error("Escolha outro identificador para a empresa.");
  const list = await listTenants(true);
  if (list.some((t) => t.slug === slug)) throw new Error("Já existe uma empresa com esse identificador.");

  const schema = `t_${slug.replace(/-/g, "_")}`;
  const user = schema;
  const password = randomBytes(24).toString("base64url");
  // Identificadores já validados (a-z, 0-9, _); senha em base64url
  await controlDb.execute(sql.raw(`CREATE ROLE ${user} LOGIN PASSWORD '${password}'`));
  try {
    // O dono do banco precisa poder agir como o novo usuário para criar o esquema dele
    await controlDb.execute(sql.raw(`GRANT ${user} TO current_user`)).catch(() => undefined);
    await controlDb.execute(sql.raw(`CREATE SCHEMA ${schema} AUTHORIZATION ${user}`));
    await controlDb.execute(sql.raw(`ALTER ROLE ${user} SET search_path = ${schema}`));

    // Tabelas: conexão avulsa como o usuário da empresa (tudo cai no esquema dela),
    // antes de qualquer pool rodar as migrações automáticas
    const client = new Client({ connectionString: urlFor({ schema, user, password }) });
    await client.connect();
    try {
      await client.query("BEGIN");
      for (const stmt of BASE_SCHEMA_SQL) await client.query(stmt);
      await client.query("COMMIT");
      for (const stmt of RUNTIME_MIGRATIONS) await client.query(stmt);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      await client.end().catch(() => undefined);
    }

    const res = await controlDb.execute(
      sql`insert into tenants (slug, name, schema_name, db_user, db_password) values (${slug}, ${input.name.trim().slice(0, 120)}, ${schema}, ${user}, ${password}) returning *`,
    );
    cached = null;
    return toTenant(res.rows[0] as Row);
  } catch (e) {
    await dropConn(schema);
    await controlDb.execute(sql.raw(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)).catch(() => undefined);
    await dropRole(user).catch((err) => console.error("[empresa] usuário de banco não removido", err));
    throw e;
  }
}

/** Remove o usuário de banco de uma empresa (precisa estar sem objetos) */
async function dropRole(user: string) {
  await controlDb.execute(sql.raw(`DROP ROLE IF EXISTS ${user}`));
}

/** Exclui a empresa e todos os dados dela (irreversível) */
export async function deleteTenant(slug: string) {
  const t = (await listTenants(true)).find((x) => x.slug === slug);
  if (!t) throw new Error("Empresa não encontrada.");
  if (t.schemaName === DEFAULT_SCHEMA) throw new Error("A empresa principal não pode ser excluída.");
  await dropConn(t.schemaName);
  await controlDb.execute(sql.raw(`DROP SCHEMA IF EXISTS ${t.schemaName} CASCADE`));
  if (t.dbUser) await dropRole(t.dbUser).catch((err) => console.error("[empresa] usuário de banco não removido", err));
  await controlDb.execute(sql`delete from tenants where id = ${t.id}`);
  cached = null;
  // Fotos, documentos e anexos da empresa (pasta própria no disco do servidor)
  const dir = process.env.UPLOAD_DIR?.trim();
  if (dir && /^t_[a-z0-9_]+$/.test(t.schemaName)) {
    const { rm } = await import("node:fs/promises");
    await rm(path.join(dir, "t", t.schemaName), { recursive: true, force: true }).catch((err) =>
      console.error("[empresa] arquivos não removidos", err),
    );
  }
}

export async function updateTenant(slug: string, patch: { name?: string; domains?: string[] }) {
  const t = (await listTenants(true)).find((x) => x.slug === slug);
  if (!t) throw new Error("Empresa não encontrada.");
  const name = patch.name?.trim().slice(0, 120) || t.name;
  const domains = (patch.domains ?? t.domains)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
    .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))
    .slice(0, 10);
  await controlDb.execute(sql`update tenants set name = ${name}, domains = ${JSON.stringify(domains)}::jsonb where id = ${t.id}`);
  cached = null;
}

/** Slug da empresa atual para links externos (?t=), ou null na principal */
export async function tenantParam(): Promise<string | null> {
  const t = await currentTenant();
  return t && t.schemaName !== DEFAULT_SCHEMA ? t.slug : null;
}

/** Endereço público do site da empresa atual (metadados, robots, feed de portais, e-mails).
 * Sem domínio configurado, usa `fallback` ou o host da requisição. */
export async function siteBaseUrl(wlDomain: string, fallback?: string) {
  if (await isMainTenant()) {
    const env = process.env.NEXT_PUBLIC_SITE_URL;
    if (env) return env;
  }
  if (wlDomain) return `https://${wlDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  if (fallback) return fallback;
  const host = (await headers()).get("host");
  return host ? `https://${host}` : "https://localhost";
}

/** Endereço pedido (repassado pelo middleware) */
const PATH_HEADER = "x-imob-path";

/**
 * Empresas (não a principal) sempre com www, como o site principal: quem abre
 * empresa.com.br vai para www.empresa.com.br (mesmo caminho). Chamado no layout raiz,
 * então só páginas: as rotas de API (webhooks) não são redirecionadas.
 */
export async function tenantWwwRedirect() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  if (!host || host.startsWith("www.") || !host.includes(".")) return;
  const t = (await listTenants()).find((x) => x.schemaName !== DEFAULT_SCHEMA && x.domains.includes(host));
  if (!t) return;
  const p = h.get(PATH_HEADER) || "/";
  permanentRedirect(`https://www.${host}${p.startsWith("/") ? p : "/"}`);
}

/**
 * E-mail já usado por uma conta de outra empresa (o login é único para todas). Devolve o
 * nome da empresa, ou null. `exceptSchema`: a empresa onde a conta está sendo criada.
 */
export async function emailInOtherCompany(email: string, exceptSchema?: string) {
  const addr = email.trim().toLowerCase();
  for (const t of await listTenants(true)) {
    if (t.schemaName === exceptSchema) continue;
    const res = await dbFor(connOf(t))
      .execute(sql`select 1 from users where lower(email) = ${addr} limit 1`)
      .catch(() => null);
    if (res?.rows.length) return t.name;
  }
  return null;
}
