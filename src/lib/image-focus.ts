/**
 * Ponto de foco das fotos: onde o corte (object-fit: cover) deve se centrar, por foto.
 * Guardado no imóvel como { url: "x% y%" }; vazio = centro.
 */
export type ImageFocus = Record<string, string>;

const FOCUS_RE = /^(\d{1,3})% (\d{1,3})%$/;

export const focusValue = (x: number, y: number) =>
  `${Math.round(Math.min(100, Math.max(0, x)))}% ${Math.round(Math.min(100, Math.max(0, y)))}%`;

/** Só fotos que existem no imóvel e valores válidos; centro (50% 50%) não precisa ser guardado */
export function sanitizeFocus(input: unknown, images?: string[]): ImageFocus | null {
  if (!input || typeof input !== "object") return null;
  const out: ImageFocus = {};
  for (const [url, v] of Object.entries(input as Record<string, unknown>)) {
    if (images && !images.includes(url)) continue;
    const m = typeof v === "string" ? v.match(FOCUS_RE) : null;
    if (!m) continue;
    const val = focusValue(Number(m[1]), Number(m[2]));
    if (val !== "50% 50%") out[url] = val;
  }
  return Object.keys(out).length ? out : null;
}

/** object-position da foto (undefined = centro) */
export function focusOf(map: ImageFocus | null | undefined, url: string | null | undefined) {
  return url && map?.[url] ? map[url] : undefined;
}
