"use client";

import { Button } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import {
  Check,
  Clock,
  ExternalLink,
  HelpCircle,
  ImageIcon,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Insights = {
  contact: { id: string; name: string; type: string } | null;
  stats: {
    first: string | null;
    inbound: number;
    outbound: number;
    lastInboundAt: string | null;
    waitingSince: string | null;
  };
  wants: string[];
  fromProfile: string[];
  topics: string[];
  questions: { text: string; at: string }[];
  lastClient: { text: string; at: string } | null;
  cited: { code: string; title: string; href: string; sent: boolean; asked: boolean }[];
  hasCriteria: boolean;
  matches: {
    id: string;
    code: string;
    title: string;
    type: string;
    price: number;
    purpose: string;
    place: string;
    specs: string;
    cover: string | null;
    href: string;
    score: number;
    reasons: string[];
    sent: boolean;
  }[];
};

/** "há 5 min", "há 3 h", "há 2 dias" */
function ago(d: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

const label = "mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle";

/**
 * Lateral da conversa: resumo (o que o cliente procura, assuntos, perguntas) e smart match
 * (imóveis da carteira que batem com o pedido, com envio direto no chat).
 */
export function WhatsAppInsights({
  phone,
  version,
  open,
  pinned = true,
  onClose,
  onSent,
}: {
  phone: string;
  /** Muda quando chegam mensagens: o resumo se atualiza */
  version: number;
  /** Telas menores: painel por cima da conversa */
  open: boolean;
  /** Tela grande: coluna fixa ligada */
  pinned?: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      const res = await fetch(`/api/whatsapp/threads/${phone}/resumo`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setData(await res.json());
      if (!quiet) setLoading(false);
    },
    [phone],
  );

  // Troca de conversa: limpa e carrega; mensagem nova: atualiza sem piscar
  const [shown, setShown] = useState(phone);
  if (shown !== phone) {
    setShown(phone);
    setData(null);
  }
  useEffect(() => {
    const t = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);
  useEffect(() => {
    if (!version) return;
    const t = window.setTimeout(() => load(true), 600);
    return () => window.clearTimeout(t);
  }, [version, load]);

  async function sendProps(ids: string[]) {
    const key = ids.length === 1 ? ids[0] : "all";
    setSending(key);
    try {
      const res = await fetch("/api/negociacao/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toPhone: phone,
          contactId: data?.contact?.id,
          toName: data?.contact?.name,
          subject: "Smart match do WhatsApp",
          intro: false,
          propertyIds: ids,
          photos: true,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Falha no envio.");
      toast.success(ids.length === 1 ? "Imóvel enviado na conversa." : `${ids.length} imóveis enviados na conversa.`);
      onSent();
      load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setSending(null);
    }
  }

  const unsent = data?.matches.filter((m) => !m.sent).slice(0, 4) ?? [];

  return (
    <aside
      className={cn(
        "min-h-0 min-w-0 flex-col border-hairline bg-card xl:border-l",
        open
          ? "flex max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-20 max-xl:w-full max-xl:max-w-sm max-xl:border-l max-xl:shadow-2xl"
          : pinned
            ? "hidden xl:flex"
            : "hidden",
      )}
      aria-label="Resumo e smart match"
    >
      <header className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <Sparkles className="size-4 text-accent" />
        <p className="flex-1 text-sm font-semibold">Resumo e smart match</p>
        <button
          type="button"
          onClick={() => load()}
          className="grid size-8 place-items-center rounded-full text-subtle hover:bg-soft hover:text-ink"
          aria-label="Atualizar"
          title="Atualizar"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-full text-subtle hover:bg-soft hover:text-ink xl:hidden"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm" data-lenis-prevent>
        {!data ? (
          <div className="flex justify-center py-10 text-subtle">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            {/* Situação */}
            <section>
              {data.stats.waitingSince ? (
                <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <Clock className="size-3.5 shrink-0" />
                  Esperando sua resposta {ago(data.stats.waitingSince)}
                </p>
              ) : (
                data.stats.lastInboundAt && (
                  <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <Check className="size-3.5 shrink-0" />
                    Respondido · cliente escreveu {ago(data.stats.lastInboundAt)}
                  </p>
                )
              )}
              <p className="mt-2 font-mono text-[11px] text-subtle">
                {data.stats.inbound} recebidas · {data.stats.outbound} enviadas
                {data.stats.first && ` · desde ${new Date(data.stats.first).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}`}
              </p>
              {data.contact && (
                <p className="mt-1 text-xs text-subtle">
                  {data.contact.type} no CRM ·{" "}
                  <Link href={`/crm/contatos/${data.contact.id}`} className="text-ink underline-offset-2 hover:underline">
                    ver ficha
                  </Link>
                </p>
              )}
            </section>

            {/* O que procura */}
            <section>
              <p className={label}>
                <Tag className="size-3" /> O que procura
              </p>
              {data.wants.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.wants.map((w) => (
                    <span key={w} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                      {w}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-subtle">Ainda não disse. Quando falar (ex.: “terreno de 400 m² até 300 mil”), aparece aqui.</p>
              )}
              {data.fromProfile.length > 0 && (
                <p className="mt-1.5 text-[11px] text-subtle">{data.fromProfile.join(", ")}: do cadastro do contato.</p>
              )}
              {data.topics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.topics.map((t) => (
                    <span key={t} className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-subtle">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Smart match */}
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className={cn(label, "mb-0")}>
                  <Sparkles className="size-3" /> Smart match
                </p>
                {unsent.length > 1 && (
                  <button
                    type="button"
                    onClick={() => sendProps(unsent.map((m) => m.id))}
                    disabled={!!sending}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline disabled:opacity-50"
                  >
                    {sending === "all" ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                    Enviar os {unsent.length} melhores
                  </button>
                )}
              </div>
              {!data.hasCriteria ? (
                <p className="rounded-xl bg-soft px-3 py-4 text-center text-xs text-subtle">
                  Os imóveis aparecem aqui assim que o cliente disser o tipo, a metragem, o valor ou o bairro.
                </p>
              ) : data.matches.length === 0 ? (
                <p className="rounded-xl bg-soft px-3 py-4 text-center text-xs text-subtle">
                  Nenhum imóvel disponível bate com o pedido. Vale captar um assim.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.matches.map((m) => (
                    <li key={m.id} className="rounded-xl border border-hairline p-2.5">
                      <div className="flex gap-2.5">
                        <Link href={m.href} className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-soft">
                          {m.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.cover} alt="" className="size-full object-cover" loading="lazy" />
                          ) : (
                            <ImageIcon className="absolute inset-0 m-auto size-4 text-subtle" />
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 font-mono text-[10.5px] text-subtle">
                            {m.code} · {m.type}
                            <span
                              className={cn(
                                "ml-auto rounded-full px-1.5 py-px font-sans text-[10px] font-semibold",
                                m.score >= 80 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-soft text-subtle",
                              )}
                              title="Quanto bate com o pedido"
                            >
                              {m.score}%
                            </span>
                          </p>
                          <Link href={m.href} className="line-clamp-2 text-xs font-medium leading-snug hover:underline">
                            {m.title}
                          </Link>
                          <p className="truncate text-[11px] text-subtle">{[m.place, m.specs].filter(Boolean).join(" · ")}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold tabular">
                          {formatBRL(m.price)}
                          {m.purpose === "aluguel" && <span className="font-normal text-subtle">/mês</span>}
                        </span>
                        <span className="ml-auto flex items-center gap-1">
                          <Link href={m.href} className="grid size-7 place-items-center rounded-full text-subtle hover:bg-soft hover:text-ink" aria-label="Abrir imóvel">
                            <ExternalLink className="size-3.5" />
                          </Link>
                          <Button
                            size="sm"
                            variant={m.sent ? "outline" : "accent"}
                            className="h-7 px-2.5 text-[11px]"
                            onClick={() => sendProps([m.id])}
                            disabled={!!sending}
                            title="Envia foto, preço e links no chat"
                          >
                            {sending === m.id ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                            {m.sent ? "Reenviar" : "Enviar"}
                          </Button>
                        </span>
                      </div>
                      {m.reasons.length > 0 && (
                        <p className="mt-1.5 flex flex-wrap gap-1">
                          {m.reasons.map((r) => (
                            <span key={r} className="rounded bg-soft px-1.5 py-px text-[10px] text-subtle">
                              ✓ {r}
                            </span>
                          ))}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {data.contact && data.matches.length > 0 && (
                <Link
                  href={`/crm/negociacao?contato=${data.contact.id}&imoveis=${data.matches.slice(0, 6).map((m) => m.id).join(",")}`}
                  className="mt-3 block text-center text-[11px] text-subtle underline-offset-2 hover:text-ink hover:underline"
                >
                  Montar seleção na Negociação
                </Link>
              )}
            </section>
            {/* Perguntas e última mensagem */}
            {(data.questions.length > 0 || data.lastClient) && (
              <section>
                <p className={label}>
                  <HelpCircle className="size-3" /> {data.questions.length ? "Perguntas do cliente" : "Última mensagem"}
                </p>
                <ul className="space-y-1.5">
                  {(data.questions.length ? data.questions : [data.lastClient!]).map((q, i) => (
                    <li key={i} className="rounded-xl bg-soft px-3 py-2 text-xs leading-relaxed">
                      {q.text}
                      <span className="mt-0.5 block font-mono text-[10px] text-subtle">{ago(q.at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Imóveis citados */}
            {data.cited.length > 0 && (
              <section>
                <p className={label}>
                  <MessageCircle className="size-3" /> Imóveis na conversa
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.cited.map((c) => (
                    <Link
                      key={c.code}
                      href={c.href}
                      title={c.title}
                      className="inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 font-mono text-[11px] hover:bg-soft"
                    >
                      {c.code}
                      <span className="font-sans text-[10px] text-subtle">{c.sent ? "enviado" : "perguntou"}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </>
        )}
      </div>
    </aside>
  );
}
