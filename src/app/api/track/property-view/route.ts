import { db } from "@/db";
import { properties, propertyViews } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pagespeed|curl|wget|python-requests|node-fetch/i;

const VISITOR_COOKIE = "imob_visitor";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Registra uma visualização de imóvel com visitante anônimo (cookie 1p). */
export async function POST(req: Request) {
  try {
    const { propertyId } = await req.json();

    // 204 silencioso em qualquer problema — tracking nunca quebra a página
    if (typeof propertyId !== "string" || !UUID_RE.test(propertyId)) {
      return new Response(null, { status: 204 });
    }

    const ua = req.headers.get("user-agent") ?? "";
    if (!ua || BOT_UA.test(ua)) {
      return new Response(null, { status: 204 });
    }

    const [prop] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, propertyId));
    if (!prop) return new Response(null, { status: 204 });

    const jar = await cookies();
    let visitorId = jar.get(VISITOR_COOKIE)?.value;
    if (!visitorId || !UUID_RE.test(visitorId)) {
      visitorId = randomUUID();
      jar.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    await db.insert(propertyViews).values({
      propertyId,
      visitorId,
      referrer: req.headers.get("referer")?.slice(0, 300) ?? null,
    });

    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 204 });
  }
}
