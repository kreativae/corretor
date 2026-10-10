"use client";

import {
  APTIDAO_LABELS,
  formatAlq,
  formatHa,
  formatPct,
  isRuralType,
  normalizeRural,
  pricePerAlq,
  ruralAreas,
} from "@/lib/rural";

import { Button, Modal } from "@/components/ui";
import type { PropertyWithImages, WhiteLabel } from "@/lib/queries";
import { formatBRL, formatCompact, formatNumber } from "@/lib/utils";
import { TYPE_LABELS } from "@/lib/labels";
import {
  Check,
  Copy,
  ExternalLink,
  Camera,
  FileCode2,
  FileDown,
  Megaphone,
  MessageCircle,
  Share2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function AdExporterModal({
  property: p,
  whiteLabel: wl,
}: {
  property: PropertyWithImages;
  whiteLabel: WhiteLabel;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"whatsapp" | "instagram" | "portais" | "classificados">("whatsapp");
  const [copied, setCopied] = useState<string | null>(null);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : `https://${wl.domain}`;
  const propertyUrl = `${siteUrl}/imoveis/${p.code}`;
  const fichaUrl = `${siteUrl}/imoveis/${p.code}/ficha`;
  const xmlFeedUrl = `${siteUrl}/api/feed.xml`;

  const rural = isRuralType(p.type);
  const r = normalizeRural(p.rural);
  const ra = ruralAreas(r);
  const mapaUrl = `${siteUrl}/imoveis/${p.code}/mapa`;
  const perAlq = pricePerAlq(p.price, r.totalAlq);
  const ruralLines = [
    `📐 *Área total:* ${formatAlq(ra.total)} alqueires (${formatHa(ra.total)} ha)`,
    r.aptidao ? `🌾 *Aptidão:* ${APTIDAO_LABELS[r.aptidao]}` : "",
    ra.plantada ? `🚜 *Área plantada:* ${formatAlq(ra.plantada)} alq` : "",
    ra.pastagem ? `🐄 *Pastagem:* ${formatAlq(ra.pastagem)} alq` : "",
    ra.reserva ? `🌳 *Reserva legal:* ${formatAlq(ra.reserva)} alq (${formatPct(ra.reservaPct)})` : "",
    r.culturas ? `🌱 *Culturas:* ${r.culturas}` : "",
    r.agua.length ? `💧 *Água:* ${r.agua.join(", ")}` : "",
    r.benfeitorias.length ? `🏠 *Benfeitorias:* ${r.benfeitorias.join(", ")}` : "",
  ].filter(Boolean);

  // Copies pré-formatadas para cada canal
  const whatsappCopy = rural
    ? `✨ *${p.title.toUpperCase()}* (${p.code})
📍 *Localização:* ${p.neighborhood} — ${p.city}/${p.state}

${ruralLines.join("\n")}

💰 *Valor:* ${formatBRL(p.price)}${perAlq ? ` (${formatBRL(perAlq)}/alq)` : ""}
${r.kmzUrl ? `\n🗺️ *Mapa do perímetro (KMZ):*\n${mapaUrl}\n` : ""}
🔗 *Fotos e detalhes:*
${propertyUrl}

📄 *Ficha técnica em PDF:*
${fichaUrl}

_Atendimento exclusivo ${wl.orgName}_`
    : `✨ *${p.title.toUpperCase()}* (${p.code})
📍 *Localização:* ${p.neighborhood} — ${p.city}/${p.state}

📐 *Área:* ${formatNumber(p.area)} m² construídos
🛏️ *Quartos:* ${p.bedrooms}${p.suites ? ` (${p.suites} suíte${p.suites > 1 ? "s" : ""})` : ""}
🚿 *Banheiros:* ${p.bathrooms}
🚗 *Vagas:* ${p.garage}

💰 *Valor:* ${formatBRL(p.price)}${p.purpose === "aluguel" ? "/mês" : ""}
${p.condoFee ? `🏢 *Condomínio:* ${formatBRL(p.condoFee)}/mês\n` : ""}${p.iptu ? `🏛️ *IPTU:* ${formatBRL(p.iptu)}/ano\n` : ""}
${p.features.length ? `🌟 *Destaques:* ${p.features.slice(0, 5).join(" • ")}\n` : ""}
🔗 *Ver fotos e agendar visita:*
${propertyUrl}

📄 *Ficha técnica completa em PDF:*
${fichaUrl}

_Atendimento exclusivo ${wl.orgName}_`;

  const instagramCopy = rural
    ? `🌾 ${p.title} | ${p.city.toUpperCase()}/${p.state}

${p.description ? `${p.description.slice(0, 180)}...\n\n` : ""}${ruralLines.map((l) => l.replace(/\*/g, "")).join("\n")}

💰 ${formatBRL(p.price)}${perAlq ? ` · ${formatBRL(perAlq)} por alqueire` : ""}

📲 Fale com a gente pelo direct ou link na bio.
Código: ${p.code}

#fazenda #fazendaavenda #imoveisrurais #agro #${p.type} #${p.city.toLowerCase().replace(/\s+/g, "")} #${wl.orgName.toLowerCase().replace(/\s+/g, "")}`
    : `🏡 ${p.title} | ${p.neighborhood.toUpperCase()}

${p.description ? `${p.description.slice(0, 180)}...\n\n` : ""}✨ Detalhes do imóvel:
• ${formatNumber(p.area)} m² de área privativa
• ${p.bedrooms} dormitórios (${p.suites} suítes)
• ${p.bathrooms} banheiros
• ${p.garage} vagas de garagem
${p.features.length ? `• Lazer & comodidades: ${p.features.slice(0, 4).join(", ")}\n` : ""}
💎 ${p.purpose === "venda" ? "Valor de Venda" : "Locação"}: ${formatBRL(p.price)}
${p.condoFee ? `Condomínio: ${formatBRL(p.condoFee)} | ` : ""}${p.iptu ? `IPTU: ${formatBRL(p.iptu)}/ano` : ""}

📲 Agende sua visita pelo link na bio ou direct.
Código de referência: ${p.code}

#imoveis #imoveisdeluxo #${p.neighborhood.toLowerCase().replace(/\s+/g, "")} #apartamentodeluxo #${p.type} #imobiliaria #${wl.orgName.toLowerCase().replace(/\s+/g, "")}`;

  const classificadosCopy = rural
    ? `[${p.code}] ${TYPE_LABELS[p.type]} ${formatAlq(ra.total)} alqueires em ${p.city}/${p.state}

VALOR: ${formatBRL(p.price)}${perAlq ? ` (${formatBRL(perAlq)} por alqueire)` : ""}

ÁREAS:
- Total: ${formatAlq(ra.total)} alq (${formatHa(ra.total)} ha)
- Aberta: ${formatAlq(ra.aberta)} alq
- Plantada: ${formatAlq(ra.plantada)} alq
- Pastagem: ${formatAlq(ra.pastagem)} alq
- Reserva legal: ${formatAlq(ra.reserva)} alq (${formatPct(ra.reservaPct)})
${r.aptidao ? `- Aptidão: ${APTIDAO_LABELS[r.aptidao]}\n` : ""}${r.culturas ? `- Culturas: ${r.culturas}\n` : ""}${r.agua.length ? `- Água: ${r.agua.join(", ")}\n` : ""}${r.benfeitorias.length ? `- Benfeitorias: ${r.benfeitorias.join(", ")}\n` : ""}
DESCRIÇÃO:
${p.description || "Consulte mais informações."}

CONTATO:
${wl.orgName}${wl.phone ? `\nWhatsApp: +${wl.phone}` : ""}
Ref: ${p.code}
Link: ${propertyUrl}${r.kmzUrl ? `\nMapa (KMZ): ${mapaUrl}` : ""}`
    : `[${p.code}] ${TYPE_LABELS[p.type] || "Imóvel"} com ${formatNumber(p.area)}m², ${p.bedrooms} quartos em ${p.neighborhood} - ${p.city}

VALOR: ${formatBRL(p.price)}${p.purpose === "aluguel" ? "/mês" : ""}
${p.condoFee ? `Condomínio: ${formatBRL(p.condoFee)} | ` : ""}${p.iptu ? `IPTU: ${formatBRL(p.iptu)}/ano` : ""}

CARACTERÍSTICAS:
- Área: ${formatNumber(p.area)} m²
- Quartos: ${p.bedrooms} (Suítes: ${p.suites})
- Banheiros: ${p.bathrooms}
- Vagas: ${p.garage}
${p.street ? `- Endereço aproximado: ${p.street}, ${p.neighborhood}\n` : ""}
DESCRIÇÃO:
${p.description || "Excelente oportunidade em localização privilegiada."}

COMODIDADES:
${p.features.join(", ") || "Consulte os itens disponíveis."}

CONTATO & VISITAS:
${wl.orgName}
WhatsApp: +${wl.phone}
Ref: ${p.code}
Link completo: ${propertyUrl}`;

  async function copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success("Texto copiado para a área de transferência!");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-[#F47525]/35 bg-[#F47525]/10 text-[#B84A12] hover:bg-[#F47525]/15 dark:text-[#F8975A]"
      >
        <Megaphone className="size-3.5" />
        Gerar Anúncio &amp; Kit
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Kit de Divulgação · ${p.code}`}
        wide
      >
        <div className="space-y-5">
          <p className="text-xs leading-relaxed text-subtle">
            Textos prontos, links e exportação automática para publicar este
            imóvel em redes sociais, mensagens diretas e portais imobiliários.
          </p>

          {/* Abas */}
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-hairline pb-2">
            {[
              { id: "whatsapp", label: "WhatsApp & Mensagens", icon: MessageCircle },
              { id: "instagram", label: "Instagram & Redes", icon: Camera },
              { id: "classificados", label: "Texto para Classificados", icon: Share2 },
              { id: "portais", label: "Portais & Feed XML", icon: FileCode2 },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                  tab === t.id
                    ? "border-transparent bg-ink text-canvas"
                    : "border-hairline text-subtle hover:border-hairline-strong hover:text-ink"
                }`}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* ─────── ABA: WHATSAPP ─────── */}
          {tab === "whatsapp" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">
                  Texto pronto para WhatsApp
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyText(whatsappCopy, "wa")}
                  >
                    {copied === "wa" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    {copied === "wa" ? "Copiado!" : "Copiar texto"}
                  </Button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(whatsappCopy)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="sm" variant="accent">
                      <MessageCircle className="size-3.5" />
                      Abrir no WhatsApp
                    </Button>
                  </a>
                </div>
              </div>
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-hairline bg-soft/70 p-4 font-mono text-xs leading-relaxed text-ink">
                {whatsappCopy}
              </pre>
            </div>
          )}

          {/* ─────── ABA: INSTAGRAM ─────── */}
          {tab === "instagram" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">
                  Legenda com hashtags e estrutura
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => copyText(instagramCopy, "ig")}
                >
                  {copied === "ig" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  {copied === "ig" ? "Copiado!" : "Copiar legenda"}
                </Button>
              </div>
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-hairline bg-soft/70 p-4 font-mono text-xs leading-relaxed text-ink">
                {instagramCopy}
              </pre>
            </div>
          )}

          {/* ─────── ABA: CLASSIFICADOS ─────── */}
          {tab === "classificados" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">
                  Texto descritivo estruturado
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => copyText(classificadosCopy, "class")}
                >
                  {copied === "class" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  {copied === "class" ? "Copiado!" : "Copiar anúncio"}
                </Button>
              </div>
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-hairline bg-soft/70 p-4 font-mono text-xs leading-relaxed text-ink">
                {classificadosCopy}
              </pre>
            </div>
          )}

          {/* ─────── ABA: PORTAIS & XML ─────── */}
          {tab === "portais" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Sparkles className="size-4" />
                  Como funciona a exportação para Portais (ZAP, OLX, VivaReal)
                </p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">
                  No mercado imobiliário, os portais leem o <strong>Feed XML</strong> da sua imobiliária
                  automaticamente a cada poucas horas. Quando o imóvel está marcado como{" "}
                  <span className="text-ink font-medium">&quot;Publicado no site&quot;</span> ({p.published ? "Ativo" : "Inativo"}),
                  ele entra imediatamente no feed e o portal cria/atualiza o anúncio sozinho.
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-subtle">
                  URL do Feed XML da sua imobiliária:
                </p>
                <div className="flex items-center gap-2 rounded-xl bg-soft px-3.5 py-2.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-subtle">
                    {xmlFeedUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyText(xmlFeedUrl, "feed")}
                  >
                    {copied === "feed" ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    Copiar URL
                  </Button>
                  <a href="/api/feed.xml" target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="size-3" />
                      Ver XML
                    </Button>
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-hairline bg-card p-4 space-y-2">
                <p className="text-xs font-medium">Status deste imóvel no Feed:</p>
                <div className="flex items-center justify-between text-xs text-subtle">
                  <span>Incluso no Feed XML:</span>
                  <span className={p.published ? "text-emerald-500 font-medium" : "text-amber-500 font-medium"}>
                    {p.published ? "Sim (Publicado)" : "Não (Oculto da vitrine)"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-subtle">
                  <span>Fotos exportadas:</span>
                  <span className="font-mono">{p.images.length} fotos em alta resolução</span>
                </div>
                <div className="flex items-center justify-between text-xs text-subtle">
                  <span>Preço exportado:</span>
                  <span className="font-mono">{formatBRL(p.price)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Links Rápidos no Rodapé do Modal */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4 text-xs">
            <div className="flex gap-2">
              <a href={`/imoveis/${p.code}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="size-3.5" />
                  Abrir no site público
                </Button>
              </a>
              <a href={`/imoveis/${p.code}/ficha`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <FileDown className="size-3.5" />
                  Ficha PDF
                </Button>
              </a>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
