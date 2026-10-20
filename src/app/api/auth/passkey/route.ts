import { dbFor, withTenant } from "@/db";
import { passkeys, users } from "@/db/schema";
import { getSecuritySettings } from "@/lib/features";
import { finishLogin, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS, waitMessage } from "@/lib/login";
import { passkeyConfig, readUserHandle, storeChallenge, takeChallenge } from "@/lib/passkeys";
import { addHit, clientIp, countHits, retryAfter } from "@/lib/rate-limit";
import { connOf, listTenants } from "@/lib/tenant";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransport } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Entrar com biometria: options → o aparelho assina com Face ID / Touch ID → verify.
 * A chave já diz a empresa e o usuário; não pede e-mail, senha nem o código das duas etapas
 * (a chave no aparelho + a biometria já são dois fatores).
 */
export async function POST(req: Request) {
  const ipKey = `login:ip:${clientIp(req)}`;
  if (countHits(ipKey, LOGIN_WINDOW_MS) >= LOGIN_MAX_PER_IP) {
    const wait = retryAfter(ipKey, LOGIN_WINDOW_MS);
    return NextResponse.json({ error: waitMessage(wait) }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const cfg = await passkeyConfig("Corretor");

  if (body.step === "options") {
    const options = await generateAuthenticationOptions({ rpID: cfg.rpID, userVerification: "required" });
    await storeChallenge(options.challenge, "login");
    return NextResponse.json(options);
  }
  if (body.step !== "verify") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });

  const fail = (error: string) => {
    addHit(ipKey);
    return NextResponse.json({ error }, { status: 401 });
  };
  const ch = await takeChallenge("login");
  if (!ch) return fail("A tentativa expirou. Tente de novo.");
  const response = body.response as AuthenticationResponseJSON;
  const who = readUserHandle(response?.response?.userHandle);
  const tenant = who && (await listTenants()).find((t) => t.slug === who.tenantSlug);
  if (!who || !tenant) return fail("Este aparelho não está cadastrado. Entre com e-mail e senha e ative a biometria em Minha conta.");

  const result = await withTenant(connOf(tenant), async () => {
    if (!(await getSecuritySettings()).passkeys) return "Entrar com biometria está desligado.";
    const db = dbFor(connOf(tenant));
    const [pk] = await db.select().from(passkeys).where(eq(passkeys.id, response.id));
    if (!pk || pk.userId !== who.userId) return "Este aparelho não está cadastrado. Entre com e-mail e senha e ative a biometria em Minha conta.";
    const [user] = await db.select().from(users).where(eq(users.id, pk.userId));
    if (!user?.active) return "Conta desativada. Fale com o administrador.";
    try {
      const { verified, authenticationInfo } = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: cfg.origins,
        expectedRPID: cfg.rpID,
        requireUserVerification: true,
        credential: {
          id: pk.id,
          publicKey: new Uint8Array(Buffer.from(pk.publicKey, "base64url")),
          counter: pk.counter,
          transports: pk.transports as AuthenticatorTransport[],
        },
      });
      if (!verified) return "Não foi possível verificar a biometria.";
      await db.update(passkeys).set({ counter: authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(passkeys.id, pk.id));
      return { user, device: pk.name };
    } catch (e) {
      return e instanceof Error ? e.message : "Falha na verificação.";
    }
  });
  if (typeof result === "string") return fail(result);
  const redirect = await finishLogin(tenant, result.user, ` com biometria (${result.device})`);
  return NextResponse.json({ ok: true, redirect });
}
