import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { RUNTIME_MIGRATIONS } from "./migrations";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

// O pg enfileira as consultas por conexão: as migrações rodam antes de qualquer outra.
if (!pool.listenerCount("connect")) {
  pool.on("connect", (client) => {
    for (const sql of RUNTIME_MIGRATIONS) {
      client.query(sql).catch((e) => console.error("[migração]", e.message));
    }
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
