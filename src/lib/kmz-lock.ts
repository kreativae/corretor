import "server-only";
import { getDb } from "@/db";
import { propertyKmzLocks } from "@/db/schema";
import { loggedUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * KMZ protegido por senha: o mapa do QR code e o download no site pedem a senha definida no
 * cadastro do imóvel. Quem está logado no CRM vê direto. Liberado, o navegador guarda um cookie
 * por 12 h; trocar a senha invalida os cookies antigos.
 */

const UNLOCK_HOURS = 12;
const cookieName = (propertyId: string) => `kmz_${propertyId.replace(/-/g, "")}`;
const token = (propertyId: string, password: string) =>
  createHash("sha256").update(`kmz:${propertyId}:${password}`).digest("hex");

export async function getKmzPassword(propertyId: string): Promise<string | null> {
  const [row] = await (await getDb())
    .select({ password: propertyKmzLocks.password })
    .from(propertyKmzLocks)
    .where(eq(propertyKmzLocks.propertyId, propertyId))
    .catch(() => []);
  return row?.password || null;
}

/** Vazio remove a proteção. */
export async function setKmzPassword(propertyId: string, raw: unknown) {
  const password = String(raw ?? "").trim().slice(0, 64);
  const db = await getDb();
  if (!password) {
    await db.delete(propertyKmzLocks).where(eq(propertyKmzLocks.propertyId, propertyId));
    return;
  }
  await db
    .insert(propertyKmzLocks)
    .values({ propertyId, password })
    .onConflictDoUpdate({ target: propertyKmzLocks.propertyId, set: { password, updatedAt: new Date() } });
}

/** "open": sem senha · "unlocked": senha certa ou usuário do CRM · "locked": precisa da senha */
export async function kmzAccess(propertyId: string): Promise<"open" | "unlocked" | "locked"> {
  const password = await getKmzPassword(propertyId);
  if (!password) return "open";
  if (await loggedUser()) return "unlocked";
  const got = (await cookies()).get(cookieName(propertyId))?.value ?? "";
  const want = token(propertyId, password);
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want)) ? "unlocked" : "locked";
}

/** Confere a senha digitada; certa, grava o cookie de liberação. */
export async function unlockKmz(propertyId: string, typed: string) {
  const password = await getKmzPassword(propertyId);
  if (!password) return true;
  const a = Buffer.from(typed.trim());
  const b = Buffer.from(password);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  (await cookies()).set(cookieName(propertyId), token(propertyId, password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/imoveis",
    maxAge: UNLOCK_HOURS * 3600,
  });
  return true;
}

/** Caminho do arquivo no armazenamento (kmz/...) a partir do endereço salvo no imóvel. */
export function kmzPathname(url: string): string | null {
  try {
    const path = new URL(url, "http://x").pathname;
    const m = path.match(/\/api\/media\/(kmz\/.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
