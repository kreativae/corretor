/** Como a região do imóvel aparece no anúncio do site */
export type AreaMode = "lightbox" | "accordion" | "always" | "off";
export const AREA_MODES: { id: AreaMode; label: string; hint: string }[] = [
  { id: "lightbox", label: "Janela (lightbox)", hint: "Botão “Ver região no mapa” abre o mapa por cima da página." },
  { id: "accordion", label: "Sanfona", hint: "Botão abre o mapa logo abaixo, dentro da seção Localização." },
  { id: "always", label: "Sempre visível", hint: "O mapa aparece direto na seção Localização." },
  { id: "off", label: "Desligado", hint: "Só bairro e cidade, sem mapa." },
];
export const AREA_RADII = [0.25, 0.5, 1, 2, 3, 5];

/** Opções do mapa público da propriedade (/imoveis/[código]/mapa) e da região no anúncio. */
export type MapOptions = {
  /** Botão "Minha localização" (posição do visitante e distância) */
  locate: boolean;
  /** Botão "Como chegar" (rota no Google Maps) */
  directions: boolean;
  /** Mapa da região no anúncio (círculo aproximado, nunca o endereço exato) */
  areaMode: AreaMode;
  /** Raio do círculo, em km */
  areaRadiusKm: number;
};

export const MAP_OPTIONS_DEFAULTS: MapOptions = { locate: true, directions: true, areaMode: "lightbox", areaRadiusKm: 1 };

export function sanitizeMapOptions(input: Record<string, unknown>): MapOptions {
  const out = { ...MAP_OPTIONS_DEFAULTS };
  if (typeof input?.locate === "boolean") out.locate = input.locate;
  if (typeof input?.directions === "boolean") out.directions = input.directions;
  if (AREA_MODES.some((m) => m.id === input?.areaMode)) out.areaMode = input.areaMode as AreaMode;
  if (AREA_RADII.includes(Number(input?.areaRadiusKm))) out.areaRadiusKm = Number(input.areaRadiusKm);
  return out;
}
