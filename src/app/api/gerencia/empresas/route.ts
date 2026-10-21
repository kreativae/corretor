import { getSuperadmin } from "@/lib/auth";
import { createCompany } from "@/lib/gerencia";
import { emailInOtherCompany, slugify } from "@/lib/tenant";
import { NextResponse } from "next/server";

export const maxDuration = 60;

/** Cria uma empresa nova com banco zerado e o administrador dela */
export async function POST(req: Request) {
  if (!(await getSuperadmin())) return NextResponse.json({ error: "Apenas a gerência." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const name = str(b.name, 120);
  const slug = slugify(str(b.slug, 40) || name);
  const adminName = str(b.adminName, 120);
  const adminEmail = str(b.adminEmail, 200).toLowerCase();
  const adminPassword = String(b.adminPassword ?? "");
  if (!name) return NextResponse.json({ error: "Informe o nome da empresa." }, { status: 400 });
  if (!slug || slug.length < 3) return NextResponse.json({ error: "Identificador com ao menos 3 letras ou números." }, { status: 400 });
  if (!adminName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return NextResponse.json({ error: "Informe nome e e-mail do administrador." }, { status: 400 });
  }
  if (adminPassword.length < 8) return NextResponse.json({ error: "A senha do administrador deve ter ao menos 8 caracteres." }, { status: 400 });
  try {
    const other = await emailInOtherCompany(adminEmail);
    if (other) return NextResponse.json({ error: `Este e-mail já tem conta em ${other}. Use outro e-mail para o administrador.` }, { status: 409 });
    const t = await createCompany({ name, slug, adminName, adminEmail, adminPassword, plan: str(b.plan, 60) });
    return NextResponse.json({ ok: true, slug: t.slug });
  } catch (e) {
    console.error("[nova empresa]", e);
    const msg = e instanceof Error ? e.message : "Falha ao criar a empresa.";
    return NextResponse.json(
      { error: /permission denied|must have createrole|createrole/i.test(msg) ? "O usuário do banco não tem permissão para criar usuários (CREATEROLE). Use o usuário dono do Neon (neondb_owner) na DATABASE_URL." : msg },
      { status: 400 },
    );
  }
}
