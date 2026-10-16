import { getWhiteLabel } from "@/lib/queries";
import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/tenant";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const wl = await getWhiteLabel();
  const base = await siteBaseUrl(wl.domain);

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/crm", "/admin", "/api", "/login"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
