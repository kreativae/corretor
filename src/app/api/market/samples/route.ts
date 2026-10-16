import { getDb } from "@/db";
import { marketSamples } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { TYPE_LABELS } from "@/lib/labels";
import { NextResponse } from "next/server";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/** Nova amostra de mercado · área em m² (rurais: o cliente já converte de alqueires) */
export async function POST(req: Request) {
  const u = await apiUser();
  if (!u) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const type = str(b.type, 30);
  const price = num(b.price);
  const area = num(b.area);
  const city = str(b.city, 80);
  if (!(type in TYPE_LABELS)) return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  if (!price || !area) return NextResponse.json({ error: "Informe valor e área." }, { status: 400 });
  if (!city) return NextResponse.json({ error: "Informe a cidade." }, { status: 400 });
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? new Date(`${b.date}T12:00:00`) : new Date();
  const [row] = await (await getDb())
    .insert(marketSamples)
    .values({
      type,
      purpose: b.purpose === "aluguel" ? "aluguel" : "venda",
      price,
      area,
      neighborhood: str(b.neighborhood, 80),
      city,
      state: str(b.state, 2).toUpperCase(),
      source: str(b.source, 80) || null,
      notes: str(b.notes, 500) || null,
      sampledAt: date,
      createdBy: u.name,
    })
    .returning();
  return NextResponse.json(row);
}
