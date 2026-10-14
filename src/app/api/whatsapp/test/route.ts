import { getCurrentUser } from "@/lib/auth";
import { getWhatsAppConfig, testConnection, whatsappReady } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

/** Confere o token e o número na Meta */
export async function POST() {
  const u = await getCurrentUser();
  if (u?.role !== "admin") return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  const cfg = await getWhatsAppConfig();
  if (!whatsappReady(cfg)) return NextResponse.json({ error: "Informe o ID do número e o token." }, { status: 400 });
  try {
    return NextResponse.json(await testConnection(cfg));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na conexão." }, { status: 502 });
  }
}
