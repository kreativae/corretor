import "server-only";
import { fillMessage, MESSAGE_DEFAULTS, waCardText, type Messages } from "@/lib/messages";
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

/** Valores das variáveis da mensagem de um imóvel (modelo em Configurações › Mensagens) */
export function selectionWaVars(p: PropertyWithImages, baseUrl: string) {
  const page = `${baseUrl}/imoveis/${p.code}`;
  return {
    titulo: p.title.trim(),
    tipo: TYPE_LABELS[p.type] ?? p.type,
    codigo: p.code,
    regiao: [p.neighborhood, p.city].filter(Boolean).join(", "),
    dimensao: selectionSpecs(p),
    // Sem "R$": o WhatsApp não transforma em link de pagamento
    valor: `${formatBRL(p.price).replace(/^R\$\s*/, "")}${p.purpose === "aluguel" ? " por mês" : ""}`,
    finalidade: p.purpose === "aluguel" ? "Aluguel" : "Venda",
    link: p.published ? page : "",
    ficha: `${page}/ficha`,
  };
}

/** Texto de um imóvel (legenda da foto ou mensagem sozinha), pelo modelo do WhatsApp */
export function selectionWaCard(p: PropertyWithImages, baseUrl: string, msgs: Messages = MESSAGE_DEFAULTS, template?: string) {
  return waCardText(template?.trim() || msgs.selWaCard, selectionWaVars(p, baseUrl));
}
