/** Opções do mapa público da propriedade (/imoveis/[código]/mapa). */
export type MapOptions = {
  /** Botão "Minha localização" (posição do visitante e distância) */
  locate: boolean;
  /** Botão "Como chegar" (rota no Google Maps) */
  directions: boolean;
};

export const MAP_OPTIONS_DEFAULTS: MapOptions = { locate: true, directions: true };

export function sanitizeMapOptions(input: Record<string, unknown>): MapOptions {
  const out = { ...MAP_OPTIONS_DEFAULTS };
  for (const k of Object.keys(out) as (keyof MapOptions)[]) {
    if (typeof input?.[k] === "boolean") out[k] = input[k] as boolean;
  }
  return out;
}
