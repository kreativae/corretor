/**
 * Terrenos (lotes, lotes em condomínio, terrenos comerciais e áreas/glebas): tipos, campos
 * próprios e cálculos que ajudam a vender (preço do m², potencial construtivo).
 * A área do terreno fica em `properties.area` (m²); o resto em `properties.land`.
 */
export const LAND_TYPES = ["terreno", "lote_condominio", "terreno_comercial", "area"] as const;
export type LandType = (typeof LAND_TYPES)[number];

export function isLandType(type: string | null | undefined): type is LandType {
  return !!type && (LAND_TYPES as readonly string[]).includes(type);
}

export const TOPOGRAFIA_TERRENO = {
  plano: "Plano",
  levemente_inclinado: "Levemente inclinado",
  aclive: "Aclive (sobe para o fundo)",
  declive: "Declive (desce para o fundo)",
} as const;

export const FORMATO_TERRENO = {
  regular: "Regular (retangular)",
  irregular: "Irregular",
  esquina: "De esquina",
} as const;

/** Para onde a frente do terreno está virada (sol) */
export const POSICAO_SOLAR = {
  norte: "Norte (sol o dia todo)",
  leste: "Leste (sol da manhã)",
  oeste: "Oeste (sol da tarde)",
  sul: "Sul",
} as const;

export const USO_PERMITIDO = ["Residencial", "Comercial", "Misto", "Industrial"];

export const SITUACAO_OPCOES = ["Limpo", "Murado", "Cercado", "Terraplanado", "Com calçada", "Construção a demolir"];

export const INFRA_OPCOES = [
  "Água",
  "Esgoto",
  "Energia elétrica",
  "Rua asfaltada",
  "Iluminação pública",
  "Galerias pluviais",
  "Gás encanado",
  "Internet fibra",
];

export const DOCUMENTACAO_OPCOES = [
  "Escritura registrada",
  "Matrícula individual",
  "IPTU em dia",
  "Sem débitos",
  "Projeto aprovado",
  "Desmembrável",
];

/** Vantagens sugeridas (o corretor marca as que valem e pode escrever outras) */
export const VANTAGENS_OPCOES = [
  "Pronto para construir",
  "Esquina",
  "Vista livre",
  "Sol da manhã",
  "Rua tranquila",
  "Área nobre",
  "Região em valorização",
  "Próximo a escolas",
  "Próximo a comércio e serviços",
  "Fácil acesso a avenidas",
  "Condomínio fechado com portaria",
  "Lazer completo no condomínio",
  "Ideal para investidor",
  "Bom para incorporação",
  "Aceita financiamento",
  "Aceita permuta",
  "Documentação em dia",
  "Pode ser desmembrado",
];

export type LandData = {
  /** Medidas, em metros */
  frenteM: number | null;
  fundoM: number | null;
  ladoEsqM: number | null;
  ladoDirM: number | null;
  formato: keyof typeof FORMATO_TERRENO | "";
  topografia: keyof typeof TOPOGRAFIA_TERRENO | "";
  posicaoSolar: keyof typeof POSICAO_SOLAR | "";
  /** Loteamento ou condomínio, quadra e lote */
  loteamento: string;
  quadra: string;
  lote: string;
  /** Zoneamento da prefeitura (ex.: ZR-2) e o que ele permite */
  zoneamento: string;
  usoPermitido: string[];
  /** Coeficiente de aproveitamento (vezes a área do terreno) */
  coeficiente: number | null;
  /** Taxa de ocupação máxima (%) */
  taxaOcupacao: number | null;
  /** Altura máxima (pavimentos) */
  gabarito: number | null;
  situacao: string[];
  infraestrutura: string[];
  documentacao: string[];
  matricula: string;
  vantagens: string[];
  distanciaCentroKm: number | null;
};

export const EMPTY_LAND: LandData = {
  frenteM: null,
  fundoM: null,
  ladoEsqM: null,
  ladoDirM: null,
  formato: "",
  topografia: "",
  posicaoSolar: "",
  loteamento: "",
  quadra: "",
  lote: "",
  zoneamento: "",
  usoPermitido: [],
  coeficiente: null,
  taxaOcupacao: null,
  gabarito: null,
  situacao: [],
  infraestrutura: [],
  documentacao: [],
  matricula: "",
  vantagens: [],
  distanciaCentroKm: null,
};

export function normalizeLand(l: Partial<LandData> | null | undefined): LandData {
  return { ...EMPTY_LAND, ...(l ?? {}) };
}

/** Mantém só campos conhecidos, com o tipo certo (entrada vinda da API) */
export function sanitizeLand(input: unknown): LandData {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: LandData = { ...EMPTY_LAND, usoPermitido: [], situacao: [], infraestrutura: [], documentacao: [], vantagens: [] };
  const fields = out as unknown as Record<string, unknown>;
  for (const [k, def] of Object.entries(EMPTY_LAND)) {
    const v = src[k];
    if (Array.isArray(def)) {
      if (Array.isArray(v)) {
        fields[k] = [...new Set(v.filter((x) => typeof x === "string").map((x: string) => x.trim().slice(0, 80)).filter(Boolean))].slice(0, 40);
      }
    } else if (def === null) {
      const num = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v.replace(",", ".")) : NaN;
      fields[k] = Number.isFinite(num) && num >= 0 ? num : null;
    } else if (typeof v === "string") {
      fields[k] = v.trim().slice(0, 200);
    }
  }
  if (out.formato && !(out.formato in FORMATO_TERRENO)) out.formato = "";
  if (out.topografia && !(out.topografia in TOPOGRAFIA_TERRENO)) out.topografia = "";
  if (out.posicaoSolar && !(out.posicaoSolar in POSICAO_SOLAR)) out.posicaoSolar = "";
  return out;
}

const fmt = (v: number, max = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: max });

/** "12 × 30 m" (frente × fundo), quando informados */
export function landDimensions(l: LandData) {
  if (!l.frenteM && !l.fundoM) return "";
  return `${l.frenteM ? fmt(l.frenteM) : "?"} × ${l.fundoM ? fmt(l.fundoM) : "?"} m`;
}

/** Números que vendem o terreno: preço do m², área construível e ocupação máxima */
export function landNumbers(price: number, areaM2: number, l: LandData) {
  const area = areaM2 > 0 ? areaM2 : 0;
  return {
    pricePerM2: area ? Math.round(price / area) : null,
    /** Área construível total = área × coeficiente de aproveitamento */
    buildable: area && l.coeficiente ? Math.round(area * l.coeficiente) : null,
    /** Projeção máxima no chão = área × taxa de ocupação */
    footprint: area && l.taxaOcupacao ? Math.round((area * l.taxaOcupacao) / 100) : null,
  };
}

export const formatM2 = (v: number) => `${fmt(v, 0)} m²`;
export const formatMeters = (v: number) => `${fmt(v)} m`;
