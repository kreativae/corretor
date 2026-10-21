"use client";

import { Button, Field, Input, Modal, Select, Switch, Textarea } from "@/components/ui";
import type { AgendaEvent } from "@/db/schema";
import { cn } from "@/lib/utils";
import { CalendarClock, Check, Copy, ExternalLink, MapPin, Trash2, Users, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type EventLite = { event: AgendaEvent; contact: { id: string; name: string; phone: string } | null };

export const EVENT_KIND_LABELS = { reuniao: "Reunião", evento: "Evento" } as const;
const EVENT_STATUS_LABELS = { agendado: "Agendado", realizado: "Realizado", cancelado: "Cancelado" } as const;

/** Cores de evento/reunião (diferentes das visitas, que usam a borda por status) */
export const EVENT_STYLE = {
  reuniao: "border-l-violet-500",
  evento: "border-l-amber-500",
} as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** Horários de 15 em 15 minutos */
const QUARTERS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`);

function TimeSelect({ value, onChange, optional }: { value: string; onChange: (v: string) => void; optional?: boolean }) {
  // Horário fora da grade (vindo do Google, por exemplo) continua na lista
  const list = value && !QUARTERS.includes(value) ? [...QUARTERS, value].sort() : QUARTERS;
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {optional && <option value="">Sem fim</option>}
      {list.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </Select>
  );
}
const hhmm = (d: Date | string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function eventTime(e: AgendaEvent) {
  return e.endsAt ? `${hhmm(e.startsAt)}–${hhmm(e.endsAt)}` : hhmm(e.startsAt);
}

export const KindIcon = ({ kind, className }: { kind: AgendaEvent["kind"]; className?: string }) =>
  kind === "evento" ? <CalendarClock className={className} /> : <Users className={className} />;

/** Cartão na grade da semana */
export function EventCard({
  e,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  e: EventLite;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const ev = e.event;
  const movable = ev.status === "agendado";
  return (
    <div
      draggable={movable}
      onClick={onOpen}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={movable ? "Clique para editar · arraste para mudar o dia" : "Clique para editar"}
      className={cn(
        "cursor-pointer rounded-lg border border-hairline border-l-4 bg-canvas p-2.5 transition-all duration-200 hover:shadow-md",
        EVENT_STYLE[ev.kind],
        movable && "cursor-grab active:cursor-grabbing",
        ev.status === "cancelado" && "opacity-50",
        dragging && "rotate-2 opacity-40 shadow-lg",
      )}
    >
      <p className="flex items-center gap-1.5 font-mono text-xs font-semibold tabular">
        <KindIcon kind={ev.kind} className="size-3 text-subtle" />
        {eventTime(ev)}
        {ev.meetUrl && <Video className="ml-auto size-3.5 text-emerald-600" aria-label="Google Meet" />}
      </p>
      <p className={cn("mt-1 truncate text-xs font-medium", ev.status === "cancelado" && "line-through")}>{ev.title}</p>
      <p className="truncate text-[10.5px] text-subtle">
        {[e.contact?.name, ev.location].filter(Boolean).join(" · ") || EVENT_KIND_LABELS[ev.kind]}
      </p>
    </div>
  );
}

/** Linha na visão de mês */
export function EventChip({ e, onOpen }: { e: EventLite; onOpen: () => void }) {
  return (
    <span
      onClick={(ev) => {
        ev.stopPropagation();
        onOpen();
      }}
      title={`${EVENT_KIND_LABELS[e.event.kind]}: ${e.event.title}`}
      className={cn(
        "block truncate rounded border-l-2 bg-canvas px-1.5 py-0.5 text-[10.5px]",
        EVENT_STYLE[e.event.kind],
        e.event.status === "cancelado" && "line-through opacity-50",
      )}
    >
      <span className="font-mono tabular">{hhmm(e.event.startsAt)}</span> {e.event.title}
    </span>
  );
}

/** Cartão na lista do dia (celular) */
export function EventRow({ e, onOpen }: { e: EventLite; onOpen: () => void }) {
  const ev = e.event;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border border-hairline border-l-4 bg-card p-3.5 text-left",
        EVENT_STYLE[ev.kind],
        ev.status === "cancelado" && "opacity-50",
      )}
    >
      <span className="w-14 shrink-0">
        <span className="block font-mono text-base font-semibold tabular">{hhmm(ev.startsAt)}</span>
        <span className="block text-[10.5px] text-subtle">{EVENT_KIND_LABELS[ev.kind]}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[15px] font-medium leading-tight", ev.status === "cancelado" && "line-through")}>
          {ev.title}
        </span>
        {ev.meetUrl && (
          <a
            href={ev.meetUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(x) => x.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
          >
            <Video className="size-3" /> Entrar no Meet
          </a>
        )}
        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-subtle">
          {ev.location && <MapPin className="size-3 shrink-0" />}
          <span className="truncate">{[e.contact?.name, ev.location].filter(Boolean).join(" · ") || "Sem cliente"}</span>
        </span>
      </span>
    </button>
  );
}

type FormState = {
  kind: AgendaEvent["kind"];
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  contactId: string;
  notes: string;
  status: AgendaEvent["status"];
  meet: boolean;
};

function initialForm(e: EventLite | null, defaultDate?: Date): FormState {
  if (e) {
    const s = new Date(e.event.startsAt);
    const end = e.event.endsAt ? new Date(e.event.endsAt) : null;
    return {
      kind: e.event.kind,
      title: e.event.title,
      date: `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`,
      start: `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      end: end ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : "",
      location: e.event.location ?? "",
      contactId: e.event.contactId ?? "",
      notes: e.event.notes ?? "",
      status: e.event.status,
      meet: false,
    };
  }
  const d = defaultDate ?? new Date();
  return {
    kind: "reuniao",
    title: "",
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    start: "10:00",
    end: "11:00",
    location: "",
    contactId: "",
    notes: "",
    status: "agendado",
    meet: false,
  };
}

