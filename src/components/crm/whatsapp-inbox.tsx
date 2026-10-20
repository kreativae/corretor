"use client";

import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import type { WaMessage } from "@/db/schema";
import { cn, formatPhone, initials } from "@/lib/utils";
import { WhatsAppConnection, type ConnState } from "@/components/crm/whatsapp-connection";
import { WhatsAppInsights } from "@/components/crm/whatsapp-insights";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
/** Mesmo prazo do servidor para "apagar para todos" (src/lib/whatsapp.ts) */
const REVOKE_WINDOW_MS = 48 * 3600_000;

/** "às 14:32" hoje, "ontem às 14:32" ou "12/10 às 14:32" */
function stamp(d: string | Date) {
  const date = new Date(d);
  const hm = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return `às ${hm}`;
  if (date.toDateString() === yesterday.toDateString()) return `ontem às ${hm}`;
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hm}`;
}

/** Dados da mensagem, como no app: enviada, entregue e lida */
function MessageInfo({ m }: { m: WaMessage }) {
  const rows: [string, string | Date | null, ReactNode][] = [
    ["Lida", m.readAt ?? null, <CheckCheck key="r" className="size-3.5 text-sky-500" />],
    ["Entregue", m.deliveredAt ?? null, <CheckCheck key="d" className="size-3.5" />],
    ["Enviada", m.createdAt, <Check key="s" className="size-3.5" />],
  ];
  return (
    <div className="ml-auto mt-1.5 w-fit min-w-52 rounded-xl border border-hairline bg-card px-3 py-2 text-[11px] shadow-sm">
      {rows.map(([label, at, icon]) => (
        <p key={label} className="flex items-center gap-2 py-0.5">
          <span className="text-subtle">{icon}</span>
          <span className="font-medium">{label}</span>
          <span className="ml-auto pl-4 font-mono text-subtle">
            {at ? stamp(at) : label === "Lida" && m.status === "read" ? "—" : "aguardando"}
          </span>
        </p>
      ))}
      {m.sentBy && <p className="mt-1 border-t border-hairline pt-1 text-subtle">Enviada por {m.sentBy}</p>}
    </div>
  );
}

/**
 * Foto, áudio ou arquivo recebido: nada é baixado nem guardado no servidor até
 * a pessoa tocar (o arquivo fica no WhatsApp e é buscado na hora).
 */
function MediaAttachment({ m, out }: { m: WaMessage; out: boolean }) {
  const [show, setShow] = useState(false);
  const src = `/api/whatsapp/media/${m.mediaId}`;
  const chip = cn(
    "mb-1.5 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
    out ? "bg-white/15 hover:bg-white/25" : "bg-soft hover:bg-hairline",
  );
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (m.type === "image" || m.type === "sticker") {
    return show ? (
      <a href={src} target="_blank" rel="noreferrer" onClick={stop}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="mb-1.5 max-h-72 rounded-lg object-cover" />
      </a>
    ) : (
      <button type="button" className={chip} onClick={(e) => (stop(e), setShow(true))}>
        <ImageIcon className="size-4" /> {m.type === "sticker" ? "Ver figurinha" : "Ver foto"}
      </button>
    );
  }
  if (m.type === "audio" || m.type === "voice") {
    return show ? (
      <audio controls autoPlay src={src} className="mb-1 h-10 max-w-full" onClick={stop} />
    ) : (
      <button type="button" className={chip} onClick={(e) => (stop(e), setShow(true))}>
        <Mic className="size-4" /> Ouvir áudio
      </button>
    );
  }
  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5">
      <a href={src} target="_blank" rel="noreferrer" className={chip} onClick={stop}>
        <FileText className="size-4" /> Abrir
      </a>
      <a href={`${src}?download=1`} download className={chip} onClick={stop}>
        <Download className="size-4" /> Baixar
      </a>
    </div>
  );
}

const nameOf = (t: Thread) => t.contactName || t.profileName || formatPhone(`+${t.phone}`);

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
  provider = "meta",
  userName = "",
  ownNumber = false,
}: {
  ready: boolean;
  isAdmin: boolean;
  initialPhone?: string;
  hasTemplate: boolean;
  /** evolution = QR code (sem janela de 24 h, envia arquivos) */
  provider?: "evolution" | "meta";
  /** Quem está logado: apaga as próprias mensagens; o administrador, qualquer uma */
  userName?: string;
  /** Cada usuário com o próprio número (QR code): vê e gerencia só as conversas dele */
  ownNumber?: boolean;
}) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [archived, setArchived] = useState(false);
  const [active, setActive] = useState<string | null>(initialPhone ?? null);
  // Mensagem enviada com os dados abertos (enviada / entregue / lida)
  const [infoId, setInfoId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<WaMessage | null>(null);
  const [confirmThread, setConfirmThread] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);
  const [deleting, setDeleting] = useState<"all" | "me" | null>(null);
  const canDelete = (m: WaMessage) =>
    m.type !== "deleted" && (ownNumber || isAdmin || (m.direction === "out" && !!m.sentBy && m.sentBy === userName));
  const canDeleteThread = ownNumber || isAdmin;
  const canRevoke = (m: WaMessage) =>
    provider === "evolution" &&
    m.direction === "out" &&
    !!m.waMessageId &&
    m.type !== "deleted" &&
    m.status !== "failed" &&
    now - new Date(m.createdAt).getTime() < REVOKE_WINDOW_MS;

  async function removeMessage(scope: "all" | "me") {
    if (!toDelete) return;
    setDeleting(scope);
    try {
      const res = await fetch(`/api/whatsapp/messages/${toDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao apagar.");
      const id = toDelete.id;
      setMessages((cur) =>
        data.deleted ? cur.filter((x) => x.id !== id) : cur.map((x) => (x.id === id && data.message ? data.message : x)),
      );
      toast.success(scope === "all" ? "Mensagem apagada para todos." : "Mensagem apagada do CRM.");
      setToDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao apagar.");
    } finally {
      setDeleting(null);
    }
  }
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const lastOutId = useMemo(() => [...messages].reverse().find((m) => m.direction === "out")?.id ?? null, [messages]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [linking, setLinking] = useState<"lead" | "contato" | null>(null);
  // Resumo e smart match: fixo na tela grande; nas menores, abre por cima da conversa
  const [insightsOpen, setInsightsOpen] = useState(false);
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
      // Só troca a lista se algo mudou (inclui status de mensagens antigas: entregue, lida)
      const sig = (list: WaMessage[]) => list.map((m) => `${m.id}:${m.status}:${m.type}`).join("|");
      setMessages((cur) => (sig(cur) === sig(data) ? cur : data));
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
  const qrMode = provider === "evolution";
  const windowOpen = qrMode || (!!thread?.lastInboundAt && now - new Date(thread.lastInboundAt).getTime() < DAY);
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

  const fileInput = useRef<HTMLInputElement>(null);
  async function sendFile(file: File) {
    if (!active) return;
    if (file.size > 4 * 1024 * 1024) return toast.error("Arquivo acima de 4 MB.");
    setSending(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("phone", active);
      if (text.trim()) body.append("caption", text.trim());
      const res = await fetch("/api/whatsapp/send-file", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha no envio.");
      setText("");
      setMessages((cur) => [...cur, data]);
      loadThreads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setSending(false);
    }
  }

  /* Conexão por QR code: avisa se o celular desconectou */
  const [connState, setConnState] = useState<string | null>(null);
  useEffect(() => {
    if (!qrMode || !ready) return;
    const check = () =>
      fetch("/api/whatsapp/evolution/status", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setConnState(d.state))
        .catch(() => undefined);
    const first = window.setTimeout(check, 0);
    const t = window.setInterval(check, 30000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [qrMode, ready]);
  const onConnState = useCallback((s: ConnState) => setConnState(s.state), []);

  // Antes de salvar no CRM, pede o nome (muitos números chegam sem nome)
  const [saveAs, setSaveAs] = useState<{ action: "lead" | "contato"; name: string; email: string } | null>(null);

  function askSave(action: "lead" | "contato") {
    if (!thread) return;
    setSaveAs({ action, name: thread.profileName?.trim() ?? "", email: "" });
  }

  async function makeLead() {
    if (!active || !saveAs) return;
    const { action, name, email } = saveAs;
    if (!name.trim()) {
      toast.error("Informe o nome do contato.");
      return;
    }
    setLinking(action);
    try {
      const res = await fetch(`/api/whatsapp/threads/${active}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, name: name.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(action === "lead" ? "Lead criado no CRM." : "Contato salvo no CRM.");
      setSaveAs(null);
      loadThreads();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível salvar no CRM.");
    } finally {
      setLinking(null);
    }
  }

  async function deleteThread() {
    if (!active) return;
    setDeletingThread(true);
    try {
      const res = await fetch(`/api/whatsapp/threads/${active}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao apagar a conversa.");
      toast.success("Conversa apagada do CRM.");
      setConfirmThread(false);
      setActive(null);
      setMessages([]);
      loadThreads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao apagar a conversa.");
    } finally {
      setDeletingThread(false);
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
            {ownNumber ? "Conversas do seu número." : "Conversas do número da imobiliária."} Números novos só entram no CRM quando você
            clica em Criar lead ou Salvar contato.
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

      {ready && qrMode && connState && connState !== "open" && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-subtle">
            {connState === "missing"
              ? "Conecte o seu WhatsApp para atender por aqui. Só você vê as conversas do seu número."
              : "O seu WhatsApp está desconectado do CRM — as mensagens novas não estão chegando. Leia o QR code de novo."}
          </p>
          <WhatsAppConnection whose="do seu número" onState={onConnState} />
        </div>
      )}

      <div
        className={cn(
          "relative mt-6 grid h-[calc(100dvh-230px)] min-h-[520px] grid-cols-1 overflow-hidden rounded-2xl border border-hairline bg-card md:grid-cols-[340px_1fr]",
          thread && "xl:grid-cols-[300px_1fr_320px] 2xl:grid-cols-[340px_1fr_360px]",
        )}
      >
        {/* Lista */}
        <aside className={cn("flex min-h-0 min-w-0 flex-col border-hairline md:border-r", active && "max-md:hidden")}>
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
        <section className={cn("flex min-h-0 min-w-0 flex-col", !active && "max-md:hidden")}>
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
                  <p className="truncate font-mono text-[11px] text-subtle">{formatPhone(`+${thread.phone}`)}</p>
                </div>
                {thread.contactId ? (
                  <Link href={`/crm/contatos/${thread.contactId}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="size-3.5" />
                      <span className="hidden sm:inline">Ver contato</span>
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => askSave("contato")} disabled={!!linking} title="Salvar nos contatos, sem virar lead">
                      <UserRound className="size-3.5" />
                      <span className="hidden sm:inline">Salvar contato</span>
                    </Button>
                    <Button variant="accent" size="sm" onClick={() => askSave("lead")} disabled={!!linking}>
                      <UserPlus className="size-3.5" />
                      <span className="hidden sm:inline">Criar lead</span>
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="xl:hidden"
                  onClick={() => setInsightsOpen((v) => !v)}
                  aria-label="Resumo e smart match"
                  title="Resumo e smart match"
                >
                  <Sparkles className="size-4 text-accent" />
                </Button>
                <Button variant="ghost" size="sm" onClick={toggleArchive} aria-label={thread.archived ? "Desarquivar" : "Arquivar"} title={thread.archived ? "Desarquivar" : "Arquivar"}>
                  {thread.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                </Button>
                {canDeleteThread && (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmThread(true)} aria-label="Apagar conversa" title="Apagar conversa">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-soft/40 px-3 py-4 sm:px-6" data-lenis-prevent>
                {loadingMsgs && messages.length === 0 && (
                  <div className="flex justify-center py-10 text-subtle">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                )}
                {messages.map((m, i) => {
                  const out = m.direction === "out";
                  const isLastOut = out && m.id === lastOutId;
                  const day = new Date(m.createdAt).toDateString();
                  const showDay = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== day;
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <p className="my-3 text-center font-mono text-[10.5px] uppercase tracking-wider text-subtle">
                          {new Date(m.createdAt).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                        </p>
                      )}
                      <div className={cn("group flex items-center gap-1.5", out ? "justify-end" : "justify-start")}>
                        {out && canDelete(m) && (
                          <button
                            type="button"
                            onClick={() => setToDelete(m)}
                            aria-label="Apagar mensagem"
                            title="Apagar mensagem"
                            className="rounded-full p-1.5 text-subtle opacity-60 transition hover:bg-hairline hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                        <div
                          onClick={out ? () => setInfoId((v) => (v === m.id ? null : m.id)) : undefined}
                          title={out ? "Ver dados da mensagem" : undefined}
                          className={cn(
                            "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                            out ? "cursor-pointer rounded-br-md bg-emerald-600 text-white" : "rounded-bl-md bg-card",
                            m.type === "deleted" && "italic opacity-70",
                          )}
                        >
                          {m.mediaId && <MediaAttachment m={m} out={out} />}
                          {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                          <p className={cn("mt-1 flex items-center justify-end gap-1 font-mono text-[10px]", out ? "text-white/70" : "text-subtle")}>
                            {out && m.sentBy && <span className="mr-1 truncate">{m.sentBy.split(" ")[0]}</span>}
                            {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            {out &&
                              (m.status === "read" ? (
                                <CheckCheck className="size-3.5 text-sky-300" aria-label="Lida" />
                              ) : m.status === "delivered" ? (
                                <CheckCheck className="size-3.5" aria-label="Entregue" />
                              ) : m.status === "failed" ? (
                                <X className="size-3.5 text-red-200" />
                              ) : (
                                <Check className="size-3.5" aria-label="Enviada" />
                              ))}
                          </p>
                          {m.status === "failed" && m.error && <p className="mt-1 text-[11px] text-red-100">{m.error}</p>}
                        </div>
                        {!out && canDelete(m) && (
                          <button
                            type="button"
                            onClick={() => setToDelete(m)}
                            aria-label="Apagar mensagem"
                            title="Apagar mensagem"
                            className="rounded-full p-1.5 text-subtle opacity-60 transition hover:bg-hairline hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                      {out && infoId === m.id ? (
                        <MessageInfo m={m} />
                      ) : (
                        isLastOut &&
                        m.status !== "failed" && (
                          <p className="mt-1 text-right text-[10.5px] text-subtle">
                            {m.status === "read" && m.readAt
                              ? `Lida ${stamp(m.readAt)}`
                              : m.status === "read"
                                ? "Lida"
                                : m.status === "delivered"
                                  ? `Entregue${m.deliveredAt ? ` ${stamp(m.deliveredAt)}` : ""}`
                                  : "Enviada"}
                          </p>
                        )
                      )}
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
                      {qrMode && (
                        <>
                          <input
                            ref={fileInput}
                            type="file"
                            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (f) sendFile(f);
                            }}
                          />
                          <Button
                            variant="outline"
                            onClick={() => fileInput.current?.click()}
                            disabled={!ready || sending}
                            className="h-11"
                            aria-label="Enviar foto ou arquivo"
                            title="Enviar foto ou arquivo (até 4 MB)"
                          >
                            <Paperclip className="size-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="accent" onClick={() => send()} disabled={!ready || sending || !text.trim()} className="h-11">
                        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      </Button>
                    </div>
                    {!qrMode && windowUntil && (
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

        {thread && (
          <WhatsAppInsights
            phone={thread.phone}
            version={messages.length}
            open={insightsOpen}
            onClose={() => setInsightsOpen(false)}
            onSent={() => {
              loadMessages(thread.phone, true);
              loadThreads();
            }}
          />
        )}
      </div>

      <Modal open={confirmThread} onClose={() => !deletingThread && setConfirmThread(false)} title="Apagar conversa">
        <div className="space-y-4">
          <p className="text-sm text-subtle">
            Apaga do CRM todas as mensagens desta conversa{thread ? ` com ${thread.contactName || thread.profileName || formatPhone(`+${thread.phone}`)}` : ""}.
            No WhatsApp do contato nada muda: o WhatsApp não permite apagar a conversa do outro lado. O contato no CRM
            (se houver) continua salvo. Não dá para desfazer.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setConfirmThread(false)} disabled={deletingThread}>
              Cancelar
            </Button>
            <Button type="button" variant="accent" onClick={deleteThread} loading={deletingThread}>
              <Trash2 className="size-4" />
              Apagar conversa
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!toDelete} onClose={() => !deleting && setToDelete(null)} title="Apagar mensagem">
        {toDelete && (
          <div className="space-y-4">
            <p className="line-clamp-3 rounded-xl border border-hairline bg-card px-3 py-2 text-sm text-subtle">
              {toDelete.body || "Mensagem sem texto"}
            </p>
            <p className="text-sm text-subtle">
              {canRevoke(toDelete)
                ? "\"Apagar para todos\" remove também do WhatsApp do contato, que vê o aviso de mensagem apagada. \"Só no CRM\" tira apenas daqui."
                : toDelete.direction === "out" && provider === "evolution" && toDelete.status !== "failed"
                  ? "Passou o prazo do WhatsApp (cerca de 2 dias) para apagar para todos. Dá para tirar só do CRM; o contato continua vendo."
                  : toDelete.direction === "out" && provider !== "evolution"
                    ? "A API oficial do WhatsApp não permite apagar para todos. Dá para tirar só do CRM; o contato continua vendo."
                    : "Mensagens recebidas só podem ser tiradas do CRM; no WhatsApp do contato elas continuam."}
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setToDelete(null)} disabled={!!deleting}>
                Cancelar
              </Button>
              <Button type="button" variant="outline" onClick={() => removeMessage("me")} loading={deleting === "me"} disabled={!!deleting}>
                Apagar só no CRM
              </Button>
              {canRevoke(toDelete) && (
                <Button type="button" variant="accent" onClick={() => removeMessage("all")} loading={deleting === "all"} disabled={!!deleting}>
                  <Trash2 className="size-4" />
                  Apagar para todos
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!saveAs} onClose={() => !linking && setSaveAs(null)} title={saveAs?.action === "lead" ? "Criar lead" : "Salvar contato"}>
        {saveAs && thread && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              makeLead();
            }}
            className="space-y-4"
          >
            <Field label="Nome">
              <Input
                autoFocus
                value={saveAs.name}
                onChange={(e) => setSaveAs({ ...saveAs, name: e.target.value })}
                placeholder="Ex.: Maria Souza"
                maxLength={120}
              />
            </Field>
            <Field label="WhatsApp">
              <Input value={formatPhone(`+${thread.phone}`)} disabled className="font-mono" />
            </Field>
            <Field label="E-mail (opcional)">
              <Input
                type="email"
                value={saveAs.email}
                onChange={(e) => setSaveAs({ ...saveAs, email: e.target.value })}
                placeholder="maria@email.com"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSaveAs(null)} disabled={!!linking}>
                Cancelar
              </Button>
              <Button type="submit" variant="accent" loading={!!linking}>
                {saveAs.action === "lead" ? <UserPlus className="size-4" /> : <UserRound className="size-4" />}
                {saveAs.action === "lead" ? "Criar lead" : "Salvar contato"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
