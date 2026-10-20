import "server-only";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { consumeRecoveryCode, verifyTotp } from "@/lib/totp";
import { eq } from "drizzle-orm";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Login esperando o código do app: cookie assinado com usuário, empresa e validade (10 min) */
export const PENDING_2FA_COOKIE = "imob_2fa";
export const PENDING_2FA_SECONDS = 600;

// Sem segredo no ambiente, um aleatório por processo: reiniciar o servidor só pede o login de novo
const fallback = randomBytes(32).toString("hex");
const secret = () => process.env.AUTH_SECRET || process.env.CRON_SECRET || process.env.GERENCIA_KEY || fallback;
const sign = (data: string) => createHmac("sha256", secret()).update(`2fa:${data}`).digest("base64url");

export function pendingToken(userId: string, tenantSlug: string) {
  const data = `${userId}.${tenantSlug}.${Date.now() + PENDING_2FA_SECONDS * 1000}`;
  return `${data}.${sign(data)}`;
}

export function readPendingToken(token: string | undefined) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, tenantSlug, exp, mac] = parts;
  const want = sign(`${userId}.${tenantSlug}.${exp}`);
  if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  if (Number(exp) < Date.now()) return null;
  return { userId, tenantSlug };
}

/**
 * Confere um código do app (ou, se permitido, de recuperação) do usuário no banco atual.
 * Atualiza o último passo usado (o mesmo código não vale duas vezes) ou a lista de recuperação.
 */
export async function checkTwoFactorCode(userId: string, input: string, allowRecovery: boolean) {
  const db = await getDb();
  const [u] = await db
    .select({ secret: users.totpSecret, last: users.totpLastStep, codes: users.recoveryCodes })
    .from(users)
    .where(eq(users.id, userId));
  if (!u?.secret) return null;
  const step = verifyTotp(u.secret, input, u.last);
  if (step != null) {
    await db.update(users).set({ totpLastStep: step }).where(eq(users.id, userId));
    return "app" as const;
  }
  if (!allowRecovery) return null;
  const left = consumeRecoveryCode(u.codes, input);
  if (left == null) return null;
  await db.update(users).set({ recoveryCodes: left }).where(eq(users.id, userId));
  return "recovery" as const;
}

/** Destino depois do login: só caminhos internos (evita mandar para outro site) */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}
