import { getWhiteLabel, listPublishedProperties } from "@/lib/queries";
import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const wl = await getWhiteLabel();
  const base = await siteBaseUrl(wl.domain);

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
