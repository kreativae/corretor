// Copia os arquivos do Vercel Blob para o disco (UPLOAD_DIR) e troca, no banco,
// os endereços antigos (Blob público ou /api/media de outro domínio) pelo
// /api/media do domínio novo. Pode rodar mais de uma vez: pula o que já foi
// copiado e a troca de endereços é idempotente.
//
// No Terminal do app no Coolify (com BLOB_READ_WRITE_TOKEN, UPLOAD_DIR e DATABASE_URL):
//   node scripts/migrate-blob.mjs https://corretor.kreativ.ae
import { get, list } from "@vercel/blob";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const origin = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!/^https:\/\/[^/]+$/.test(origin)) {
  console.error("Uso: node scripts/migrate-blob.mjs https://dominio-do-crm");
  process.exit(1);
}
const token =
  process.env.BLOB_READ_WRITE_TOKEN ??
  Object.entries(process.env).find(([k]) => k.endsWith("_READ_WRITE_TOKEN"))?.[1];
const root = path.resolve(process.env.UPLOAD_DIR ?? "");
if (!token || !process.env.UPLOAD_DIR || !process.env.DATABASE_URL) {
  console.error("Defina BLOB_READ_WRITE_TOKEN, UPLOAD_DIR e DATABASE_URL no app antes de rodar.");
  process.exit(1);
}

// 1) Arquivos
let copied = 0, skipped = 0, failed = 0, cursor;
do {
  const page = await list({ token, cursor, limit: 1000 });
  for (const b of page.blobs) {
    const full = path.resolve(root, b.pathname);
    if (!full.startsWith(root + path.sep)) continue;
    const have = await stat(full).catch(() => null);
    if (have && have.size === b.size) { skipped++; continue; }
    let r = await get(b.pathname, { access: "private", token }).catch(() => null);
    if (!r || r.statusCode !== 200) r = await get(b.pathname, { access: "public", token }).catch(() => null);
    if (!r || r.statusCode !== 200) { failed++; console.error("falhou:", b.pathname); continue; }
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, Buffer.from(await new Response(r.stream).arrayBuffer()));
    copied++;
    if (copied % 50 === 0) console.log(`  ${copied} arquivos copiados...`);
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);
console.log(`Arquivos — copiados: ${copied} · já estavam: ${skipped} · falhas: ${failed}`);

// 2) Endereços no banco (esquema principal e das empresas)
const OLD = String.raw`https?://([a-z0-9]+\.(public|private)\.blob\.vercel-storage\.com/|[^/"'[:space:]]+/api/media/)`;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows: cols } = await db.query(`
  select table_schema s, table_name t, column_name c, data_type d
  from information_schema.columns
  join information_schema.tables using (table_schema, table_name)
  where table_type = 'BASE TABLE'
    and (table_schema = 'public' or table_schema like 't\\_%')
    and data_type in ('text', 'character varying', 'jsonb', 'json')`);
let changed = 0;
for (const { s, t, c, d } of cols) {
  const id = (x) => `"${x.replace(/"/g, '""')}"`;
  const col = `${id(s)}.${id(t)}`;
  const cast = d === "jsonb" || d === "json" ? `::${d}` : "";
  const res = await db.query(
    `update ${col} set ${id(c)} = regexp_replace(${id(c)}::text, $1, $2, 'g')${cast}
     where ${id(c)}::text ~ $1 and ${id(c)}::text <> regexp_replace(${id(c)}::text, $1, $2, 'g')`,
    [OLD, `${origin}/api/media/`],
  );
  if (res.rowCount) {
    changed += res.rowCount;
    console.log(`  ${s}.${t}.${c}: ${res.rowCount}`);
  }
}
await db.end();
console.log(`Endereços atualizados: ${changed} registro(s). Pronto.`);
if (failed) process.exitCode = 1;
