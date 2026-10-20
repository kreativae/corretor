import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Sem segredo no ambiente, um aleatório por processo: reiniciar o servidor só pede o login de novo
const fallback = randomBytes(32).toString("hex");
const secret = () => process.env.AUTH_SECRET || process.env.CRON_SECRET || process.env.GERENCIA_KEY || fallback;

/** Assinatura curta para cookies temporários (duas etapas, biometria) */
export const serverSign = (purpose: string, data: string) =>
  createHmac("sha256", secret()).update(`${purpose}:${data}`).digest("base64url");

export function serverVerify(purpose: string, data: string, mac: string) {
  const want = serverSign(purpose, data);
  return mac.length === want.length && timingSafeEqual(Buffer.from(mac), Buffer.from(want));
}
