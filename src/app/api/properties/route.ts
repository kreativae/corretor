import { apiUser, unauthorized } from "@/lib/api-auth";
import { getDb } from "@/db";
import { activities, properties, propertyImages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { sanitizePropertyPartnerFields } from "@/lib/partners";
import { sanitizeResponsible } from "@/lib/responsible";
import { nextPropertyCode } from "@/lib/property-code";
import { alqToM2, isRuralType, kindOf, sanitizeRural, kmzOnly } from "@/lib/rural";
import { isLandType, sanitizeLand } from "@/lib/land";
import { parseYouTubeUrl } from "@/lib/utils";
import { propertyLimitError } from "@/lib/account";
import { setKmzPassword } from "@/lib/kmz-lock";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const limit = await propertyLimitError();
  if (limit) return NextResponse.json({ error: limit }, { status: 403 });
  try {
    const body = await req.json();
    const { images = [], kmzPassword, ...data } = body as Record<string, unknown> & {
      images?: string[];
    };

    // Parceria: só valores válidos (id do parceiro, percentuais 0–100)
    delete data.partnerId;
    delete data.commissionPct;
    delete data.partnerSharePct;
    Object.assign(data, sanitizePropertyPartnerFields(body));
    // Responsável: o escolhido no cadastro; sem escolha, quem está cadastrando
    data.responsibleId = await sanitizeResponsible(
      "responsibleId" in body ? body.responsibleId : (await getCurrentUser())?.id,
    );
    // Observações: texto livre, vazio = não aparece no site nem na ficha
    if ("notes" in data) data.notes = String(data.notes ?? "").trim().slice(0, 2000) || null;
    // Vídeo: só link válido do YouTube
    if ("videoUrl" in data) {
      const v = String(data.videoUrl ?? "").trim();
      data.videoUrl = parseYouTubeUrl(v) ? v.slice(0, 300) : null;
    }

    const rural = isRuralType(data.type as string);
    if (rural) {
      // Área em m² derivada dos alqueires (usada em buscas e ordenação)
      const ruralData = sanitizeRural(data.rural);
      data.rural = ruralData;
      data.area = alqToM2(ruralData.totalAlq ?? 0);
    } else if (isLandType(data.type as string)) {
      // Terreno: em `rural` só o KMZ do perímetro; o resto em `land`
      data.rural = kmzOnly(data.rural);
    } else {
      data.rural = null;
    }
    data.land = isLandType(data.type as string) ? sanitizeLand(data.land) : null;
    if (isLandType(data.type as string)) Object.assign(data, { bedrooms: 0, suites: 0, bathrooms: 0, garage: 0 });

    if (!data.title || typeof data.price !== "number" || typeof data.area !== "number") {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const code = await nextPropertyCode(kindOf(data.type as string));

    const [created] = await (await getDb())
      .insert(properties)
      .values({
        ...(data as typeof properties.$inferInsert),
        code,
      })
      .returning();

    if (images.length) {
      await (await getDb()).insert(propertyImages).values(
        images
          .filter((u) => typeof u === "string" && u.startsWith("http"))
          .map((url, i) => ({ propertyId: created.id, url, position: i })),
      );
    }

    const author = await getCurrentUser();
    await (await getDb()).insert(activities).values({
      entity: "imovel",
      entityId: created.id,
      kind: "created",
      text: `${rural ? "Propriedade rural" : "Imóvel"} ${created.code} cadastrad${rural ? "a" : "o"}${author ? ` por ${author.name}` : ""}.`,
    });

    // Senha do mapa/KMZ no site: guardada à parte, nunca nos dados do anúncio
    if (kmzPassword) await setKmzPassword(created.id, kmzPassword);

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar imóvel" }, { status: 500 });
  }
}
