import "server-only";
import { currentConn, DEFAULT_SCHEMA, getDb } from "@/db";
import { partners, properties, propertyImages } from "@/db/schema";
import { eq, like } from "drizzle-orm";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Proteção das fotos dos imóveis no site:
 * - quem não está logado nunca recebe a foto original: sai reduzida, sem metadados (GPS, aparelho)
 *   e com a marca d'água do parceiro dono do imóvel, decidida aqui (tirar o ?wm= da URL não adianta);
 * - o feed dos portais leva um endereço assinado, que entrega a original;
 * - foto aberta por outro site (hotlink) é recusada e há limite de downloads por IP.
 */

/** Maior lado da foto entregue ao público */
export const PUBLIC_MAX_PX = 1600;

/** Modo da marca d'água da foto: o do parceiro dono do imóvel; foto sem imóvel = padrão */
const modeCache = new Map<string, { at: number; mode: string }>();
export async function photoMode(pathname: string): Promise<string> {
  const key = `${(await currentConn()).schema}:${pathname}`;
  const hit = modeCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.mode;
  let mode = "padrao";
  try {
    const [row] = await (await getDb())
      .select({ wm: partners.watermark })
      .from(propertyImages)
      .innerJoin(properties, eq(properties.id, propertyImages.propertyId))
      .leftJoin(partners, eq(partners.id, properties.partnerId))
      .where(like(propertyImages.url, `%/api/media/${pathname.replace(/[%_\\]/g, "\\$&")}`))
      .limit(1);
    mode = row?.wm || "padrao";
  } catch {
    /* sem banco: padrão */
  }
  if (modeCache.size > 5000) modeCache.clear();
  modeCache.set(key, { at: Date.now(), mode });
  return mode;
}

/* ───────────── Endereço assinado (feed dos portais) ───────────── */

function secret() {
  return process.env.MEDIA_SECRET || process.env.CRON_SECRET || process.env.GERENCIA_KEY || "";
}

export function mediaSignature(pathname: string) {
  const s = secret();
  return s ? createHmac("sha256", s).update(`media:${pathname}`).digest("base64url").slice(0, 22) : "";
}

export function validSignature(pathname: string, sig: string | null) {
  const want = mediaSignature(pathname);
  if (!want || !sig || sig.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}

/** URL da foto original para o feed dos portais (sem assinatura possível, volta a URL como está) */
export function signedMediaUrl(url: string) {
  const m = url.match(/\/api\/media\/([^?#]+)/);
  if (!m) return url;
  const pathname = m[1].split("/").map(decodeURIComponent).join("/");
  const sig = mediaSignature(pathname);
  return sig ? `${url.split("?")[0]}?k=${sig}` : url;
}

/* ───────────── Outro site usando a foto ───────────── */

/** Foto pedida por uma página de outro domínio. Sem Referer (portais, WhatsApp, abrir direto) passa. */
export function isHotlink(req: Request) {
  const ref = req.headers.get("referer");
  if (!ref) return false;
  try {
    const from = new URL(ref).host.replace(/^www\./, "");
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").replace(/^www\./, "");
    return !!host && from !== host;
  } catch {
    return false;
  }
}

/* ───────────── Cache em disco das versões públicas ───────────── */

/** Cache por empresa (a principal na raiz, como sempre; as outras na pasta delas) */
async function cacheDir() {
  const dir = process.env.UPLOAD_DIR?.trim();
  if (!dir) return "";
  const { schema } = await currentConn();
  return schema === DEFAULT_SCHEMA ? path.join(dir, "_publico") : path.join(dir, "t", schema, "_publico");
}

export function publicCacheKey(...parts: string[]) {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 40);
}

export async function readPublicCache(key: string) {
  const dir = await cacheDir();
  if (!dir) return null;
  try {
    const raw = await readFile(path.join(dir, key.slice(0, 2), key));
    // 1º byte = tamanho do tipo, depois o tipo e a imagem
    const n = raw[0];
    return { type: raw.subarray(1, 1 + n).toString(), data: raw.subarray(1 + n) };
  } catch {
    return null;
  }
}

export async function writePublicCache(key: string, type: string, data: Buffer) {
  const dir = await cacheDir();
  if (!dir) return;
  try {
    const sub = path.join(dir, key.slice(0, 2));
    await mkdir(sub, { recursive: true });
    const t = Buffer.from(type);
    await writeFile(path.join(sub, key), Buffer.concat([Buffer.from([t.length]), t, data]));
  } catch (e) {
    console.error("[fotos] cache", e);
  }
}
