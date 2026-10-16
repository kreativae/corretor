import { getDb } from "@/db";
import { regionGeo } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getMapProvider, maskToken, saveMapProvider, type MapProviderConfig } from "@/lib/map-provider";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/roles";

const view = (c: MapProviderConfig) => ({ ...c, cartoToken: maskToken(c.cartoToken), hasToken: !!c.cartoToken });

export async function GET() {
  const u = await getCurrentUser();
  if (!isAdmin(u)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  return NextResponse.json(view(await getMapProvider()));
}

export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!isAdmin(u)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  try {
    const saved = await saveMapProvider(await req.json());
    // Com token novo, tenta de novo as regiões que o mapa gratuito não encontrou
    if (saved.cartoToken) await (await getDb()).delete(regionGeo).where(isNull(regionGeo.lat));
    return NextResponse.json(view(saved));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar." }, { status: 500 });
  }
}
