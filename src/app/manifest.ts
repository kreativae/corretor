import { brandShortName, getWhiteLabel } from "@/lib/queries";
import type { MetadataRoute } from "next";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const wl = await getWhiteLabel();
  return {
    name: `${wl.orgName} — ImobManager`,
    short_name: brandShortName(wl),
    description: "Casas, apartamentos e imóveis rurais à venda e para alugar.",
    start_url: "/",
    display: "standalone",
    background_color: "#11112a",
    theme_color: wl.accent,
    icons: [
      ...(wl.iconUrl ? [{ src: wl.iconUrl, sizes: "512x512", purpose: "any" as const }] : []),
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
