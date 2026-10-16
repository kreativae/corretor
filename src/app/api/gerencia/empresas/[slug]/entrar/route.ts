import { getSuperadmin } from "@/lib/auth";
import { listTenants, TENANT_COOKIE } from "@/lib/tenant";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Gerência passa a navegar no CRM, admin e site desta empresa */
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await getSuperadmin())) return NextResponse.json({ error: "Apenas a gerência." }, { status: 403 });
  const { slug } = await params;
  if (!(await listTenants(true)).some((t) => t.slug === slug)) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }
  (await cookies()).set(TENANT_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true });
}
