import { getDb } from "@/db";
import { activities, users } from "@/db/schema";
import { loggedUser } from "@/lib/auth";
import { addHit, countHits } from "@/lib/rate-limit";
import { newRecoveryCodes, newTotpSecret, otpauthUri } from "@/lib/totp";
import { checkTwoFactorCode } from "@/lib/two-factor";
import { getWhiteLabel } from "@/lib/queries";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

/**
 * Verificação em duas etapas da própria conta (Minha conta):
 * start → segredo novo + QR · enable → confirma com o 1º código e devolve os códigos de recuperação
 * codes → novos códigos de recuperação · disable → desliga (código do app ou de recuperação)
 */
export async function POST(req: Request) {
  const me = await loggedUser();
  if (!me) return NextResponse.json({ error: "Entre de novo." }, { status: 401 });
  const { action, code } = await req.json().catch(() => ({}));
  const db = await getDb();
  const [u] = await db.select({ enabled: users.totpEnabledAt }).from(users).where(eq(users.id, me.id));
  if (!u) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  const log = (text: string) => db.insert(activities).values({ entity: "sistema", entityId: null, kind: "updated", text });

  if (action === "start") {
    if (u.enabled) return NextResponse.json({ error: "A verificação em duas etapas já está ativada." }, { status: 400 });
    const secret = newTotpSecret();
    await db.update(users).set({ totpSecret: secret, totpLastStep: null }).where(eq(users.id, me.id));
    const wl = await getWhiteLabel().catch(() => null);
    const issuer = (wl?.orgName || "Corretor").replace(/:/g, "");
    // QR sempre preto no branco: os leitores precisam de contraste, em qualquer tema
    const qr = await QRCode.toString(otpauthUri(secret, me.email, issuer), {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
    return NextResponse.json({ secret, qr });
  }

  // As demais pedem um código: limite contra tentativa e erro
  const key = `2fa:conta:${me.id}`;
  if (countHits(key, 15 * 60_000) >= 5) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  const wrong = () => {
    addHit(key);
    return NextResponse.json({ error: "Código incorreto. Confira o horário do celular e use o código atual do app." }, { status: 400 });
  };

  if (action === "enable") {
    if (u.enabled) return NextResponse.json({ error: "A verificação em duas etapas já está ativada." }, { status: 400 });
    if (!(await checkTwoFactorCode(me.id, String(code ?? ""), false))) return wrong();
    const { codes, stored } = newRecoveryCodes();
    await db.update(users).set({ totpEnabledAt: new Date(), recoveryCodes: stored }).where(eq(users.id, me.id));
    await log(`${me.name} ativou a verificação em duas etapas.`);
    return NextResponse.json({ ok: true, codes });
  }
  if (!u.enabled) return NextResponse.json({ error: "A verificação em duas etapas não está ativada." }, { status: 400 });

  if (action === "codes") {
    if ((await checkTwoFactorCode(me.id, String(code ?? ""), false)) !== "app") return wrong();
    const { codes, stored } = newRecoveryCodes();
    await db.update(users).set({ recoveryCodes: stored }).where(eq(users.id, me.id));
    await log(`${me.name} gerou novos códigos de recuperação.`);
    return NextResponse.json({ ok: true, codes });
  }
  if (action === "disable") {
    if (!(await checkTwoFactorCode(me.id, String(code ?? ""), true))) return wrong();
    await db
      .update(users)
      .set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: "" })
      .where(eq(users.id, me.id));
    await log(`${me.name} desativou a verificação em duas etapas.`);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
