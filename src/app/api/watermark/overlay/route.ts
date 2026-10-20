import { currentConn } from "@/db";
import { getWatermarkSettings } from "@/lib/features";
import { getWatermarkLogo, watermark } from "@/lib/watermark";
import sharp from "sharp";

/** Marca d'água sozinha, em PNG transparente 16:9, para ficar por cima do vídeo do anúncio. */
const cache = new Map<string, { at: number; data: Buffer }>();

export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get("wm") ?? "padrao";
  const base = await getWatermarkSettings();
  const s =
    !base.enabled || mode === "nenhuma"
      ? { ...base, logo: false, lines: false }
      : mode === "logo"
        ? { ...base, logo: true, lines: false }
        : mode === "linhas"
          ? { ...base, logo: false, lines: true }
          : base;
  const key = `${(await currentConn()).schema}:${JSON.stringify(s)}`;
  let hit = cache.get(key);
  if (!hit || Date.now() - hit.at > 10 * 60_000) {
    const blank = await sharp({
      create: { width: 1600, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const { data } = await watermark(blank, s, s.logo ? await getWatermarkLogo() : null);
    hit = { at: Date.now(), data };
    if (cache.size > 50) cache.clear();
    cache.set(key, hit);
  }
  return new Response(new Uint8Array(hit.data), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}
