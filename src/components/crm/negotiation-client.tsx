"use client";

import { Button, Input, Select, Switch, Textarea } from "@/components/ui";
import type { PropertySend, SentAttachment } from "@/db/schema";
import { PURPOSE_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { isRuralType } from "@/lib/rural";
import { cn, formatBRL, formatDateTime, plural } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  FileText,
  ImageIcon,
  Loader2,
  Mail,
  Paperclip,
  Search,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type NegContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  interestTypes: string[];
  budgetMax: number | null;
  neighborhoods: string[];
};

export type NegProperty = {
  id: string;
  code: string;
  title: string;
  type: string;
  purpose: string;
  status: string;
  price: number;
  city: string;
  neighborhood: string;
  cover: string | null;
  published: boolean;
  /** "3 quartos · 120 m²" / "45 alq" */
  specs: string;
};

const MAX_PROPS = 12;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Abre a ficha num iframe fora da tela; ela gera o PDF e devolve por postMessage. */
function fichaPdf(code: string) {
  return new Promise<File>((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    Object.assign(frame.style, {
      position: "fixed",
      left: "-12000px",
      top: "0",
      width: "1000px",
      height: "1500px",
      border: "0",
    });
    const done = () => {
      window.removeEventListener("message", onMsg);
      window.clearTimeout(timer);
      frame.remove();
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || e.origin !== location.origin) return;
      if (e.data?.type === "ficha-pdf" && e.data.file instanceof File) {
        done();
        resolve(e.data.file);
      } else if (e.data?.type === "ficha-pdf-error") {
        done();
        reject(new Error(e.data.error || `Falha ao gerar a ficha ${code}.`));
      }
    };
    const timer = window.setTimeout(() => {
      done();
      reject(new Error(`A ficha ${code} demorou demais para gerar.`));
    }, 60_000);
    window.addEventListener("message", onMsg);
    frame.src = `/imoveis/${encodeURIComponent(code)}/ficha?embed=envio`;
    document.body.appendChild(frame);
  });
}

async function uploadPdf(file: File): Promise<SentAttachment> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/negociacao/anexo", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Falha ao salvar o PDF.");
  return data;
}

const card = "rounded-2xl border border-hairline bg-card p-5 sm:p-6";
const h2 = "flex items-center gap-2 font-display text-base font-semibold tracking-tight";

