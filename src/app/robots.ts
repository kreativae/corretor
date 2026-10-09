import { getWhiteLabel } from "@/lib/queries";
import type { MetadataRoute } from "next";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const wl = await getWhiteLabel();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${wl.domain}`;

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
