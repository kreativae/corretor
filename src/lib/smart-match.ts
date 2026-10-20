/**
 * Smart match do WhatsApp: lê o que o cliente escreveu ("quero um terreno de uns 400 m² no
 * Jardim X até 300 mil") e procura na carteira. Regras simples e previsíveis, sem IA:
 * o corretor vê por que cada imóvel apareceu.
 */
import { ALQUEIRE_M2, isRuralType, kindOf } from "@/lib/rural";
import { isLandType } from "@/lib/land";

export const normText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export type Intent = {
  /** Tipos de imóvel citados (chaves de TYPE_LABELS) */
  types: string[];
  purpose: "venda" | "aluguel" | null;
  /** Área procurada em m² (rurais também; alqueires e hectares viram m²) */
  area: { min: number | null; max: number | null; target: number | null } | null;
  /** Área foi dita em alqueires (mostra assim no resumo) */
  areaInAlq: boolean;
  priceMax: number | null;
  bedrooms: number | null;
  /** Bairros e cidades da carteira citados na conversa */
  places: string[];
  /** Detalhes que pesam a favor (esquina, piscina, condomínio…) */
  wishes: string[];
};

export const EMPTY_INTENT: Intent = {
  types: [],
  purpose: null,
  area: null,
  areaInAlq: false,
  priceMax: null,
  bedrooms: null,
  places: [],
  wishes: [],
};

const LAND = ["terreno", "lote_condominio", "terreno_comercial", "area"];
const RURAL = ["chacara", "sitio", "fazenda"];

/** Palavra → tipos. A ordem importa: o mais específico primeiro */
const TYPE_RULES: [RegExp, string[]][] = [
  [/\blotes? (em|de|no|dentro de) condominio|\bcondominio de lotes\b/, ["lote_condominio"]],
  [/\bterrenos? comerci|\blotes? comerci/, ["terreno_comercial"]],
  [/\bglebas?\b|\barea (para|pra) (incorpora|lotea)/, ["area"]],
  [/\bterrenos?\b|\blotes?\b/, LAND],
  [/\bcoberturas?\b/, ["cobertura"]],
  [/\bapartamentos?\b|\baptos?\b|\baps?\b|\bape\b/, ["apartamento", "cobertura"]],
  [/\bkit ?net|\bstudios?\b|\bestudios?\b|\bloft\b/, ["estudio"]],
  // "estou em casa", "minha casa" não é pedido
  [/(?<!\b(?:em|na|minha|de|pra|para|sua|tua) )\bcasas?\b|\bsobrados?\b/, ["casa"]],
  [/\bchacaras?\b/, ["chacara"]],
  [/\bsitios?\b/, ["sitio"]],
  [/\bfazendas?\b/, ["fazenda"]],
  [/\b(area|imovel|propriedade) rural\b/, RURAL],
];

const WISHES: [RegExp, string][] = [
  [/\besquina\b/, "esquina"],
  [/\bpiscina\b/, "piscina"],
  [/\bchurrasqueira|espaco gourmet|area gourmet\b/, "gourmet"],
  [/\bcondominio fechado|\bem condominio\b|\bportaria\b/, "condomínio"],
  [/\bplano\b|\bsem declive\b/, "plano"],
  [/\bsuites?\b/, "suíte"],
  [/\bmobiliad/, "mobiliado"],
  [/\b(perto|proximo) (de |da |do )?(escola|colegio)/, "escola"],
];

const WORD_NUM: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 };

