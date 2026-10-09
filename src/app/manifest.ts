import { getWhiteLabel } from "@/lib/queries";
import type { MetadataRoute } from "next";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const wl = await getWhiteLabel();
  return {
    name: `${wl.orgName} — ImobManager`,
    short_name: wl.orgName.split(" ")[0],
    description: "Imóveis excepcionais, curadoria autoral.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#10b981",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
