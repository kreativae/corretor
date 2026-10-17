"use client";

import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import { cn, formatDateTime, initials, timeAgo } from "@/lib/utils";
import {
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  PenSquare,
  Reply,
  Search,
  Send,
  Settings,
  Trash2,
  ArrowLeft,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Folder = "entrada" | "enviados" | "geral";

type ListItem = {
  id: string;
  direction: "in" | "out";
  fromAddr: string;
  fromName: string | null;
  toAddrs: string[];
  subject: string;
  preview: string;
  hasAttachments: boolean;
  read: boolean;
  createdAt: string;
};

type FullMessage = Omit<ListItem, "preview" | "hasAttachments"> & {
  ccAddrs: string[];
  text: string | null;
  html: string | null;
  attachments: { id: string; filename: string; size: number; contentType: string }[];
  contactId: string | null;
  sentBy: string | null;
};

type DraftFile = { id: string; filename: string; size: number; contentType: string; access: "public" | "private" };
type Draft = {
  to: string;
  cc: string;
  subject: string;
  text: string;
  replyToId?: string;
  attachments: DraftFile[];
};
const EMPTY_DRAFT: Draft = { to: "", cc: "", subject: "", text: "", attachments: [] };
const FILE_MAX = 10 * 1024 * 1024;

const FOLDERS: { key: Folder; label: string; admin?: boolean }[] = [
  { key: "entrada", label: "Entrada" },
  { key: "enviados", label: "Enviados" },
  { key: "geral", label: "Geral", admin: true },
];

/** HTML recebido isolado: sem scripts, links abrem em nova aba */
function htmlDoc(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><meta http-equiv="Content-Security-Policy" content="script-src 'none'"><style>body{margin:16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#18181b;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function EmailInbox({
  address,
  admin,
  configured,
  initialTo,
}: {
  /** Endereço do usuário (vazio = sem caixa) */
  address: string;
  admin: boolean;
  configured: boolean;
  /** ?para= — abre o editor já com o destinatário */
  initialTo?: string;
}) {
  const [folder, setFolder] = useState<Folder>("entrada");
  const [q, setQ] = useState("");
  const [list, setList] = useState<ListItem[] | null>(null);
  const [unread, setUnread] = useState({ entrada: 0, geral: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msg, setMsg] = useState<FullMessage | null>(null);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(initialTo ? { ...EMPTY_DRAFT, to: initialTo } : null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(0);

  // Lista da pasta (busca com atraso enquanto digita; volta a checar a cada minuto)
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/email/messages?pasta=${folder}&q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d) return;
          setList(d.messages);
          setUnread(d.unread);
        })
        .catch(() => undefined);
    const t = setTimeout(load, q ? 300 : 0);
    const poll = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(poll);
    };
  }, [folder, q, reload]);

  function pickFolder(f: Folder) {
    if (f === folder) return;
    setFolder(f);
    setList(null);
    setActiveId(null);
    setMsg(null);
  }

  async function open(item: ListItem) {
    setActiveId(item.id);
    setMsg(null);
    const res = await fetch(`/api/email/messages/${item.id}`);
    if (!res.ok) {
      toast.error("Não foi possível abrir a mensagem.");
      return;
    }
    setMsg(await res.json());
    if (!item.read) {
      setList((l) => l?.map((m) => (m.id === item.id ? { ...m, read: true } : m)) ?? l);
      setUnread((u) => ({ ...u, [folder]: Math.max(0, (u[folder as "entrada" | "geral"] ?? 0) - 1) }));
    }
  }

  function reply(m: FullMessage) {
    const to = m.direction === "in" ? m.fromAddr : m.toAddrs.join(", ");
    const subject = /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`;
    setDraft({ to, cc: "", subject, text: "", replyToId: m.id, attachments: [] });
  }

  /** Sobe cada arquivo escolhido e junta ao rascunho */
  async function attach(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      if (file.size > FILE_MAX) {
        toast.error(`"${file.name}" passa de 10 MB.`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/email/anexo", { method: "POST", body: form });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setDraft((dr) => (dr ? { ...dr, attachments: [...dr.attachments, d as DraftFile] } : dr));
      } catch (e) {
        toast.error(e instanceof Error && e.message ? e.message : `Falha ao anexar "${file.name}".`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function markUnread(m: FullMessage) {
    await fetch(`/api/email/messages/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: false }),
    });
    setActiveId(null);
    setMsg(null);
    setReload((n) => n + 1);
  }

  async function remove(m: FullMessage) {
    if (!confirm("Excluir esta mensagem? Não dá para desfazer.")) return;
    const res = await fetch(`/api/email/messages/${m.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Não foi possível excluir.");
      return;
    }
    toast.success("Mensagem excluída.");
    setActiveId(null);
    setMsg(null);
    setReload((n) => n + 1);
  }

  async function send() {
    if (!draft) return;
    setSending(true);
    try {
      const res = await fetch("/api/email/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success("E-mail enviado.");
      setDraft(null);
      setReload((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Falha no envio.");
    } finally {
      setSending(false);
    }
  }

  const who = (m: ListItem) =>
    m.direction === "out" ? `Para: ${m.toAddrs.join(", ")}` : m.fromName || m.fromAddr;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">Atendimento</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">E-mail</h1>
          <p className="mt-1 text-sm text-subtle">
            {address ? (
              <>
                Sua caixa: <span className="font-mono text-ink">{address}</span>
              </>
            ) : (
              "Você ainda não tem um endereço de e-mail no sistema."
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {admin && (
            <Link href="/admin/configuracoes">
              <Button variant="outline" size="sm">
                <Settings className="size-4" />
                Configurar
              </Button>
            </Link>
          )}
          <Button
            variant="accent"
            size="sm"
            disabled={!address || !configured}
            onClick={() => setDraft({ ...EMPTY_DRAFT })}
          >
            <PenSquare className="size-4" />
            Escrever
          </Button>
        </div>
      </div>

      {(!configured || !address) && (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          {!configured
            ? "O envio de e-mail ainda não está configurado (Configurações › Avisos de novos leads)."
            : admin
              ? "Defina o seu endereço em Equipe & acessos › Editar cadastro."
              : "Peça a um administrador para definir o seu endereço em Equipe & acessos."}
        </div>
      )}

      <div className="mt-6 grid h-[calc(100dvh-230px)] min-h-[520px] grid-cols-1 overflow-hidden rounded-2xl border border-hairline bg-card md:grid-cols-[360px_1fr]">
        {/* Lista */}
        <aside className={cn("flex min-h-0 min-w-0 flex-col border-hairline md:border-r", activeId && "max-md:hidden")}>
          <div className="space-y-2 border-b border-hairline p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar e-mail…" className="h-10 pl-9" />
            </div>
            <div className="flex gap-1 text-xs">
              {FOLDERS.filter((f) => !f.admin || admin).map((f) => {
                const n = f.key === "enviados" ? 0 : unread[f.key];
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => pickFolder(f.key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-colors",
                      folder === f.key ? "bg-ink text-canvas" : "text-subtle hover:bg-soft",
                    )}
                  >
                    {f.label}
                    {n > 0 && (
                      <span className="grid min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[9.5px] font-semibold text-white">
                        {n}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
            {list === null && (
              <li className="flex justify-center py-10 text-subtle">
                <Loader2 className="size-5 animate-spin" />
              </li>
            )}
            {list && list.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-subtle">
                {q
                  ? "Nada encontrado."
                  : folder === "enviados"
                    ? "Os e-mails que você enviar aparecem aqui."
                    : folder === "geral"
                      ? "E-mails para endereços sem dono (ex.: contato@) aparecem aqui."
                      : "Nenhum e-mail recebido ainda."}
              </li>
            )}
            {list?.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => open(m)}
                  className={cn(
                    "flex w-full gap-3 border-b border-hairline px-3 py-3 text-left transition-colors",
                    activeId === m.id ? "bg-soft" : "hover:bg-soft/60",
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/12 font-mono text-[10px] font-medium text-accent">
                    {initials(m.direction === "out" ? m.toAddrs[0] ?? "?" : m.fromName || m.fromAddr)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", !m.read ? "font-semibold" : "font-medium")}>{who(m)}</span>
                      <span className="ml-auto shrink-0 font-mono text-[10.5px] text-subtle">{timeAgo(m.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {!m.read && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
                      <span className={cn("truncate text-xs", !m.read ? "text-ink" : "text-subtle")}>
                        {m.subject || "(sem assunto)"}
                      </span>
                      {m.hasAttachments && <Paperclip className="ml-auto size-3 shrink-0 text-subtle" />}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-subtle">{m.preview}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Leitura */}
        <section className={cn("flex min-h-0 min-w-0 flex-col", !activeId && "max-md:hidden")}>
          {!activeId ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-subtle">
              <div>
                <Inbox className="mx-auto size-8 opacity-40" />
                <p className="mt-2">Selecione um e-mail para ler.</p>
              </div>
            </div>
          ) : !msg ? (
            <div className="grid flex-1 place-items-center text-subtle">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-3 border-b border-hairline p-4">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(null);
                      setMsg(null);
                    }}
                    className="rounded-full p-1.5 text-subtle hover:bg-soft md:hidden"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <h2 className="min-w-0 flex-1 text-lg font-semibold leading-snug">{msg.subject || "(sem assunto)"}</h2>
                  <div className="flex shrink-0 gap-1">
                    {configured && address && (
                      <Button variant="outline" size="sm" onClick={() => reply(msg)}>
                        <Reply className="size-4" />
                        Responder
                      </Button>
                    )}
                    {msg.direction === "in" && (
                      <Button variant="ghost" size="icon" onClick={() => markUnread(msg)} aria-label="Marcar como não lida">
                        <MailOpen className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove(msg)} aria-label="Excluir">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                  <span>
                    <span className="font-medium text-ink">{msg.fromName || msg.fromAddr}</span>
                    {msg.fromName && <span className="font-mono"> &lt;{msg.fromAddr}&gt;</span>}
                  </span>
                  <span>para {[...msg.toAddrs, ...msg.ccAddrs].join(", ")}</span>
                  <span className="ml-auto font-mono">{formatDateTime(msg.createdAt)}</span>
                </div>
                {msg.contactId && (
                  <Link
                    href={`/crm/contatos/${msg.contactId}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-soft px-2.5 py-1 text-xs font-medium hover:text-accent"
                  >
                    <UserRound className="size-3.5" />
                    Abrir contato no CRM
                  </Link>
                )}
                {msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={`/api/email/messages/${msg.id}/attachments/${encodeURIComponent(a.id)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs hover:bg-soft"
                      >
                        <Paperclip className="size-3.5" />
                        {a.filename}
                        <span className="font-mono text-subtle">{kb(a.size)}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
                {msg.html ? (
                  <iframe
                    title="Mensagem"
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={htmlDoc(msg.html)}
                    className="size-full min-h-[400px] bg-white"
                  />
                ) : (
                  <p className="whitespace-pre-wrap p-5 text-sm leading-relaxed">{msg.text || "(mensagem vazia)"}</p>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <Modal open={!!draft} onClose={() => !sending && setDraft(null)} title={draft?.replyToId ? "Responder" : "Novo e-mail"} wide>
        {draft && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-xs text-subtle">
              <Mail className="size-3.5" />
              De: <span className="font-mono text-ink">{address}</span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Para" hint="Separe vários com vírgula">
                <Input
                  value={draft.to}
                  onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                  placeholder="cliente@email.com"
                  autoFocus={!draft.to}
                />
              </Field>
              <Field label="Cc (opcional)">
                <Input value={draft.cc} onChange={(e) => setDraft({ ...draft, cc: e.target.value })} />
              </Field>
            </div>
            <Field label="Assunto">
              <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </Field>
            <Field label="Mensagem" hint={draft.replyToId ? "A mensagem original vai citada abaixo do seu texto." : undefined}>
              <Textarea
                rows={12}
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                autoFocus={!!draft.to}
              />
            </Field>
            {(draft.attachments.length > 0 || uploading > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {draft.attachments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline py-1 pl-2.5 pr-1 text-xs"
                  >
                    <Paperclip className="size-3.5" />
                    {a.filename}
                    <span className="font-mono text-subtle">{kb(a.size)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({ ...draft, attachments: draft.attachments.filter((x) => x.id !== a.id) })
                      }
                      className="rounded p-0.5 text-subtle hover:bg-soft hover:text-ink"
                      aria-label={`Remover ${a.filename}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                {uploading > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-subtle">
                    <Loader2 className="size-3.5 animate-spin" />
                    Anexando…
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="mr-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-sm text-subtle transition-colors hover:bg-soft hover:text-ink">
                <Paperclip className="size-4" />
                Anexar arquivo
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    attach(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <Button variant="outline" onClick={() => setDraft(null)} disabled={sending}>
                Cancelar
              </Button>
              <Button variant="accent" loading={sending} disabled={uploading > 0} onClick={send}>
                <Send className="size-4" />
                Enviar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
