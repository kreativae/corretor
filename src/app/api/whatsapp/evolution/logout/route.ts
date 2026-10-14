import { getCurrentUser } from "@/lib/auth";
import { evolutionLogout, getWhatsAppConfig } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

/** Desconecta o número (o celular sai da lista de aparelhos conectados) */
export async function POST() {
  const u = await getCurrentUser();
  if (u?.role !== "admin") return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  try {
    await evolutionLogout(await getWhatsAppConfig());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha." }, { status: 502 });
  }
}