export function NegotiationClient({
  contacts,
  properties,
  sends,
  emailReady,
  userName,
  initialContactId,
  initialIds = [],
}: {
  contacts: NegContact[];
  properties: NegProperty[];
  sends: PropertySend[];
  emailReady: boolean;
  userName: string;
  initialContactId?: string;
  initialIds?: string[];
}) {
  const router = useRouter();
  const initialContact = contacts.find((c) => c.id === initialContactId) ?? null;

  /* ── destinatário ── */
  const [contact, setContact] = useState<NegContact | null>(initialContact);
  const [cq, setCq] = useState("");
  const [cOpen, setCOpen] = useState(false);
  const [toName, setToName] = useState(initialContact?.name ?? "");
  const [toEmail, setToEmail] = useState(initialContact?.email ?? "");

  /* ── imóveis ── */
  const [selected, setSelected] = useState<string[]>(initialIds.filter((id) => properties.some((p) => p.id === id)));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | "urbano" | "rural">("all");
  const [purpose, setPurpose] = useState("");
  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [onlyMatch, setOnlyMatch] = useState(false);

  /* ── mensagem ── */
  const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? "";
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(
    "Separei algumas opções que combinam com o que você procura. Dê uma olhada e me diga quais gostaria de visitar — fico à disposição para tirar qualquer dúvida.",
  );
  const [attach, setAttach] = useState(true);

  /* ── envio ── */
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState("");
  const [hq, setHq] = useState("");

  const byId = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const cities = useMemo(() => [...new Set(properties.map((p) => p.city).filter(Boolean))].sort(), [properties]);

  function matches(p: NegProperty, c: NegContact | null) {
    if (!c) return false;
    const typeOk = !c.interestTypes.length || c.interestTypes.includes(p.type);
    const priceOk = !c.budgetMax || p.price <= c.budgetMax * 1.1;
    const hoodOk = !c.neighborhoods.length || c.neighborhoods.includes(p.neighborhood) || c.neighborhoods.includes(p.city);
    return typeOk && priceOk && hoodOk;
  }

  const filtered = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const max = Number(maxPrice.replace(/\D/g, "")) || 0;
    return properties.filter((p) => {
      if (onlyAvailable && !["disponivel", "reservado"].includes(p.status)) return false;
      if (cat === "rural" && !isRuralType(p.type)) return false;
      if (cat === "urbano" && isRuralType(p.type)) return false;
      if (purpose && p.purpose !== purpose) return false;
      if (city && p.city !== city) return false;
      if (max && p.price > max) return false;
      if (onlyMatch && !matches(p, contact)) return false;
      if (words.length) {
        const hay = norm(`${p.code} ${p.title} ${p.neighborhood} ${p.city} ${TYPE_LABELS[p.type] ?? ""}`);
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [properties, q, cat, purpose, city, maxPrice, onlyAvailable, onlyMatch, contact]);

  const contactResults = useMemo(() => {
    const w = norm(cq.trim());
    if (!w) return contacts.slice(0, 8);
    return contacts
      .filter((c) => norm(`${c.name} ${c.email ?? ""} ${c.phone}`).includes(w))
      .slice(0, 8);
  }, [contacts, cq]);

  function pickContact(c: NegContact | null) {
    setContact(c);
    setCOpen(false);
    setCq("");
    setToName(c?.name ?? "");
    setToEmail(c?.email ?? "");
  }

  function toggle(id: string) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_PROPS) {
        toast.error(`Até ${MAX_PROPS} imóveis por e-mail.`);
        return cur;
      }
      return [...cur, id];
    });
  }

  const chosen = selected.map((id) => byId.get(id)).filter((p): p is NegProperty => !!p);
  const autoSubject =
    chosen.length === 1
      ? `${chosen[0].title} — ${chosen[0].code}`
      : `${chosen.length} imóveis selecionados para você${toName ? `, ${firstName(toName)}` : ""}`;
  const finalSubject = subject.trim() || autoSubject;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.trim());
  const canSend = emailReady && validEmail && chosen.length > 0 && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      const attachments: SentAttachment[] = [];
      if (attach) {
        for (const [i, p] of chosen.entries()) {
          setStep(`Gerando ficha ${i + 1} de ${chosen.length} (${p.code})…`);
          try {
            const file = await fichaPdf(p.code);
            attachments.push(await uploadPdf(file));
          } catch (e) {
            console.error(e);
            toast.warning(`Ficha ${p.code} não foi anexada`, {
              description: e instanceof Error ? e.message : undefined,
            });
          }
        }
      }
      setStep("Enviando e-mail…");
      const res = await fetch("/api/negociacao/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact?.id,
          toName,
          toEmail,
          subject: finalSubject,
          message,
          propertyIds: chosen.map((p) => p.id),
          attachments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha no envio.");
      toast.success(`E-mail enviado para ${toName || toEmail}`, {
        description: `${chosen.length} ${plural(chosen.length, "imóvel", "imóveis")}${attachments.length ? ` · ${attachments.length} ${plural(attachments.length, "ficha anexa", "fichas anexas")}` : ""}`,
      });
      setSelected([]);
      setSubject("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
      router.refresh();
    } finally {
      setSending(false);
      setStep("");
    }
  }

  const history = useMemo(() => {
    const w = norm(hq.trim());
    if (!w) return sends;
    return sends.filter((s) =>
      norm(`${s.toName ?? ""} ${s.toEmail} ${s.subject} ${s.properties.map((p) => `${p.code} ${p.title}`).join(" ")}`).includes(w),
    );
  }, [sends, hq]);

  const [clearing, setClearing] = useState(false);
  async function clearHistory() {
    const n = history.length;
    const what = hq.trim() ? `os ${n} ${plural(n, "envio encontrado", "envios encontrados")} na busca` : `todo o histórico (${n} ${plural(n, "envio", "envios")})`;
    if (!confirm(`Apagar ${what}? Os PDFs guardados também são apagados. Os e-mails que os clientes já receberam não são afetados.`)) return;
    setClearing(true);
    try {
      const deleted = await deleteSends(history.map((s) => s.id));
      toast.success(`${deleted} ${plural(deleted, "envio apagado", "envios apagados")} do histórico.`);
      setHq("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao apagar.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">Envio ao cliente</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Negociação</h1>
          <p className="mt-1 text-sm text-subtle">
            Selecione imóveis, envie por e-mail com as fichas em PDF e acompanhe tudo no histórico.
          </p>
        </div>
      </div>

      {!emailReady && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>
            O envio de e-mails ainda não está configurado. Adicione a chave <code className="font-mono">RESEND_API_KEY</code>{" "}
            e o remetente <code className="font-mono">LEADS_FROM_EMAIL</code> (domínio verificado no Resend) na Vercel.
          </p>
        </div>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* 1 · Cliente */}
          <section className={card}>
            <h2 className={h2}>
              <span className="grid size-6 place-items-center rounded-full bg-ink font-mono text-[11px] text-canvas">1</span>
              Para quem
            </h2>
            <div className="relative mt-4">
              {contact ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-soft px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/crm/contatos/${contact.id}`} className="truncate font-medium hover:underline">
                      {contact.name}
                    </Link>
                    <p className="truncate text-xs text-subtle">{contact.email || "Sem e-mail no cadastro"} · {contact.phone}</p>
                  </div>
                  <button type="button" onClick={() => pickContact(null)} className="grid size-8 place-items-center rounded-full text-subtle hover:bg-card hover:text-ink" aria-label="Trocar contato">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Search className="pointer-events-none absolute left-3.5 top-[22px] size-4 -translate-y-1/2 text-subtle" />
                  <Input
                    value={cq}
                    onChange={(e) => {
                      setCq(e.target.value);
                      setCOpen(true);
                    }}
                    onFocus={() => setCOpen(true)}
                    onBlur={() => window.setTimeout(() => setCOpen(false), 150)}
                    placeholder="Buscar contato por nome, e-mail ou telefone…"
                    className="h-11 pl-10"
                  />
                  {cOpen && contactResults.length > 0 && (
                    <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-hairline bg-card p-1 shadow-xl">
                      {contactResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickContact(c)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-soft"
                        >
                          <User className="size-4 shrink-0 text-subtle" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{c.name}</span>
                            <span className="block truncate text-xs text-subtle">{c.email || "sem e-mail"} · {c.phone}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-subtle">Nome</span>
                <Input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Nome do cliente" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-subtle">E-mail</span>
                <Input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="cliente@email.com" />
              </label>
            </div>
            {!contact && toEmail && (
              <p className="mt-2 text-[11px] text-subtle">
                Sem contato vinculado: o envio fica no histórico, mas não na ficha de um contato.
              </p>
            )}
          </section>

          {/* 2 · Imóveis */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={h2}>
                <span className="grid size-6 place-items-center rounded-full bg-ink font-mono text-[11px] text-canvas">2</span>
                Imóveis
              </h2>
              <span className="font-mono text-[11px] text-subtle">
                {filtered.length} {plural(filtered.length, "encontrado", "encontrados")} · {chosen.length}/{MAX_PROPS} {plural(chosen.length, "selecionado", "selecionados")}
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative sm:col-span-2">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, título, bairro…" className="pl-10" />
              </div>
              <Select value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
                <option value="all">Imóveis e rurais</option>
                <option value="urbano">Só imóveis</option>
                <option value="rural">Só propriedades rurais</option>
              </Select>
              <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                <option value="">Venda e aluguel</option>
                {Object.entries(PURPOSE_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
              <Select value={city} onChange={(e) => setCity(e.target.value)} className="sm:col-span-1">
                <option value="">Todas as cidades</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Preço até (R$)" />
              <label className="flex items-center gap-2 text-xs text-subtle lg:col-span-2">
                <Switch checked={onlyAvailable} onChange={setOnlyAvailable} />
                Só disponíveis e reservados
              </label>
            </div>
            {contact && (
              <label className="mt-3 flex items-center gap-2 text-xs text-subtle">
                <Switch checked={onlyMatch} onChange={setOnlyMatch} />
                <Sparkles className="size-3.5 text-accent" />
                Só compatíveis com o perfil de {firstName(contact.name)}
              </label>
            )}

            <ul className="mt-4 max-h-[520px] divide-y divide-hairline overflow-auto rounded-xl border border-hairline" data-lenis-prevent>
              {filtered.length === 0 && <li className="px-4 py-10 text-center text-sm text-subtle">Nenhum imóvel com esses filtros.</li>}
              {filtered.map((p) => {
                const on = selected.includes(p.id);
                const match = matches(p, contact);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      aria-pressed={on}
                      className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors", on ? "bg-accent/10" : "hover:bg-soft")}
                    >
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                          on ? "border-transparent bg-accent text-white" : "border-hairline-strong",
                        )}
                      >
                        {on && <Check className="size-3.5" />}
                      </span>
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-soft">
                        {p.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.cover} alt="" className="size-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon className="absolute inset-0 m-auto size-4 text-subtle" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-subtle">{p.code}</span>
                          {match && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-px text-[10px] font-medium text-accent">
                              <Sparkles className="size-3" /> perfil
                            </span>
                          )}
                          {!p.published && <span className="rounded-full bg-soft px-1.5 py-px text-[10px] text-subtle">fora do site</span>}
                        </span>
                        <span className="block truncate text-sm font-medium">{p.title}</span>
                        <span className="block truncate text-xs text-subtle">
                          {[p.neighborhood, p.city].filter(Boolean).join(", ")}
                          {p.specs && ` · ${p.specs}`}
                          {p.status !== "disponivel" && ` · ${STATUS_LABELS[p.status] ?? p.status}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-sm tabular">{formatBRL(p.price)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 3 · Mensagem */}
          <section className={card}>
            <h2 className={h2}>
              <span className="grid size-6 place-items-center rounded-full bg-ink font-mono text-[11px] text-canvas">3</span>
              Mensagem
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-subtle">Assunto</span>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={autoSubject} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-subtle">
                  Texto {toName && <span className="font-normal">(começa com &quot;Olá, {firstName(toName)}!&quot;)</span>}
                </span>
                <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={attach} onChange={setAttach} />
                <Paperclip className="size-4 text-subtle" />
                Anexar as fichas em PDF
              </label>
              <p className="text-[11px] text-subtle">
                O e-mail traz foto, preço e botões para o site de cada imóvel. As respostas do cliente chegam no seu e-mail.
              </p>
            </div>
          </section>
        </div>

        {/* Resumo e envio */}
        <aside className={cn(card, "lg:sticky lg:top-24")}>
          <h2 className={h2}>
            <Mail className="size-4" /> Resumo
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-subtle">Para</dt>
              <dd className="min-w-0 truncate text-right">{toName || toEmail || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-subtle">E-mail</dt>
              <dd className={cn("min-w-0 truncate text-right", toEmail && !validEmail && "text-red-500")}>{toEmail || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-subtle">Remetente</dt>
              <dd className="min-w-0 truncate text-right">{userName}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-1.5">
            {chosen.length === 0 && <li className="rounded-xl bg-soft px-3 py-4 text-center text-xs text-subtle">Nenhum imóvel selecionado</li>}
            {chosen.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg bg-soft px-3 py-2 text-xs">
                <span className="font-mono text-subtle">{p.code}</span>
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <button type="button" onClick={() => toggle(p.id)} className="text-subtle hover:text-ink" aria-label={`Tirar ${p.code}`}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="accent" className="mt-5 w-full" onClick={send} disabled={!canSend}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {sending ? "Enviando…" : "Enviar por e-mail"}
          </Button>
          {step && <p className="mt-2 text-center text-xs text-subtle">{step}</p>}
          {!sending && (
            <p className="mt-2 text-center text-[11px] text-subtle">
              {!validEmail
                ? "Informe um e-mail válido."
                : !chosen.length
                  ? "Selecione ao menos um imóvel."
                  : attach
                    ? "As fichas são geradas no seu navegador — leva alguns segundos por imóvel."
                    : ""}
            </p>
          )}
        </aside>
      </div>

      {/* Histórico */}
      <section className={cn(card, "mt-8")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={h2}>
            <FileText className="size-4" /> Histórico de envios
            <span className="font-mono text-[11px] font-normal text-subtle">{sends.length}</span>
          </h2>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input value={hq} onChange={(e) => setHq(e.target.value)} placeholder="Cliente, e-mail ou código…" className="pl-10" />
            </div>
            {history.length > 0 && (
              <Button variant="outline" size="sm" className="h-10 shrink-0" onClick={clearHistory} disabled={clearing}>
                {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {hq.trim() ? `Apagar ${history.length}` : "Limpar tudo"}
              </Button>
            )}
          </div>
        </div>
        {history.length === 0 ? (
          <p className="mt-6 rounded-xl bg-soft px-4 py-10 text-center text-sm text-subtle">
            {sends.length ? "Nada encontrado." : "Os e-mails enviados aparecem aqui."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline">
            {history.map((s) => (
              <SendRow key={s.id} s={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function deleteSends(ids: string[]) {
  const res = await fetch("/api/negociacao", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Falha ao apagar.");
  return data.deleted as number;
}

/** Uma linha do histórico (também usada na ficha do contato) */
export function SendRow({ s, hideContact = false }: { s: PropertySend; hideContact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Apagar este envio do histórico? Os PDFs guardados também são apagados (o e-mail que o cliente já recebeu não é afetado).")) return;
    setBusy(true);
    try {
      await deleteSends([s.id]);
      toast.success("Envio apagado do histórico.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao apagar.");
      setBusy(false);
    }
  }

  return (
    <li className={cn("group flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:gap-4", busy && "opacity-50")}>
      <div className="w-36 shrink-0 font-mono text-[11px] text-subtle">{formatDateTime(s.createdAt)}</div>
      <div className="min-w-0 flex-1">
        {!hideContact && (
          <p className="truncate text-sm">
            {s.contactId ? (
              <Link href={`/crm/contatos/${s.contactId}`} className="font-medium hover:underline">
                {s.toName || s.toEmail}
              </Link>
            ) : (
              <span className="font-medium">{s.toName || s.toEmail}</span>
            )}
            {s.toName && <span className="text-subtle"> · {s.toEmail}</span>}
          </p>
        )}
        <p className="truncate text-xs text-subtle">{s.subject}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.properties.map((p) => (
            <Link
              key={p.id}
              href={`/crm/abrir/${p.code}`}
              title={`${p.title} · ${formatBRL(p.price)}`}
              className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[11px] text-subtle hover:text-ink"
            >
              {p.code}
            </Link>
          ))}
          {s.attachments.map((a) => (
            <a
              key={a.pathname}
              href={`/api/negociacao/anexo/${a.pathname}${a.access === "public" ? "?a=public" : ""}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-soft px-2 py-0.5 text-[11px] text-subtle hover:text-ink"
            >
              <Paperclip className="size-3" />
              {a.name}
            </a>
          ))}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs">
        {s.status === "enviado" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600">
            <Check className="size-3" /> Enviado
          </span>
        ) : (
          <span title={s.error ?? undefined} className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-500">
            <AlertTriangle className="size-3" /> Falhou
          </span>
        )}
        {s.sentBy && <p className="mt-1 text-subtle">por {s.sentBy}</p>}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-subtle transition-colors hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <Trash2 className="size-3" /> Apagar
        </button>
      </div>
    </li>
  );
}
