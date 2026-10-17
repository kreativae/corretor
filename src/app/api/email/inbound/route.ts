import { getEmailConfig } from "@/lib/notify";
import { ingestReceivedEmail, verifyResendSignature } from "@/lib/mail";
import { NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * Webhook do Resend (evento "email.received"): grava o e-mail na caixa de quem recebeu.
 * A empresa vem do ?t= da URL; a origem é conferida pela assinatura do webhook.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const { webhookSecret } = await getEmailConfig();
  if (!verifyResendSignature(raw, req.headers, webhookSecret)) {
    return new Response("Assinatura inválida", { status: 401 });
  }
  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (event.type !== "email.received" || !event.data?.email_id) return NextResponse.json({ ok: true });
  try {
    const saved = await ingestReceivedEmail(event.data.email_id);
    return NextResponse.json({ ok: true, saved });
  } catch (e) {
    // Erro devolve 500: o Resend tenta de novo mais tarde
    console.error("[e-mail recebido]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Webhook de e-mails recebidos ativo. Este endereço é usado pelo Resend.",
  });
}
