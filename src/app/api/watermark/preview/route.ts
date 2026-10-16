import { getDb } from "@/db";
import { propertyImages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getFile } from "@/lib/blob";
import { watermark } from "@/lib/watermark";
import { sanitizeWatermark } from "@/lib/watermark-settings";
import sharp from "sharp";

/** Foto de exemplo: a primeira foto cadastrada ou, sem fotos, um céu/fachada desenhado. */
async function sampleImage(): Promise<Buffer> {
  try {
    const [img] = await (await getDb()).select({ url: propertyImages.url }).from(propertyImages).limit(1);
    const path = img?.url.split("/api/media/")[1]?.split("?")[0];
    const r = path ? await getFile(decodeURIComponent(path)) : null;
    if (r) {
      const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
      return await sharp(buf).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg().toBuffer();
    }
  } catch {}
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fa8e6"/><stop offset="1" stop-color="#cfe3f7"/></linearGradient></defs>
<rect width="1200" height="800" fill="url(#g)"/>
<rect x="140" y="260" width="300" height="540" fill="#5b6270"/><rect x="480" y="160" width="260" height="640" fill="#2f3a4f"/>
<rect x="780" y="330" width="320" height="470" fill="#8a7b6a"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

/** Prévia da marca d'água com os ajustes ainda não salvos (query string). */
export async function GET(req: Request) {
  await requireAdmin();
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const parsed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) parsed[k] = v === "1" ? true : v === "0" ? false : v;
  const s = { ...sanitizeWatermark(parsed), enabled: true };
  const { data, type } = await watermark(await sampleImage(), s);
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": type, "Cache-Control": "private, no-store" },
  });
}
