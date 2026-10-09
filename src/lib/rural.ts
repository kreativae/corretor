/** Propriedades rurais: tipos, rótulos e cálculos de área (alqueire paulista). */

/** Alqueire paulista — padrão no PR, SP e MS: 24.200 m² = 2,42 ha. */
export const ALQUEIRE_M2 = 24_200;
export const ALQUEIRE_HA = 2.42;
/** Reserva legal mínima fora da Amazônia Legal (Código Florestal, art. 12). */
export const RESERVA_LEGAL_MIN_PCT = 20;

export const RURAL_TYPES = ["fazenda", "sitio", "chacara"] as const;
export type RuralType = (typeof RURAL_TYPES)[number];

export function isRuralType(type: string | null | undefined): type is RuralType {
  return !!type && (RURAL_TYPES as readonly string[]).includes(type);
}

export const APTIDAO_LABELS = {
  dupla: "Dupla aptidão",
  agricultura: "Agricultura",
  pecuaria: "Pecuária",
  reflorestamento: "Reflorestamento",
  lazer: "Lazer / recreio",
} as const;
export type Aptidao = keyof typeof APTIDAO_LABELS;

export const TOPOGRAFIA_LABELS = {
  plana: "Plana",
  levemente_ondulada: "Levemente ondulada",
  ondulada: "Ondulada",
  acidentada: "Acidentada",
} as const;

export const SOLO_LABELS = {
  argiloso: "Argiloso (terra roxa)",
  misto: "Misto",
  arenoso: "Arenoso",
} as const;

export const ENERGIA_LABELS = {
  trifasica: "Trifásica",
  monofasica: "Monofásica",
  sem: "Sem energia",
} as const;

export const ACESSO_LABELS = {
  asfalto: "Asfalto até a porteira",
  cascalho: "Cascalho",
  terra: "Estrada de terra",
} as const;

export const AGUA_OPCOES = [
  "Rio",
  "Córrego",
  "Nascentes",
  "Represa / açude",
  "Poço artesiano",
  "Mina d'água",
];

export const BENFEITORIAS_OPCOES = [
  "Casa sede",
  "Casa de funcionário",
  "Barracão",
  "Curral",
  "Mangueira / brete",
  "Balança",
  "Silos",
  "Secador",
  "Galpão de máquinas",
  "Cercas",
  "Pivô de irrigação",
  "Pomar",
];

export type RuralData = {
  /** Área total, em alqueires paulistas */
  totalAlq: number | null;
  /** Reserva legal averbada */
  reservaAlq: number | null;
  /** Área de preservação permanente (APP) */
  appAlq: number | null;
  /** Lavoura / área plantada */
  plantadaAlq: number | null;
  /** Pastagem formada */
  pastagemAlq: number | null;
  aptidao: Aptidao | "";
  /** Culturas atuais ou aptas, ex.: soja, milho, trigo */
  culturas: string;
  /** Capacidade de lotação (cabeças) */
  cabecas: number | null;
  topografia: keyof typeof TOPOGRAFIA_LABELS | "";
  solo: keyof typeof SOLO_LABELS | "";
  energia: keyof typeof ENERGIA_LABELS | "";
  acesso: keyof typeof ACESSO_LABELS | "";
  distanciaCidadeKm: number | null;
  distanciaAsfaltoKm: number | null;
  agua: string[];
  benfeitorias: string[];
  matricula: string;
  car: string;
  ccir: string;
  nirf: string;
  /** Arquivo KMZ/KML do perímetro */
  kmzUrl: string;
  kmzName: string;
};

export const EMPTY_RURAL: RuralData = {
  totalAlq: null,
  reservaAlq: null,
  appAlq: null,
  plantadaAlq: null,
  pastagemAlq: null,
  aptidao: "",
  culturas: "",
  cabecas: null,
  topografia: "",
  solo: "",
  energia: "",
  acesso: "",
  distanciaCidadeKm: null,
  distanciaAsfaltoKm: null,
  agua: [],
  benfeitorias: [],
  matricula: "",
  car: "",
  ccir: "",
  nirf: "",
  kmzUrl: "",
  kmzName: "",
};

export function normalizeRural(r: Partial<RuralData> | null | undefined): RuralData {
  return { ...EMPTY_RURAL, ...(r ?? {}) };
}

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

/** Distribuição de áreas da propriedade (tudo em alqueires). */
export function ruralAreas(r: RuralData) {
  const total = n(r.totalAlq);
  const reserva = n(r.reservaAlq);
  const app = n(r.appAlq);
  const plantada = n(r.plantadaAlq);
  const pastagem = n(r.pastagemAlq);
  const preservada = reserva + app;
  /** Área aberta = total − reserva legal − APP */
  const aberta = Math.max(0, total - preservada);
  /** Área aberta ainda não classificada (sede, estradas, benfeitorias, sem uso) */
  const outras = Math.max(0, aberta - plantada - pastagem);
  const reservaMin = (total * RESERVA_LEGAL_MIN_PCT) / 100;
  const excesso = plantada + pastagem + preservada - total;
  return {
    total,
    totalHa: total * ALQUEIRE_HA,
    reserva,
    reservaPct: pct(reserva, total),
    reservaMin,
    reservaOk: total === 0 || reserva >= reservaMin - 1e-9,
    app,
    appPct: pct(app, total),
    plantada,
    plantadaPct: pct(plantada, total),
    pastagem,
    pastagemPct: pct(pastagem, total),
    aberta,
    abertaPct: pct(aberta, total),
    outras,
    outrasPct: pct(outras, total),
    /** Soma das partes ultrapassa o total informado */
    inconsistente: total > 0 && excesso > 1e-9,
    excesso: Math.max(0, excesso),
  };
}

/** 12,5 → "12,5" ; 100 → "100" */
export function formatAlq(v: number) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function formatHa(alq: number) {
  return (alq * ALQUEIRE_HA).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function formatPct(v: number) {
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** Converte alqueires em m² (campo `area` da tabela de imóveis). */
export function alqToM2(alq: number) {
  return Math.round(alq * ALQUEIRE_M2);
}

/** Preço por alqueire, quando há área. */
export function pricePerAlq(price: number, totalAlq: number | null) {
  return totalAlq && totalAlq > 0 ? Math.round(price / totalAlq) : null;
}

/** Mantém só campos conhecidos, com o tipo certo (entrada vinda da API). */
export function sanitizeRural(input: unknown): RuralData {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: RuralData = { ...EMPTY_RURAL, agua: [], benfeitorias: [] };
  const fields = out as unknown as Record<string, unknown>;
  for (const [k, def] of Object.entries(EMPTY_RURAL)) {
    const v = src[k];
    if (Array.isArray(def)) {
      if (Array.isArray(v)) fields[k] = v.filter((x) => typeof x === "string").slice(0, 40);
    } else if (def === null) {
      const num = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
      fields[k] = Number.isFinite(num) && num >= 0 ? num : null;
    } else if (typeof v === "string") {
      fields[k] = v.trim().slice(0, 500);
    }
  }
  if (out.aptidao && !(out.aptidao in APTIDAO_LABELS)) out.aptidao = "";
  if (out.kmzUrl && !/^https?:\/\//.test(out.kmzUrl)) out.kmzUrl = "";
  return out;
}
