/** Configuração da marca d'água das fotos do site (Configurações › Marca d'água). */
export type WatermarkSettings = {
  enabled: boolean;
  /** Logotipo ao centro */
  logo: boolean;
  /** Opacidade do logotipo (%) */
  logoOpacity: number;
  /** Largura do logotipo (% da foto) */
  logoSize: number;
  /** Linhas diagonais (estilo banco de imagens) */
  lines: boolean;
  /** Opacidade das linhas (%) */
  linesOpacity: number;
  /** Distância entre linhas (% da diagonal da foto) */
  linesSpacing: number;
  /** Linhas cruzadas (losangos) em vez de numa só direção */
  linesCross: boolean;
};

export const WATERMARK_DEFAULTS: WatermarkSettings = {
  enabled: true,
  logo: true,
  logoOpacity: 50,
  logoSize: 30,
  lines: true,
  linesOpacity: 25,
  linesSpacing: 9,
  linesCross: true,
};

const clamp = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};

export function sanitizeWatermark(input: Record<string, unknown>): WatermarkSettings {
  const d = WATERMARK_DEFAULTS;
  const bool = (k: keyof WatermarkSettings) =>
    typeof input?.[k] === "boolean" ? (input[k] as boolean) : (d[k] as boolean);
  return {
    enabled: bool("enabled"),
    logo: bool("logo"),
    logoOpacity: clamp(input?.logoOpacity, 10, 90, d.logoOpacity),
    logoSize: clamp(input?.logoSize, 15, 60, d.logoSize),
    lines: bool("lines"),
    linesOpacity: clamp(input?.linesOpacity, 5, 50, d.linesOpacity),
    linesSpacing: clamp(input?.linesSpacing, 4, 25, d.linesSpacing),
    linesCross: bool("linesCross"),
  };
}