/**
 * Novo evento ou reunião (editing = null) ou edição. Cliente opcional: sem cliente, é um
 * evento livre (reunião da equipe, plantão, curso…).
 */
export function EventModal({
  open,
  editing,
  contacts,
  googleConnected = false,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  editing: EventLite | null;
  contacts: { id: string; name: string }[];
  /** Google Calendar conectado: dá para gerar o link do Meet */
  googleConnected?: boolean;
  onClose: () => void;
  onSaved: (e: EventLite) => void;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(editing));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Abriu de novo (ou trocou o evento): recomeça o formulário
  const key = open ? (editing?.event.id ?? "novo") : "";
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setForm(initialForm(editing));
    setConfirmDelete(false);
  }
  const set = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    if (!form.title.trim()) return toast.error("Informe o título.");
    if (!form.date || !form.start) return toast.error("Informe data e horário.");
    setSaving(true);
    try {
      const startsAt = new Date(`${form.date}T${form.start}`);
      const endsAt = form.end ? new Date(`${form.date}T${form.end}`) : null;
      const res = await fetch(editing ? `/api/agenda-events/${editing.event.id}` : "/api/agenda-events", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: form.kind,
          title: form.title,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt ? endsAt.toISOString() : null,
          location: form.location,
          contactId: form.contactId || null,
          notes: form.notes,
          meet: form.meet,
          ...(editing ? { status: form.status } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      const c = contacts.find((x) => x.id === data.contactId);
      const { meetError, ...saved } = data;
      onSaved({ event: saved, contact: c ? { id: c.id, name: c.name, phone: "" } : null });
      toast.success(editing ? "Atualizado." : form.kind === "reuniao" ? "Reunião agendada." : "Evento agendado.");
      if (meetError) toast.warning("Salvo, mas sem o link do Meet", { description: meetError });
      else if (form.meet && saved.meetUrl) toast.success("Link do Google Meet gerado.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agenda-events/${editing.event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(editing.event.id);
      toast.success("Excluído da agenda.");
      onClose();
    } catch {
      toast.error("Não foi possível excluir.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Editar ${EVENT_KIND_LABELS[form.kind].toLowerCase()}` : "Novo evento ou reunião"}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-soft p-1">
          {(["reuniao", "evento"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set({ kind: k })}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                form.kind === k ? "bg-card text-ink shadow-sm" : "text-subtle hover:text-ink",
              )}
            >
              <KindIcon kind={k} className="size-4" />
              {EVENT_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <Field label="Título">
          <Input
            autoFocus
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder={form.kind === "reuniao" ? "Ex.: Reunião de proposta" : "Ex.: Plantão no lançamento"}
            maxLength={160}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Data">
            <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Início">
            <TimeSelect
              value={form.start}
              onChange={(start) => {
                // Mantém a duração ao mudar o início (padrão: 1 hora)
                const [sh, sm] = form.start.split(":").map(Number);
                const [eh, em] = (form.end || "").split(":").map(Number);
                const dur = form.end ? eh * 60 + em - (sh * 60 + sm) : 0;
                const [nh, nm] = start.split(":").map(Number);
                const endMin = nh * 60 + nm + (dur > 0 ? dur : 60);
                set({ start, end: form.end && endMin < 24 * 60 ? `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}` : form.end });
              }}
            />
          </Field>
          <Field label="Fim" hint="Opcional">
            <TimeSelect value={form.end} onChange={(end) => set({ end })} optional />
          </Field>
        </div>
        <Field label="Cliente" hint="Vazio = evento livre, sem cliente">
          <Select value={form.contactId} onChange={(e) => set({ contactId: e.target.value })}>
            <option value="">Sem cliente (evento livre)</option>
            {editing?.contact && !contacts.some((c) => c.id === editing.contact?.id) && (
              <option value={editing.contact.id}>{editing.contact.name}</option>
            )}
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Local" hint="Endereço, sala ou link da chamada">
          <Input value={form.location} onChange={(e) => set({ location: e.target.value })} maxLength={200} />
        </Field>
        {editing?.event.meetUrl ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm">
            <Video className="size-4 shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{editing.event.meetUrl}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(editing.event.meetUrl!).then(() => toast.success("Link copiado."))}
              className="grid size-8 place-items-center rounded-full hover:bg-card"
              aria-label="Copiar link do Meet"
            >
              <Copy className="size-4" />
            </button>
            <a href={editing.event.meetUrl} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-full hover:bg-card" aria-label="Abrir o Meet">
              <ExternalLink className="size-4" />
            </a>
          </div>
        ) : (
          <label className={cn("flex items-center justify-between gap-3 rounded-xl bg-soft px-4 py-3", !googleConnected && "opacity-60")}>
            <span className="flex items-center gap-2.5">
              <Video className="size-4 text-subtle" />
              <span>
                <span className="block text-sm font-medium">Gerar link do Google Meet</span>
                <span className="block text-[11px] text-subtle">
                  {googleConnected
                    ? "Cria a videochamada no Google Calendar; o link vai no lembrete do cliente"
                    : "Conecte o Google Calendar em Configurações para usar"}
                </span>
              </span>
            </span>
            <Switch checked={form.meet} onChange={(v) => set({ meet: v })} disabled={!googleConnected} />
          </label>
        )}
        <Field label="Observações">
          <Textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        {editing && (
          <Field label="Situação">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(EVENT_STATUS_LABELS) as AgendaEvent["status"][]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set({ status: k })}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                    form.status === k ? "border-transparent bg-ink text-canvas" : "border-hairline text-subtle hover:text-ink",
                  )}
                >
                  {EVENT_STATUS_LABELS[k]}
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-subtle">Excluir de vez?</span>
              <Button variant="danger" size="sm" loading={saving} onClick={remove}>
                Sim, excluir
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Não
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4 text-red-500/80" />
              Excluir
            </Button>
          )
        ) : (
          <span />
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="accent" loading={saving} onClick={save}>
            <Check className="size-4" />
            {editing ? "Salvar" : "Agendar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
