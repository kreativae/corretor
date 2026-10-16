import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { CONTROL_MIGRATIONS, RUNTIME_MIGRATIONS } from "./migrations";

/**
 * Banco multiempresa: cada empresa tem um esquema próprio no mesmo Postgres,
 * acessado por um usuário (role) só dela, cujo search_path aponta para o esquema.
 * A empresa principal (Carlos Amâncio) continua no esquema public, com DATABASE_URL.
 * Funciona com o pooler do Neon (transaction mode), que não guarda SET search_path.
 */

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

export const DEFAULT_SCHEMA = "public";
export type TenantConn = { schema: string; user?: string; password?: string };

type Db = NodePgDatabase<Record<string, never>>;

const globalForDb = globalThis as typeof globalThis & {
  __imobPools?: Map<string, Pool>;
  __imobDbs?: Map<string, Db>;
};
const pools: Map<string, Pool> = (globalForDb.__imobPools ??= new Map());
const dbs: Map<string, Db> = (globalForDb.__imobDbs ??= new Map());

/** Mesma URL do banco principal, trocando usuário e senha */
export function urlFor(conn: TenantConn) {
  if (!conn.user) return databaseUrl as string;
  const u = new URL(databaseUrl as string);
  u.username = conn.user;
  u.password = conn.password ?? "";
  return u.toString();
}

function poolFor(conn: TenantConn) {
  let pool = pools.get(conn.schema);
  if (pool) return pool;
  const main = conn.schema === DEFAULT_SCHEMA;
  pool = new Pool({ connectionString: urlFor(conn), max: main ? 10 : 3 });
  // O pg enfileira as consultas por conexão: as migrações rodam antes de qualquer outra.
  pool.on("connect", (client) => {
    for (const sql of main ? [...CONTROL_MIGRATIONS, ...RUNTIME_MIGRATIONS] : RUNTIME_MIGRATIONS) {
      client.query(sql).catch((e) => console.error(`[migração ${conn.schema}]`, e.message));
    }
  });
  pools.set(conn.schema, pool);
  return pool;
}

/** Banco de uma empresa específica */
export function dbFor(conn: TenantConn): Db {
  let d = dbs.get(conn.schema);
  if (!d) {
    d = drizzle(poolFor(conn));
    dbs.set(conn.schema, d);
  }
  return d;
}

/** Banco principal: empresa principal + cadastro de empresas (gerência) */
export const controlDb = dbFor({ schema: DEFAULT_SCHEMA });

/** Esquecer a conexão de uma empresa (ex.: excluída) */
export async function dropConn(schema: string) {
  const pool = pools.get(schema);
  pools.delete(schema);
  dbs.delete(schema);
  await pool?.end().catch(() => undefined);
}

/* ─────────────────────── Empresa da requisição ─────────────────────── */

const tenantStore = new AsyncLocalStorage<TenantConn>();

/** Executa com o banco de uma empresa (webhooks, rotinas, provisionamento) */
export function withTenant<T>(conn: TenantConn, fn: () => Promise<T>) {
  return tenantStore.run(conn, fn);
}

/** Empresa da requisição atual */
export async function currentConn(): Promise<TenantConn> {
  const forced = tenantStore.getStore();
  if (forced) return forced;
  try {
    // Import tardio: src/lib/tenant.ts usa este módulo (cookie/domínio → empresa)
    const { resolveTenant } = await import("@/lib/tenant");
    return await resolveTenant();
  } catch {
    /* fora de uma requisição: empresa principal */
    return { schema: DEFAULT_SCHEMA };
  }
}

/** Banco da empresa da requisição atual */
export async function getDb(): Promise<Db> {
  return dbFor(await currentConn());
}
