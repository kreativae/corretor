import "server-only";
import { serverSign, serverVerify } from "@/lib/server-secret";
import { cookies, headers } from "next/headers";

/**
 * Biometria no login (passkey: Face ID, Touch ID, Windows Hello, digital no Android).
 * A chave fica no aparelho; o servidor guarda só a parte pública. Vale para o domínio
 * (com e sem www) em que foi cadastrada.
 */

const CHALLENGE_COOKIE = "imob_webauthn";

export async function passkeyConfig(rpName: string) {
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "localhost:3000").split(",")[0].trim();
  const hostname = host.split(":")[0];
  const proto = h.get("x-forwarded-proto")?.split(",")[0] || (hostname === "localhost" ? "http" : "https");
  const rpID = hostname.replace(/^www\./, "");
  const origins = [`${proto}://${host}`];
  if (rpID !== hostname) origins.push(`${proto}://${rpID}`);
  else if (hostname !== "localhost") origins.push(`${proto}://www.${hostname}`);
  return { rpID, rpName, origins };
}

/** Desafio num cookie assinado de 5 min */
export async function storeChallenge(challenge: string, purpose: "register" | "login", userId = "") {
  const data = `${purpose}.${userId}.${Date.now() + 300_000}.${challenge}`;
  (await cookies()).set(CHALLENGE_COOKIE, `${data}.${serverSign("webauthn", data)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300,
  });
}

export async function takeChallenge(purpose: "register" | "login") {
  const jar = await cookies();
  const raw = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete(CHALLENGE_COOKIE);
  const parts = raw?.split(".") ?? [];
  if (parts.length !== 5) return null;
  const [p, userId, exp, challenge, mac] = parts;
  if (!serverVerify("webauthn", `${p}.${userId}.${exp}.${challenge}`, mac)) return null;
  if (p !== purpose || Number(exp) < Date.now()) return null;
  return { challenge, userId };
}

/** Identificador do usuário dentro da chave: empresa + id (o login acha a empresa sem perguntar) */
export const userHandle = (tenantSlug: string, userId: string) => new TextEncoder().encode(`${tenantSlug}:${userId}`);

export function readUserHandle(b64url: string | undefined) {
  if (!b64url) return null;
  const [tenantSlug, userId] = Buffer.from(b64url, "base64url").toString().split(":");
  return tenantSlug && userId ? { tenantSlug, userId } : null;
}

/** Nome do aparelho a partir do navegador */
export async function guessDeviceName() {
  const ua = (await headers()).get("user-agent") ?? "";
  if (/iPhone/.test(ua)) return "iPhone (Face ID)";
  if (/iPad/.test(ua)) return "iPad";
  if (/Macintosh/.test(ua)) return "Mac (Touch ID)";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows Hello";
  return "Aparelho";
}
