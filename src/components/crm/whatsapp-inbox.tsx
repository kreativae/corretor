"use client";

import { Button, Input, Textarea } from "@/components/ui";
import type { WaMessage } from "@/db/schema";
import { cn, formatPhone, initials } from "@/lib/utils";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Settings,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Thread = {
  phone: string;
  contactId: string | null;
  contactName: string | null;
  contactType: string | null;
  profileName: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  lastInboundAt: string | null;
  unread: number;
  archived: boolean;
};

const DAY = 24 * 3600_000;

const national = (p: string) => (p.startsWith("55") && p.length >= 12 ? p.slice(2) : p);
const nameOf = (t: Thread) => t.contactName || t.profileName || formatPhone(national(t.phone));

function when(d: string) {
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function WhatsAppInbox({
  ready,
  isAdmin,
  initialPhone,
  hasTemplate,
}: {
  ready: boolean;
  isAdmin: boolean;
  initialPhone?: string;
  hasTemplate: boolean;
}) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [archived, setArchived] = useState(false);
  const [active, setActive] = useState<string | null>(initialPhone ?? null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [linking, setLinking] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch(`/api/whatsapp/threads${archived ? "?arquivadas=1" : ""}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setThreads(await res.json());
  }, [archived]);

  const loadMessages = useCallback(async (phone: string, quiet = false) => {
    if (!quiet) setLoadingMsgs(true);
    const res = await fetch(`/api/whatsapp/threads/${phone}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      const data: WaMessage[] = await res.json();
      setMessages((cur) => (cur.length === data.length && cur.at(-1)?.status === data.at(-1)?.status ? cur : data));
    }
    if (!quiet) setLoadingMsgs(false);
  }, []);

  // Atualiza a lista a cada 8 s e a conversa aberta a cada 4 s
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const first = window.setTimeout(loadThreads, 0);
    const t = window.setInterval(() => {
      loadThreads();
      setNow(Date.now());
    }, 8000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [loadThreads]);

  useEffect(() => {
    if (!active) return;
    const first = window.setTimeout(() => loadMessages(active), 0);
    const t = window.setInterval(() => loadMessages(active, true), 4000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [active, loadMessages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, active]);

  const filtered = useMemo(() => {
    const w = norm(q.trim());
    const list = threads ?? [];
    return w ? list.filter((t) => norm(`${nameOf(t)} ${t.phone} ${t.lastMessage ?? ""}`).includes(w)) : list;
  }, [threads, q]);

  const thread = threads?.find((t) => t.phone === active) ?? null;
  const windowOpen = !!thread?.lastInboundAt && now - new Date(thread.lastInboundAt).getTime() < DAY;
  const windowUntil = thread?.lastInboundAt ? new Date(new Date(thread.lastInboundAt).getTime() + DAY) : null;

  async function send(template = false) {
    if (!active || sending || (!template && !text.trim())) return;
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: active, text, template }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha no envio.");
      if (!template) setText("");
      setMessages((cur) => [...cur, data]);
      loadThreads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setSending(false);
    }
  }

  async function makeLead() {
    if (!active) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/whatsapp/threads/${active}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lead" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success("Contato vinculado à conversa.");
      loadThreads();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível criar o lead.");
    } finally {
      setLinking(false);
    }
  }

  async function toggleArchive() {
    if (!active || !thread) return;
    await fetch(`/api/whatsapp/threads/${active}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !thread.archived }),
    });
    toast.success(thread.archived ? "Conversa reaberta." : "Conversa arquivada.");
    setActive(null);
    loadThreads();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">Atendimento</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="mt-1 text-sm text-subtle">
            Conversas do número da imobiliária. Número novo vira lead automaticamente.
          </p>
        </div>
        {isAdmin && (
          <Link href="/admin/configuracoes#whatsapp">
            <Button variant="outline" size="sm">
              <Settings className="size-4" />
              Configurar
            </Button>
          </Link>
        )}
      </div>

      {!ready && (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          O WhatsApp ainda não está conectado.{" "}
          {isAdmin ? (
            <Link href="/admin/configuracoes#whatsapp" className="font-medium underline underline-offset-2">
              Configure em Configurações › WhatsApp
            </Link>
          ) : (
            "Peça a um administrador para configurar em Configurações › WhatsApp."
          )}
        </div>
      )}

      <div className="mt-6 grid h-[calc(100dvh-230px)] min-h-[520px] overflow-hidden rounded-2xl border border-hairline bg-card md:grid-cols-[340px_1fr]">
        {/* Lista */}
        <aside className={cn("flex min-h-0 flex-col border-hairline md:border-r", active && "max-md:hidden")}>
          <div className="space-y-2 border-b border-hairline p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversa…" className="h-10 pl-9" />
            </div>
            <div className="flex gap-1 text-xs">
              {[
                [false, "Conversas"],
                [true, "Arquivadas"],
              ].map(([v, l]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => {
                    setArchived(v as boolean);
                    setThreads(null);
                  }}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 font-medium transition-colors",
                    archived === v ? "bg-ink text-canvas" : "text-subtle hover:bg-soft",
                  )}
                >
                  {l as string}
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
            {threads === null && (
              <li className="flex justify-center py-10 text-subtle">
                <Loader2 className="size-5 animate-spin" />
              </li>
            )}
            {threads && filtered.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-subtle">
                {threads.length ? "Nada encontrado." : archived ? "Nenhuma conversa arquivada." : "As conversas aparecem aqui assim que alguém mandar mensagem."}
              </li>
            )}
            {filtered.map((t) => (
              <li key={t.phone}>
                <button
                  type="button"
                  onClick={() => setActive(t.phone)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-hairline px-3 py-3 text-left transition-colors",
                    active === t.phone ? "bg-soft" : "hover:bg-soft/60",
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {initials(nameOf(t))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{nameOf(t)}</span>
                      <span className="ml-auto shrink-0 font-mono text-[10.5px] text-subtle">{when(t.lastMessageAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className={cn("truncate text-xs", t.unread ? "text-ink" : "text-subtle")}>{t.lastMessage}</span>
                      {t.unread > 0 && (
                        <span className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-emerald-500 px-1.5 font-mono text-[10px] font-semibold text-white">
                          {t.unread}
                        </span>
                      )}
                    </span>
                    {!t.contactId && <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-1.5 text-[10px] text-amber-700 dark:text-amber-300">sem contato</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Conversa */}
        <section className={cn("flex min-h-0 flex-col", !active && "max-md:hidden")}>
          {!thread ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-subtle">
              <div>
                <MessageCircle className="mx-auto size-8 opacity-40" />
                <p className="mt-3">Selecione uma conversa.</p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-hairline px-3 py-2.5 sm:px-4">
                <button type="button" onClick={() => setActive(null)} className="grid size-8 place-items-center rounded-full hover:bg-soft md:hidden" aria-label="Voltar">
                  <ArrowLeft className="size-4" />
                </button>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/15 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {initials(nameOf(thread))}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{nameOf(thread)}</p>
                  <p className="truncate font-mono text-[11px] text-subtle">{formatPhone(national(thread.phone))}</p>
                </div>
                {thread.contactId ? (
                  <Link href={`/crm/contatos/${thread.contactId}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="size-3.5" />
                      <span className="hidden sm:inline">Ver contato</span>
                    </Button>
                  </Link>
                ) : (
                  <Button variant="accent" size="sm" onClick={makeLead} loading={linking}>
                    <UserPlus className="size-3.5" />
                    <span className="hidden sm:inline">Criar lead</span>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={toggleArchive} aria-label={thread.archived ? "Desarquivar" : "Arquivar"} title={thread.archived ? "Desarquivar" : "Arquivar"}>
                  {thread.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                </Button>
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-soft/40 px-3 py-4 sm:px-6" data-lenis-prevent>
                {loadingMsgs && messages.length === 0 && (
                  <div className="flex justify-center py-10 text-subtle">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                )}
                {messages.map((m, i) => {
                  const out = m.direction === "out";
                  const day = new Date(m.createdAt).toDateString();
                  const showDay = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== day;
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <p className="my-3 text-center font-mono text-[10.5px] uppercase tracking-wider text-subtle">
                          {new Date(m.createdAt).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                        </p>
                      )}
                      <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                            out ? "rounded-br-md bg-emerald-600 text-white" : "rounded-bl-md bg-card",
                          )}
                        >
                          {m.mediaId && m.type === "image" && (
                            <a href={`/api/whatsapp/media/${m.mediaId}`} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/api/whatsapp/media/${m.mediaId}`} alt="" className="mb-1.5 max-h-72 rounded-lg object-cover" loading="lazy" />
                            </a>
                          )}
                          {m.mediaId && (m.type === "audio" || m.type === "voice") && (
                            <audio controls src={`/api/whatsapp/media/${m.mediaId}`} className="mb-1 h-10 max-w-full" />
                          )}
                          {m.mediaId && (m.type === "document" || m.type === "video") && (
                            <a href={`/api/whatsapp/media/${m.mediaId}`} target="_blank" rel="noreferrer" className="mb-1 block underline underline-offset-2">
                              Abrir arquivo
                            </a>
                          )}
                          {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                          <p className={cn("mt-1 flex items-center justify-end gap-1 font-mono text-[10px]", out ? "text-white/70" : "text-subtle")}>
                            {out && m.sentBy && <span className="mr-1 truncate">{m.sentBy.split(" ")[0]}</span>}
                            {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            {out &&
                              (m.status === "read" ? (
                                <CheckCheck className="size-3.5 text-sky-200" />
                              ) : m.status === "delivered" ? (
                                <CheckCheck className="size-3.5" />
                              ) : m.status === "failed" ? (
                                <X className="size-3.5 text-red-200" />
                              ) : (
                                <Check className="size-3.5" />
                              ))}
                          </p>
                          {m.status === "failed" && m.error && <p className="mt-1 text-[11px] text-red-100">{m.error}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>

              <footer className="border-t border-hairline p-3">
                {windowOpen ? (
                  <>
                    <div className="flex items-end gap-2">
                      <Textarea
                        rows={1}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        placeholder="Escreva uma mensagem…"
                        title="Enter envia · Shift+Enter quebra linha"
                        className="max-h-40 min-h-11 flex-1 resize-none"
                        disabled={!ready}
                      />
                      <Button variant="accent" onClick={() => send()} disabled={!ready || sending || !text.trim()} className="h-11">
                        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      </Button>
                    </div>
                    {windowUntil && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-subtle">
                        <Clock className="size-3" />
                        Pode responder livremente até {windowUntil.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-soft px-4 py-3 text-xs text-subtle">
                    <p className="max-w-md">
                      Passaram mais de 24 h desde a última mensagem do cliente. Pela regra do WhatsApp, só dá para
                      reabrir a conversa com um modelo aprovado.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => send(true)} disabled={!ready || !hasTemplate || sending}>
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      {hasTemplate ? "Enviar modelo" : "Sem modelo configurado"}
                    </Button>
                  </div>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
