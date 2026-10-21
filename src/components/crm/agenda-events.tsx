"use client";

import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import type { AgendaEvent } from "@/db/schema";
import { cn } from "@/lib/utils";
import { CalendarClock, Check, MapPin, Trash2, Users } from "lucide-react";
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
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  editing: EventLite | null;
  contacts: { id: string; name: string }[];
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
          ...(editing ? { status: form.status } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      const c = contacts.find((x) => x.id === data.contactId);
      onSaved({ event: data, contact: c ? { id: c.id, name: c.name, phone: "" } : null });
      toast.success(editing ? "Atualizado." : form.kind === "reuniao" ? "Reunião agendada." : "Evento agendado.");
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
            <Input type="time" step={300} value={form.start} onChange={(e) => set({ start: e.target.value })} />
          </Field>
          <Field label="Fim" hint="Opcional">
            <Input type="time" step={300} value={form.end} onChange={(e) => set({ end: e.target.value })} />
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
