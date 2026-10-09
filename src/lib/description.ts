/**
 * Gerador de descrição de anúncio a partir dos dados do cadastro.
 * Determinístico (sem IA): cada `variant` muda abertura e fechamento.
 */
import { TYPE_LABELS } from "@/lib/labels";
import {
  ACESSO_LABELS,
  ALQUEIRE_HA,
  APTIDAO_LABELS,
  ENERGIA_LABELS,
  isRuralType,
  SOLO_LABELS,
  TOPOGRAFIA_LABELS,
  type RuralData,
} from "@/lib/rural";

export type DescriptionInput = {
  type: string;
  purpose: string;
  area: number;
  lotArea: number | null;
  bedrooms: number;
  suites: number;
  bathrooms: number;
  garage: number;
  neighborhood: string;
  city: string;
  state: string;
  features: string[];
  rural?: RuralData;
};

const num = (v: number, max = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: max });
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** ["a","b","c"] → "a, b e c" */
function joinList(items: string[]) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}`;
}

const plural = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`;

/** Aptidão como expressão ("com {x}") */
const APTIDAO_FRASE: Record<string, string> = {
  dupla: "dupla aptidão (pecuária e agricultura)",
  agricultura: "aptidão agrícola",
  pecuaria: "aptidão para pecuária",
  reflorestamento: "aptidão para reflorestamento",
  lazer: "perfil de lazer e recreio",
};

/** Gênero do tipo para concordância ("a casa" / "o apartamento"). */
const FEMININE = new Set(["casa", "cobertura", "fazenda", "chacara"]);

function place(i: DescriptionInput) {
  const city = [i.city, i.state].filter(Boolean).join("/");
  if (i.neighborhood && city) return `${i.neighborhood}, ${city}`;
  return i.neighborhood || city;
}

function urban(i: DescriptionInput, variant: number) {
  const tipo = TYPE_LABELS[i.type] ?? "Imóvel";
  const fem = FEMININE.has(i.type);
  const finalidade = i.purpose === "aluguel" ? "para locação" : "à venda";
  const local = place(i);
  const paras: string[] = [];

  const openers = [
    `${tipo} ${finalidade}${local ? ` em ${local}` : ""}${i.area ? `, com ${num(i.area)} m² de área construída` : ""}.`,
    `${fem ? "Uma" : "Um"} ${lower(tipo)} pensad${fem ? "a" : "o"} para quem busca conforto${local ? `, localizad${fem ? "a" : "o"} em ${local}` : ""}${i.area ? ` e com ${num(i.area)} m² bem distribuídos` : ""}.`,
    `Oportunidade${local ? ` em ${local}` : ""}: ${lower(tipo)} ${finalidade}${i.area ? ` com ${num(i.area)} m²` : ""}.`,
  ];
  paras.push(openers[variant % openers.length]);

  const rooms: string[] = [];
  if (i.bedrooms) {
    rooms.push(
      i.suites
        ? `${plural(i.bedrooms, "quarto", "quartos")}, sendo ${plural(i.suites, "suíte", "suítes")}`
        : plural(i.bedrooms, "quarto", "quartos"),
    );
  }
  if (i.bathrooms) rooms.push(plural(i.bathrooms, "banheiro", "banheiros"));
  if (i.garage) rooms.push(plural(i.garage, "vaga de garagem", "vagas de garagem"));
  let layout = rooms.length ? `São ${joinList(rooms)}.` : "";
  if (i.lotArea) layout += `${layout ? " " : ""}O terreno tem ${num(i.lotArea)} m².`;
  if (layout) paras.push(layout);

  if (i.features.length) {
    const f = i.features.map(lower);
    paras.push(
      [
        `Entre os destaques estão ${joinList(f)}.`,
        `O imóvel conta com ${joinList(f)}.`,
        `Diferenciais: ${joinList(f)}.`,
      ][variant % 3],
    );
  }

  paras.push(
    [
      "Agende sua visita e conheça pessoalmente.",
      "Fale com a gente e agende uma visita.",
      "Entre em contato para mais informações e para agendar sua visita.",
    ][variant % 3],
  );
  return paras.join("\n\n");
}

