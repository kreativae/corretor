import { requireAdmin } from "@/lib/auth";
import { requestPublicOrigin } from "@/lib/google";
import { sendTestEmail } from "@/lib/notify";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const to = await sendTestEmail(requestPublicOrigin(req));
    return NextResponse.json({ ok: true, to });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao enviar" },
      { status: 400 },
    );
  }
}
