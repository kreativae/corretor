import { getWhiteLabel, listPublishedProperties } from "@/lib/queries";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const wl = await getWhiteLabel();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${wl.domain}`;

  let properties: Awaited<ReturnType<typeof listPublishedProperties>> = [];
  try {
    properties = await listPublishedProperties();
  } catch {
    properties = [];
  }

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/imoveis`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...properties.map((p) => ({
      url: `${base}/imoveis/${p.code}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
