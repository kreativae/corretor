import { getDb } from "@/db";
import { activities, passkeys } from "@/db/schema";
import { loggedUser } from "@/lib/auth";
import { getSecuritySettings } from "@/lib/features";
import { guessDeviceName, passkeyConfig, storeChallenge, takeChallenge, userHandle } from "@/lib/passkeys";
import { getWhiteLabel } from "@/lib/queries";
import { currentTenant } from "@/lib/tenant";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { AuthenticatorTransport, RegistrationResponseJSON } from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/** Cadastro da biometria deste aparelho (Minha conta): options → o navegador cria a chave → verify */
export async function POST(req: Request) {
  const me = await loggedUser();
  if (!me) return NextResponse.json({ error: "Entre de novo." }, { status: 401 });
  if (!(await getSecuritySettings()).passkeys) {
    return NextResponse.json({ error: "Entrar com biometria está desligado em Configurações." }, { status: 400 });
  }
  const tenant = await currentTenant();
  const wl = await getWhiteLabel().catch(() => null);
  const cfg = await passkeyConfig(wl?.orgName || "Corretor");
  const db = await getDb();
  const body = await req.json().catch(() => ({}));

  if (body.step === "options") {
    const existing = await db.select({ id: passkeys.id, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.userId, me.id));
    const options = await generateRegistrationOptions({
      rpName: cfg.rpName,
      rpID: cfg.rpID,
      userName: me.email,
      userDisplayName: me.name,
      userID: userHandle(tenant?.slug ?? "principal", me.id),
      attestationType: "none",
      excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports as AuthenticatorTransport[] })),
      // Chave que dispensa digitar o e-mail + biometria obrigatória
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
    await storeChallenge(options.challenge, "register", me.id);
    return NextResponse.json(options);
  }

  if (body.step === "verify") {
    const ch = await takeChallenge("register");
    if (!ch || ch.userId !== me.id) return NextResponse.json({ error: "O cadastro expirou. Tente de novo." }, { status: 400 });
    try {
      const { verified, registrationInfo } = await verifyRegistrationResponse({
        response: body.response as RegistrationResponseJSON,
        expectedChallenge: ch.challenge,
        expectedOrigin: cfg.origins,
        expectedRPID: cfg.rpID,
        requireUserVerification: true,
      });
      if (!verified || !registrationInfo) return NextResponse.json({ error: "Não foi possível verificar o aparelho." }, { status: 400 });
      const { credential } = registrationInfo;
      const name = await guessDeviceName();
      await db.insert(passkeys).values({
        id: credential.id,
        userId: me.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports ?? [],
        name,
      });
      await db.insert(activities).values({ entity: "sistema", entityId: null, kind: "updated", text: `${me.name} cadastrou a biometria (${name}).` });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no cadastro." }, { status: 400 });
    }
  }
  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}

/** Remove a biometria de um aparelho */
export async function DELETE(req: Request) {
  const me = await loggedUser();
  if (!me) return NextResponse.json({ error: "Entre de novo." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const db = await getDb();
  const [gone] = await db.delete(passkeys).where(and(eq(passkeys.id, id), eq(passkeys.userId, me.id))).returning({ name: passkeys.name });
  if (gone) await db.insert(activities).values({ entity: "sistema", entityId: null, kind: "updated", text: `${me.name} removeu a biometria (${gone.name}).` });
  return NextResponse.json({ ok: true });
}
