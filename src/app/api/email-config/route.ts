import { getCurrentUser } from "@/lib/auth";
import { getEmailConfig, maskKey, saveEmailConfig, type EmailConfig } from "@/lib/notify";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/roles";

const view = (c: EmailConfig) => ({ ...c, resendApiKey: maskKey(c.resendApiKey), hasKey: !!c.resendApiKey });

/** Conta do Resend (chave e remetente) — só administradores */
export async function GET() {
  const u = await getCurrentUser();
  if (!isAdmin(u)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  return NextResponse.json(view(await getEmailConfig()));
}

export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!isAdmin(u)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  try {
    return NextResponse.json(view(await saveEmailConfig(await req.json())));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar." }, { status: 500 });
  }
}