/** "1.200.000" → 1200000 · "1,5" → 1.5 · "300.000,00" → 300000 */
export function parseBRNumber(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const NUM = String.raw`(\d+(?:[.,]\d+)*)`;
const MULT = String.raw`(mil|milhao|milhoes|mi|k)?`;
const scale = (n: number, m: string | undefined) =>
  !m ? n : m === "mil" || m === "k" ? n * 1000 : n * 1_000_000;

/** Área citada numa mensagem (m²). Tira o trecho do texto para o preço não ler o mesmo número */
function readArea(t: string): { area: Intent["area"]; alq: boolean; rest: string } {
  let rest = t;
  let alq = false;
  const values: { v: number; ctx: string }[] = [];
  // Procura, guarda o valor com as palavras de antes ("até", "acima de") e apaga o trecho
  const grab = (re: RegExp, value: (m: RegExpMatchArray) => number | null, isAlq = false) => {
    for (const m of rest.matchAll(re)) {
      const v = value(m);
      if (v) {
        values.push({ v, ctx: rest.slice(Math.max(0, (m.index ?? 0) - 18), m.index) });
        if (isAlq) alq = true;
      }
    }
    rest = rest.replace(re, " ");
  };

  // 12x30, 12 x 30 m, 12 por 30
  grab(new RegExp(String.raw`\b${NUM}\s*(?:x|por)\s*${NUM}\s*(?:m\b|metros?\b|mts?\b)?`, "g"), (m) => {
    const x = parseBRNumber(m[1]);
    const y = parseBRNumber(m[2]);
    return x && y && x >= 3 && x < 200 && y >= 3 && y < 500 ? x * y : null;
  });
  grab(new RegExp(String.raw`\b${NUM}\s*(?:alqueires?|alq\b)`, "g"), (m) => {
    const n = parseBRNumber(m[1]);
    return n ? n * ALQUEIRE_M2 : null;
  }, true);
  grab(new RegExp(String.raw`\b${NUM}\s*(?:hectares?|ha\b)`, "g"), (m) => {
    const n = parseBRNumber(m[1]);
    return n ? n * 10_000 : null;
  });
  // 400 m², 400m2, 2 mil metros, 450 metros quadrados ("a 200 metros da praia" é distância)
  grab(
    new RegExp(String.raw`\b${NUM}\s*(mil)?\s*(?:m²|m2\b|mq\b|(?:metros?|mts?)(?: quadrados?)?\b(?! (?:da|do|de|das|dos|ate) ))`, "g"),
    (m) => {
      const n = parseBRNumber(m[1]);
      if (!n) return null;
      const v = m[2] ? n * 1000 : n;
      return v >= 20 ? v : null;
    },
  );

  if (!values.length) return { area: null, alq, rest };
  // "entre 300 e 500 metros" / "de 300 a 500 m²"
  if (values.length >= 2 && /\bentre\b|\bde \d[\d.,]* (a|ate) \d/.test(t)) {
    const sorted = values.map((x) => x.v).sort((a, b) => a - b);
    return { area: { min: sorted[0], max: sorted[sorted.length - 1], target: null }, alq, rest };
  }
  const { v, ctx } = values[values.length - 1];
  if (/(acima de|mais de|minimo|no minimo|pelo menos|a partir de)\s*$/.test(ctx)) return { area: { min: v, max: null, target: null }, alq, rest };
  if (/(ate|no maximo|menos de|maximo)\s*$/.test(ctx)) return { area: { min: null, max: v, target: null }, alq, rest };
  return { area: { min: null, max: null, target: v }, alq, rest };
}

/** Preço/orçamento citado: "até 300 mil", "R$ 450.000", "1,2 milhão" */
function readPrice(t: string, rent = false): number | null {
  const found: { v: number; budget: boolean }[] = [];
  const re = new RegExp(String.raw`(r\$\s*)?${NUM}\s*${MULT}\b(\s*(?:reais|r\$))?`, "g");
  for (const m of t.matchAll(re)) {
    const [, rs, num, mult, reais] = m;
    if (!rs && !mult && !reais) continue;
    const n = parseBRNumber(num);
    if (!n) continue;
    const v = scale(n, mult);
    if (v < (rent ? 300 : 20_000)) continue; // parcelas, sinal pequeno, ano…
    const before = t.slice(Math.max(0, (m.index ?? 0) - 24), m.index);
    // "entrada de 50 mil", "parcela de 2 mil": não é o preço do imóvel
    if (/(entrada|sinal|parcela|fgts|prestac)\D{0,12}$/.test(before)) continue;
    found.push({ v, budget: /(ate|maximo|orcamento|tenho|pagar|investir|valor|uns|em torno|na faixa|por volta)\D{0,10}$/.test(before) });
  }
  if (!found.length) return null;
  const best = [...found].reverse().find((f) => f.budget) ?? found[found.length - 1];
  return best.budget ? best.v : Math.round(best.v * 1.1);
}

function readBedrooms(t: string): number | null {
  const m = t.match(/\b(\d|um|uma|dois|duas|tres|quatro|cinco|seis)\s*(?:quartos?|dormitorios?|dorms?|qts?)\b/);
  if (!m) return null;
  return /\d/.test(m[1]) ? Number(m[1]) : (WORD_NUM[m[1]] ?? null);
}

/**
 * Lê as mensagens do cliente, da mais antiga para a mais nova: o que foi dito por último
 * vale (o cliente muda de ideia). Bairros e cidades se somam.
 */
export function parseIntent(texts: string[], knownPlaces: string[] = []): Intent {
  const out: Intent = { ...EMPTY_INTENT, types: [], places: [], wishes: [] };
  const places = knownPlaces
    .filter((p) => p.trim().length >= 4)
    .map((p) => ({ name: p, n: normText(p).trim() }));

  for (const raw of texts) {
    const t = ` ${normText(raw).replace(/\s+/g, " ")} `;
    if (!t.trim()) continue;

    // Nome de bairro não é pedido de tipo ("Gleba Palhano", "Chácara Paraíso")
    let rest = t;
    for (const p of places) if (rest.includes(p.n)) rest = rest.split(p.n).join(" ");
    const types = new Set<string>();
    for (const [re, list] of TYPE_RULES) {
      if (re.test(rest)) {
        list.forEach((x) => types.add(x));
        rest = rest.replace(re, " ");
      }
    }
    if (types.size) out.types = [...types];

    if (/\b(alug|locac|locar\b)/.test(t)) out.purpose = "aluguel";
    else if (/\b(compra|comprar|adquirir|financiar)\b|\ba venda\b/.test(t)) out.purpose = out.purpose ?? "venda";

    const a = readArea(t);
    if (a.area) {
      out.area = a.area;
      out.areaInAlq = a.alq;
    }
    const price = readPrice(a.rest, out.purpose === "aluguel");
    if (price) out.priceMax = price;
    const beds = readBedrooms(t);
    if (beds) out.bedrooms = beds;

    for (const p of places) {
      if (out.places.includes(p.name)) continue;
      const re = new RegExp(String.raw`(^|[^a-z0-9])${p.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
      if (re.test(t)) out.places.push(p.name);
    }
    for (const [re, w] of WISHES) if (re.test(t) && !out.wishes.includes(w)) out.wishes.push(w);
  }
  return out;
}

/** Algo para procurar? (sem tipo, área, preço, quartos nem lugar não dá para sugerir) */
export const hasCriteria = (i: Intent) =>
  i.types.length > 0 || !!i.area || !!i.priceMax || !!i.bedrooms || i.places.length > 0;

export type MatchCandidate = {
  id: string;
  type: string;
  purpose: string;
  status: string;
  price: number;
  /** m² (rurais: alqueires convertidos em m²) */
  area: number;
  bedrooms: number;
  neighborhood: string;
  city: string;
  /** Título, descrição, características e vantagens, para os desejos */
  text: string;
};

export type MatchResult = { id: string; score: number; reasons: string[] };

const brl = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`
    : v >= 100_000
      ? `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`
      : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
export const formatArea = (m2: number, alq = false) =>
  alq || m2 >= 100_000
    ? `${(m2 / ALQUEIRE_M2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} alq`
    : `${Math.round(m2).toLocaleString("pt-BR")} m²`;

/** Nota de 0 a 100 de um imóvel para o pedido; null = não serve */
export function scoreProperty(p: MatchCandidate, i: Intent): MatchResult | null {
  if (!["disponivel", "reservado"].includes(p.status)) return null;
  let score = 0;
  let weight = 0;
  const reasons: string[] = [];

  if (i.types.length) {
    weight += 30;
    if (i.types.includes(p.type)) {
      score += 30;
    } else {
      // Pediu terreno e é lote em condomínio etc.: mesma família vale menos; fora dela, não serve
      const kinds = new Set(i.types.map(kindOf));
      if (!kinds.has(kindOf(p.type))) return null;
      if (kindOf(p.type) === "urbano") return null;
      score += 15;
    }
  }
  if (i.purpose) {
    if (p.purpose !== i.purpose) return null;
  }
  if (i.area) {
    weight += 30;
    const { min, max, target } = i.area;
    const a = p.area;
    if (!a) {
      score += 5;
    } else if (target) {
      const r = a / target;
      if (r < 0.5 || r > 2.2) return null;
      const s = Math.max(0, 30 - Math.abs(Math.log(r)) * 45);
      score += s;
      if (s > 14) reasons.push(formatArea(a, isRuralType(p.type)));
    } else {
      if (min && a < min * 0.9) return null;
      if (max && a > max * 1.1) return null;
      score += 30;
      reasons.push(formatArea(a, isRuralType(p.type)));
    }
  }
  if (i.priceMax) {
    weight += 25;
    if (p.price > i.priceMax * 1.12) return null;
    // Bem abaixo do orçamento também serve, mas o ideal fica entre 60% e 100%
    const r = p.price / i.priceMax;
    score += r > 1 ? 15 : r >= 0.6 ? 25 : 12 + r * 20;
    reasons.push(r > 1 ? `${brl(p.price)} (pouco acima)` : brl(p.price));
  }
  if (i.bedrooms && !isLandType(p.type) && !isRuralType(p.type)) {
    weight += 10;
    if (p.bedrooms >= i.bedrooms) {
      score += 10;
      reasons.push(`${p.bedrooms} ${p.bedrooms === 1 ? "quarto" : "quartos"}`);
    } else if (p.bedrooms < i.bedrooms - 1) return null;
  }
  if (i.places.length) {
    weight += 25;
    const hit = i.places.find((x) => normText(x) === normText(p.neighborhood) || normText(x) === normText(p.city));
    if (hit) {
      score += 25;
      reasons.push(hit);
    }
  }
  if (i.wishes.length) {
    const hay = normText(p.text);
    for (const w of i.wishes) {
      const key = normText(w).slice(0, 6);
      if (hay.includes(key)) {
        score += 4;
        weight += 4;
        reasons.push(w);
      } else weight += 2;
    }
  }
  if (!weight) return null;
  return { id: p.id, score: Math.min(100, Math.round((score / weight) * 100)), reasons };
}

/** Os melhores imóveis da carteira para o pedido (até `limit`) */
export function smartMatch(list: MatchCandidate[], i: Intent, limit = 6): MatchResult[] {
  if (!hasCriteria(i)) return [];
  return list
    .map((p) => scoreProperty(p, i))
    .filter((r): r is MatchResult => !!r && r.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Chips do que o cliente procura: "Terreno", "≈ 400 m²", "até R$ 300 mil", "Jardim X" */
export function describeIntent(i: Intent, typeLabel: (t: string) => string) {
  const chips: string[] = [];
  const fams = new Set(i.types.map(kindOf));
  if (i.types.length) {
    if (i.types.length > 1 && fams.size === 1 && fams.has("terreno")) chips.push("Terreno / lote");
    else if (i.types.length > 1 && fams.size === 1 && fams.has("rural")) chips.push("Imóvel rural");
    else chips.push(...i.types.filter((t) => !(t === "cobertura" && i.types.includes("apartamento"))).slice(0, 2).map(typeLabel));
  }
  if (i.purpose) chips.push(i.purpose === "aluguel" ? "Aluguel" : "Compra");
  if (i.area) {
    const f = (v: number) => formatArea(v, i.areaInAlq);
    const { min, max, target } = i.area;
    chips.push(target ? `≈ ${f(target)}` : min && max ? `${f(min)} a ${f(max)}` : min ? `a partir de ${f(min)}` : `até ${f(max!)}`);
  }
  if (i.bedrooms) chips.push(`${i.bedrooms}+ quartos`);
  if (i.priceMax) chips.push(`até ${brl(i.priceMax)}`);
  chips.push(...i.places);
  chips.push(...i.wishes);
  return chips;
}

/** Assuntos da conversa, para o resumo */
const TOPICS: [RegExp, string][] = [
  [/\bvisit|\bconhecer\b|\bver (o|a|esse|essa) (imovel|casa|terreno|lote|apart)|\bagend/, "Quer visitar"],
  [/\bfinanci|\bbanco\b|\bcaixa\b|\bsimula/, "Financiamento"],
  [/\bfgts\b/, "FGTS"],
  [/\ba vista\b/, "Pagamento à vista"],
  [/\bpermut|\baceita (carro|troca)|\btroca\b/, "Permuta"],
  [/\bdesconto|\bmenor valor|\bnegoci|\bproposta|\baceita (menos|oferta)/, "Negociação de preço"],
  [/\bescritura|\bmatricula|\bdocument|\bitbi\b|\bregistro\b/, "Documentação"],
  [/\burgente|\bo quanto antes|\bpra ja\b|\beste mes\b|\bessa semana\b/, "Tem pressa"],
  [/\bvender (o|a|meu|minha)|\bquero vender|\banunciar (meu|minha)/, "Quer vender um imóvel"],
];

export function conversationTopics(texts: string[]) {
  const found: string[] = [];
  for (const raw of texts) {
    const t = ` ${normText(raw)} `;
    for (const [re, label] of TOPICS) if (re.test(t) && !found.includes(label)) found.push(label);
  }
  return found;
}
