import { getCurrentUser } from "@/lib/auth";
import { requestPublicOrigin } from "@/lib/google";
import { evolutionConnect, getWhatsAppConfig } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

export const maxDuration = 30;

/** Gera o QR code (cria a instância e aponta o webhook para o CRM) */
export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (u?.role !== "admin") return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  try {
    const body = (await req.json().catch(() => ({}))) as { number?: unknown };
    const digits = typeof body.number === "string" ? body.number.replace(/\D/g, "") : "";
    const number = digits.length >= 10 ? digits : undefined;
    return NextResponse.json(await evolutionConnect(await getWhatsAppConfig(), requestPublicOrigin(req), number));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao conectar." }, { status: 502 });
  }
}
