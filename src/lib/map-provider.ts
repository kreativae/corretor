import "server-only";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Mapa base e serviços da CARTO (Configurações › Mapa) */
export type MapStyle = "auto" | "voyager" | "positron" | "dark-matter" | "custom";

export type MapProviderConfig = {
  style: MapStyle;
  /** URL de blocos própria ({z}/{x}/{y}), ex.: estilo personalizado da CARTO */
  customTiles: string;
  customAttribution: string;
  /** Chave dos mapas base da CARTO (carto.com/basemaps/apikey) — vai na URL dos blocos, não é secreta */
  basemapKey: string;
  /** Endereço da API da CARTO (região da conta), ex.: https://gcp-us-east1.api.carto.com */
  cartoApiUrl: string;
  /** Token de acesso da API (CARTO Workspace › Developers › Credentials) */
  cartoToken: string;
};

const DEFAULTS: MapProviderConfig = {
  style: "auto",
  customTiles: "",
  customAttribution: "",
  basemapKey: "",
  cartoApiUrl: "https://gcp-us-east1.api.carto.com",
  cartoToken: "",
};

const STYLES: MapStyle[] = ["auto", "voyager", "positron", "dark-matter", "custom"];
const CARTO_ATTR = "© OpenStreetMap © CARTO";

export async function getMapProvider(): Promise<MapProviderConfig> {
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "mapProvider"));
    const v = (row?.value ?? {}) as Partial<MapProviderConfig>;
    return {
      ...DEFAULTS,
      ...v,
      basemapKey: v.basemapKey || process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY || "",
      cartoToken: v.cartoToken || process.env.CARTO_API_TOKEN || "",
    };
  } catch {
    return { ...DEFAULTS, cartoToken: process.env.CARTO_API_TOKEN || "" };
  }
}

export async function saveMapProvider(input: Partial<MapProviderConfig>) {
  const cur = await getMapProvider();
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const token = str(input.cartoToken, 2000);
  const tiles = str(input.customTiles, 500);
  const next: MapProviderConfig = {
    style: STYLES.includes(input.style as MapStyle) ? (input.style as MapStyle) : "auto",
    customTiles: /^https:\/\/.+\{z\}.+\{x\}.+\{y\}/.test(tiles) ? tiles : "",
    customAttribution: str(input.customAttribution, 200),
    basemapKey: str(input.basemapKey, 200).replace(/[^\w.-]/g, ""),
    cartoApiUrl: /^https:\/\/[\w.-]+(:\d+)?$/.test(str(input.cartoApiUrl, 200).replace(/\/+$/, ""))
      ? str(input.cartoApiUrl, 200).replace(/\/+$/, "")
      : DEFAULTS.cartoApiUrl,
    // Vazio ou mascarado mantém o atual; "-" apaga
    cartoToken: token === "-" ? "" : !token || token.includes("•") ? cur.cartoToken : token,
  };
  if (next.style === "custom" && !next.customTiles) next.style = "auto";
  const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "mapProvider"));
  if (row) await (await getDb()).update(settings).set({ value: next }).where(eq(settings.key, "mapProvider"));
  else await (await getDb()).insert(settings).values({ key: "mapProvider", value: next });
  return next;
}

export const maskToken = (s: string) => (s ? `${"•".repeat(8)}${s.slice(-4)}` : "");

/** O que o navegador precisa para desenhar o mapa (sem segredos) */
export type MapTiles = { light: string; dark: string; attribution: string };

const OSM: MapTiles = {
  light: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap",
};

export function tilesFor(cfg: MapProviderConfig): MapTiles {
  if (cfg.style === "custom" && cfg.customTiles) {
    return { light: cfg.customTiles, dark: cfg.customTiles, attribution: cfg.customAttribution || CARTO_ATTR };
  }
  // Desde set/2026 a CARTO só serve os mapas base com chave; sem ela, OpenStreetMap
  if (!cfg.basemapKey) return OSM;
  const key = encodeURIComponent(cfg.basemapKey);
  const carto = (path: string) => `https://basemaps.cartocdn.com/${path}/{z}/{x}/{y}{r}.png?key=${key}`;
  switch (cfg.style) {
    case "voyager":
      return { light: carto("rastertiles/voyager"), dark: carto("rastertiles/voyager"), attribution: CARTO_ATTR };
    case "positron":
      return { light: carto("light_all"), dark: carto("light_all"), attribution: CARTO_ATTR };
    case "dark-matter":
      return { light: carto("dark_all"), dark: carto("dark_all"), attribution: CARTO_ATTR };
    default:
      return { light: carto("rastertiles/voyager"), dark: carto("dark_all"), attribution: CARTO_ATTR };
  }
}

/** Procura lat/lng em qualquer nível da resposta (o formato varia por provedor) */
function findLatLng(v: unknown, depth = 0): [number, number] | null {
  if (!v || typeof v !== "object" || depth > 6) return null;
  const o = v as Record<string, unknown>;
  const lat = Number(o.latitude ?? o.lat);
  const lng = Number(o.longitude ?? o.lng ?? o.lon);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (o.latitude ?? o.lat) != null) return [lat, lng];
  for (const child of Array.isArray(v) ? v : Object.values(o)) {
    const hit = findLatLng(child, depth + 1);
    if (hit) return hit;
  }
  return null;
}

export class GeocodeError extends Error {}

/** Geocodificação pela CARTO (Location Data Services) */
export async function cartoGeocode(cfg: MapProviderConfig, address: string): Promise<[number, number] | null> {
  if (!cfg.cartoToken) throw new GeocodeError("Token da CARTO não configurado.");
  const url = `${cfg.cartoApiUrl}/v3/lds/geocoding/geocode?address=${encodeURIComponent(address)}&country=BR`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.cartoToken}` }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = `CARTO respondeu ${res.status}`;
    try {
      const j = JSON.parse(body) as { error?: string; message?: string };
      if (j.error || j.message) msg += `: ${j.error || j.message}`;
    } catch {}
    if (res.status === 401) msg = "Token da CARTO inválido ou expirado. Gere outro em Developers › Credentials.";
    if (res.status === 403)
      msg =
        "O token da CARTO não tem acesso à localização de endereços. Crie um API Access Token com a opção \"LDS API\" marcada (e confira se o seu plano inclui LDS).";
    throw new GeocodeError(msg);
  }
  return findLatLng(await res.json());
}

/** Geocodificação gratuita (OpenStreetMap) — usada sem token ou se a CARTO falhar */
export async function osmGeocode(address: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "corretor-crm/1.0 (mapa do m2)", "Accept-Language": "pt-BR" },
    cache: "no-store",
  });
  if (!res.ok) throw new GeocodeError(`OpenStreetMap respondeu ${res.status}`);
  const [hit] = (await res.json()) as { lat?: string; lon?: string }[];
  return hit?.lat && hit?.lon ? [Number(hit.lat), Number(hit.lon)] : null;
}
