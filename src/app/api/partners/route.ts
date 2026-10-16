import { getDb } from "@/db";
import { activities, partners } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { sanitizePartner } from "@/lib/partners";
import { listPartners } from "@/lib/queries";
import { NextResponse } from "next/server";

export async function GET() {
  if (!(await apiUser())) return unauthorized();
  return NextResponse.json(await listPartners());
}

export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  try {
    const data = sanitizePartner(await req.json());
    if (data.name.length < 2) return NextResponse.json({ error: "Informe o nome do parceiro." }, { status: 400 });
    const [created] = await (await getDb()).insert(partners).values(data).returning();
    await (await getDb()).insert(activities).values({
      entity: "sistema",
      entityId: null,
      kind: "created",
      text: `Parceiro ${created.name} cadastrado.`,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao cadastrar parceiro" }, { status: 500 });
  }
}
