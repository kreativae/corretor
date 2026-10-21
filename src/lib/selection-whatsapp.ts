import "server-only";
import { fillMessage, MESSAGE_DEFAULTS, type Messages } from "@/lib/messages";
import { TYPE_LABELS } from "@/lib/labels";
import type { PropertyWithImages } from "@/lib/queries";
import { selectionSpecs } from "@/lib/selection-email";
import { formatBRL } from "@/lib/utils";

/** Primeira mensagem da seleção: saudação + texto do corretor */
export function selectionWaIntro(toName: string, message: string, msgs: Messages = MESSAGE_DEFAULTS) {
  const name = toName.trim();
  const first = name.split(/\s+/)[0] || "";
  const greeting = first ? fillMessage(msgs.selGreeting, { nome: name, primeiro_nome: first }) : "";
  return [greeting && `*${greeting}*`, message.trim()].filter(Boolean).join("\n\n");
}

/** Texto de um imóvel (legenda da foto ou mensagem sozinha), no formato do WhatsApp */
export function selectionWaCard(p: PropertyWithImages, baseUrl: string, msgs: Messages = MESSAGE_DEFAULTS) {
  const page = `${baseUrl}/imoveis/${p.code}`;
  const place = [p.neighborhood, p.city].filter(Boolean).join(", ");
  const specs = selectionSpecs(p);
  // Sem ícones e sem "R$" no valor: o WhatsApp não transforma em link de pagamento
  const value = formatBRL(p.price).replace(/^R\$\s*/, "");
  const title = [`*${p.title.trim()}*`, `_${TYPE_LABELS[p.type] ?? p.type} · ${p.code}_`];
  const info = [
    place ? `*Região* - ${place}` : "",
    specs ? `*Dimensão* - ${specs}` : "",
    `*Valor* - ${value}${p.purpose === "aluguel" ? " por mês" : ""}`,
  ];
  const links = [p.published ? `${msgs.selBtnDetails}: ${page}` : "", `${msgs.selBtnFicha}: ${page}/ficha`];
  return [title.join("\n"), info.filter(Boolean).join("\n"), links.filter(Boolean).join("\n")].join("\n\n");
}
