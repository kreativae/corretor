import { apiUser, unauthorized } from "@/lib/api-auth";
import { lineFor, sendTemplate, sendText, WhatsAppError } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

/** Envia texto (ou o modelo aprovado, com template: true) para um número */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const text = String(body.text ?? "").trim().slice(0, 4096);
  if (phone.length < 10) return NextResponse.json({ error: "Número inválido." }, { status: 400 });
  try {
    const cfg = await lineFor(user.id);
    const msg = body.template ? await sendTemplate(cfg, phone, user.name) : text ? await sendText(cfg, phone, text, user.name) : null;
    if (!msg) return NextResponse.json({ error: "Escreva a mensagem." }, { status: 400 });
    return NextResponse.json(msg);
  } catch (e) {
    const err = e instanceof WhatsAppError ? e : null;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha no envio.", window: err?.kind === "window" },
      { status: 502 },
    );
  }
}
