import { apiUser, unauthorized } from "@/lib/api-auth";
import { lineFor, sendMediaUrl } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

const MAX = 4 * 1024 * 1024;

/** Envia foto ou documento (até 4 MB) pela conexão por QR code */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  try {
    const form = await req.formData();
    const file = form.get("file");
    const phone = String(form.get("phone") ?? "").replace(/\D/g, "");
    const caption = String(form.get("caption") ?? "").slice(0, 1000);
    if (!(file instanceof File) || phone.length < 10) return NextResponse.json({ error: "Arquivo ou número inválido." }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: "Arquivo acima de 4 MB." }, { status: 413 });
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const msg = await sendMediaUrl(await lineFor(user.id), phone, base64, {
      caption,
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      sentBy: user.name,
    });
    return NextResponse.json(msg);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no envio." }, { status: 502 });
  }
}