function rural(i: DescriptionInput, r: RuralData, variant: number) {
  const tipo = TYPE_LABELS[i.type] ?? "Propriedade";
  const fem = FEMININE.has(i.type);
  const local = place(i);
  const total = r.totalAlq ?? 0;
  const apt = r.aptidao ? APTIDAO_FRASE[r.aptidao] ?? lower(APTIDAO_LABELS[r.aptidao]) : "";
  const paras: string[] = [];

  const area = total ? `${num(total)} alqueires (${num(total * ALQUEIRE_HA, 1)} ha)` : "";
  const openers = [
    `${tipo}${area ? ` de ${area}` : ""}${local ? ` em ${local}` : ""}${apt ? `, com ${apt}` : ""}.`,
    `Excelente ${lower(tipo)} ${i.purpose === "aluguel" ? "para arrendamento" : "à venda"}${local ? ` em ${local}` : ""}${area ? `, com ${area}` : ""}${apt ? ` e ${apt}` : ""}.`,
    `${fem ? "Uma" : "Um"} ${lower(tipo)} pront${fem ? "a" : "o"} para produzir${local ? ` em ${local}` : ""}${area ? `: são ${area}` : ""}${apt ? `, com ${apt}` : ""}.`,
  ];
  paras.push(openers[variant % openers.length]);

  const uso: string[] = [];
  if (r.plantadaAlq)
    uso.push(`${num(r.plantadaAlq)} alq de lavoura${r.culturas ? ` (${lower(r.culturas)})` : ""}`);
  if (r.pastagemAlq)
    uso.push(`${num(r.pastagemAlq)} alq de pastagem formada${r.cabecas ? ` (lotação para ${num(r.cabecas, 0)} cabeças)` : ""}`);
  const preserva: string[] = [];
  if (r.reservaAlq) preserva.push(`${num(r.reservaAlq)} alq de reserva legal`);
  if (r.appAlq) preserva.push(`${num(r.appAlq)} alq de APP`);
  if (uso.length || preserva.length) {
    const parts = [...uso, ...preserva];
    paras.push(`A área se divide em ${joinList(parts)}.`);
  } else if (r.culturas) {
    paras.push(`Apta para ${lower(r.culturas)}.`);
  }

  const terreno: string[] = [];
  if (r.topografia) terreno.push(`topografia ${lower(TOPOGRAFIA_LABELS[r.topografia])}`);
  if (r.solo) terreno.push(`solo ${lower(SOLO_LABELS[r.solo])}`);
  const infra: string[] = [];
  if (terreno.length) infra.push(`${joinList(terreno).replace(/^./, (c) => c.toUpperCase())}.`);
  const acesso: string[] = [];
  if (r.acesso) acesso.push(`Acesso por ${lower(ACESSO_LABELS[r.acesso])}`);
  const dist: string[] = [];
  if (r.distanciaCidadeKm != null) dist.push(`a ${num(r.distanciaCidadeKm, 1)} km da cidade`);
  if (r.distanciaAsfaltoKm != null && r.acesso !== "asfalto")
    dist.push(`a ${num(r.distanciaAsfaltoKm, 1)} km do asfalto`);
  if (dist.length) acesso.push(joinList(dist));
  if (acesso.length) {
    const txt = acesso.join(", ");
    infra.push(`${txt.charAt(0).toUpperCase()}${txt.slice(1)}.`);
  }
  if (r.energia && r.energia !== "sem") infra.push(`Energia ${lower(ENERGIA_LABELS[r.energia])}.`);
  if (infra.length) paras.push(infra.join(" "));

  const extras: string[] = [];
  if (r.agua.length) extras.push(`Água: ${joinList(r.agua.map(lower))}.`);
  if (r.benfeitorias.length) extras.push(`Benfeitorias: ${joinList(r.benfeitorias.map(lower))}.`);
  if (extras.length) paras.push(extras.join(" "));

  paras.push(
    [
      "Agende uma visita e conheça a propriedade.",
      "Fale com a gente para receber o mapa (KMZ) e agendar uma visita.",
      "Entre em contato para mais informações, documentação e visita.",
    ][variant % 3],
  );
  return paras.join("\n\n");
}

export function generateDescription(input: DescriptionInput, variant = 0) {
  return isRuralType(input.type) && input.rural
    ? rural(input, input.rural, variant)
    : urban(input, variant);
}
