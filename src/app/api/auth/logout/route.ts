import { destroySession } from "@/lib/auth";
import { TENANT_COOKIE } from "@/lib/tenant";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  await destroySession();
  // Sem empresa escolhida: o próximo login decide
  (await cookies()).delete(TENANT_COOKIE);
  return NextResponse.json({ ok: true });
}
