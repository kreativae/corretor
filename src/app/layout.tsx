import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { MotionFX, SmoothScroll } from "@/components/motion";
import { BrandProvider } from "@/components/brand";
import { brandShortName, getWhiteLabel } from "@/lib/queries";
import { getSiteContent } from "@/lib/site-content";
import { hexToRgbTriplet } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export async function generateMetadata(): Promise<Metadata> {
  const [wl, content] = await Promise.all([getWhiteLabel(), getSiteContent()]);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${wl.domain}`;
  return {
    metadataBase: new URL(base),
    title: { default: content.seo.title, template: `%s · ${wl.orgName}` },
    ...(wl.iconUrl ? { icons: { icon: wl.iconUrl, apple: wl.iconUrl } } : {}),
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
  themeColor: "#0a0a0a",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const wl = await getWhiteLabel();
  const accent = hexToRgbTriplet(wl.accent) ?? "16 185 129";

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      style={{ "--accent": accent } as CSSProperties}
    >
      <body
        className={`${inter.variable} ${jetbrains.variable} bg-canvas font-sans text-ink antialiased`}
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
          }}
        >
          {children}
        </BrandProvider>
      </body>
    </html>
  );
}
