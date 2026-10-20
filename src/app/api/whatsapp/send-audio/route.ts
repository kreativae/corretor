import { apiUser, unauthorized } from "@/lib/api-auth";
import { lineFor, sendAudio } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const MAX = 10 * 1024 * 1024;

/** Envia mensagem de voz gravada no navegador (conexão por QR code) */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  try {
    const form = await req.formData();
    const file = form.get("file");
    const phone = String(form.get("phone") ?? "").replace(/\D/g, "");
    if (!(file instanceof File) || phone.length < 10) return NextResponse.json({ error: "Áudio ou número inválido." }, { status: 400 });
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/webm")) {
      return NextResponse.json({ error: "Formato de áudio inválido." }, { status: 400 });
    }
    if (file.size > MAX) return NextResponse.json({ error: "Áudio acima de 10 MB." }, { status: 413 });
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return NextResponse.json(await sendAudio(await lineFor(user.id), phone, base64, user.name));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no envio." }, { status: 502 });
  }
}
