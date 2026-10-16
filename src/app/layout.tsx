import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Montserrat } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { MotionFX, SmoothScroll } from "@/components/motion";
import { BrandProvider } from "@/components/brand";
import { brandShortName, getWhiteLabel } from "@/lib/queries";
import { getSiteContent } from "@/lib/site-content";
import { hexToRgbTriplet, onAccentColor } from "@/lib/utils";
import "./globals.css";
import { siteBaseUrl } from "@/lib/tenant";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
// Substituta livre da Nexa (tipografia da marca): geométrica, do fino ao pesado
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

/** Favicon com a inicial do nome, para quem não usa o símbolo padrão nem enviou ícone */
function letterIcon(name: string, accent: string) {
  const letter = (name.trim()[0] ?? "•").toUpperCase().replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${accent}"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const [wl, content] = await Promise.all([getWhiteLabel(), getSiteContent()]);
  const base = await siteBaseUrl(wl.domain);
  return {
    metadataBase: new URL(base),
    title: { default: content.seo.title, template: `%s · ${wl.orgName}` },
    ...(wl.iconUrl
      ? { icons: { icon: wl.iconUrl, apple: wl.iconUrl } }
      : !wl.showMark
        ? { icons: { icon: letterIcon(wl.orgName, wl.accent) } }
        : {}),
    description: content.seo.description,
    openGraph: {
      title: content.seo.title,
      description: content.seo.description,
      siteName: wl.orgName,
      locale: "pt_BR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: content.seo.title,
      description: content.seo.description,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#11112a",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const wl = await getWhiteLabel();
  const accent = hexToRgbTriplet(wl.accent) ?? "244 117 37";

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      style={{ "--accent": accent, "--on-accent": onAccentColor(wl.accent, wl.onAccent) } as CSSProperties}
    >
      <body
        className={`${inter.variable} ${jetbrains.variable} ${montserrat.variable} bg-canvas font-sans text-ink antialiased`}
      >
        <SmoothScroll />
        <MotionFX />
        <BrandProvider
          value={{
            orgName: wl.orgName,
            shortName: brandShortName(wl),
            sub: wl.brandSub,
            logoUrl: wl.logoUrl,
            logoDarkUrl: wl.logoDarkUrl,
            iconUrl: wl.iconUrl,
            showMark: wl.showMark,
          }}
        >
          {children}
        </BrandProvider>
      </body>
    </html>
  );
}
