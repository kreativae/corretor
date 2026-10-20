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
  const head = [
    `*${p.title.trim()}*`,
    `_${TYPE_LABELS[p.type] ?? p.type} · ${p.code}_`,
    place ? `📍 ${place}` : "",
    specs ? `📐 ${specs}` : "",
    `💰 *${formatBRL(p.price)}*${p.purpose === "aluguel" ? " /mês" : ""}`,
  ];
  const links = [p.published ? `🔗 ${msgs.selBtnDetails}: ${page}` : "", `📄 ${msgs.selBtnFicha}: ${page}/ficha`];
  return [head.filter(Boolean).join("\n"), links.filter(Boolean).join("\n")].join("\n\n");
}
