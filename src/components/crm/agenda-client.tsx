"use client";

import {
  activeAgendaChips,
  AgendaFiltersPanel,
  applyAgendaFilters,
  EMPTY_AGENDA_FILTERS,
  type AgendaFilters,
} from "@/components/crm/agenda-filters";
import { ActiveChips, FilterButton, FilterSheet } from "@/components/crm/filter-sheet";
import { StatCard } from "@/components/crm/stat-card";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { VISIT_STATUS_LABELS } from "@/lib/labels";
import type { Contact, Property, Visit } from "@/db/schema";
import { isRuralType } from "@/lib/rural";
import { cn, formatTime } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  CheckCheck,
  Clock,
  Layers,
  Tractor,
  Check,
  Cloud,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type VisitLite = {
  visit: Visit;
  property: Property | null;
  contact: Contact | null;
};

const STATUS_BORDER: Record<string, string> = {
  agendada: "border-l-sky-400",
  confirmada: "border-l-emerald-400",
  realizada: "border-l-zinc-400",
  cancelada: "border-l-red-400 opacity-50",
};

const DAY_NAMES = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

function mondayOf(offset: number) {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type AgendaTab = "todas" | "imoveis" | "rurais";

const isRuralVisit = (v: VisitLite) => isRuralType(v.property?.type);

const FILTERS_KEY = "crm-agenda-filters";

export function AgendaClient({
  initialVisits,
  contacts,
  properties,
  initialTab = "todas",
}: {
  initialVisits: VisitLite[];
  contacts: { id: string; name: string }[];
  properties: { id: string; code: string; title: string; type: string }[];
  initialTab?: AgendaTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<AgendaTab>(initialTab);
  const [offset, setOffset] = useState(0);
  const [visits, setVisits] = useState(initialVisits);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<number | null>(null);
  const [form, setForm] = useState({
    contactId: "",
    propertyId: "",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
  });

  const week = useMemo(() => {
    const start = mondayOf(offset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime() + i * 864e5);
      return d;
    });
  }, [offset]);

  const weekLabel = `${week[0].getDate()} ${MONTHS[week[0].getMonth()]} — ${week[6].getDate()} ${MONTHS[week[6].getMonth()]} ${week[6].getFullYear()}`;

  const counts = {
    todas: visits.length,
    imoveis: visits.filter((v) => !isRuralVisit(v)).length,
    rurais: visits.filter(isRuralVisit).length,
  };
  const modalProperties =
    tab === "todas" ? properties : properties.filter((p) => isRuralType(p.type) === (tab === "rurais"));

  function switchTab(t: AgendaTab) {
    setTab(t);
    router.replace(t === "todas" ? pathname : `${pathname}?tipo=${t}`, { scroll: false });
  }

  const [filters, setFilters] = useState<AgendaFilters>(EMPTY_AGENDA_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const patch = (p: Partial<AgendaFilters>) => setFilters((f) => ({ ...f, ...p }));
  const resetFilters = () => setFilters((f) => ({ ...EMPTY_AGENDA_FILTERS, q: f.q }));
  const closeFilters = useCallback(() => setShowFilters(false), []);

  // Lembra os filtros do usuário neste navegador
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTERS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setFilters({ ...EMPTY_AGENDA_FILTERS, ...JSON.parse(saved), q: "" });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {}
  }, [filters]);

  const inTab = useMemo(
    () => visits.filter((v) => tab === "todas" || isRuralVisit(v) === (tab === "rurais")),
    [visits, tab],
  );
  const weekVisits = useMemo(() => {
    const start = week[0].getTime();
    const end = start + 7 * 864e5;
    return inTab.filter((v) => {
      const t = new Date(v.visit.scheduledAt).getTime();
      return t >= start && t < end;
    });
  }, [inTab, week]);
  const filtered = useMemo(() => applyAgendaFilters(inTab, filters), [inTab, filters]);
  const weekFiltered = useMemo(() => applyAgendaFilters(weekVisits, filters), [weekVisits, filters]);

  // Indicadores da semana exibida (respeitam aba e filtros)
  const stats = useMemo(() => {
    const by = (st: string) => weekFiltered.filter((v) => v.visit.status === st).length;
    const agendadas = by("agendada");
    const confirmadas = by("confirmada");
    const realizadas = by("realizada");
    const canceladas = by("cancelada");
    const ativas = weekFiltered.length - canceladas;
    const clientes = new Set(
      weekFiltered.filter((v) => v.visit.status !== "cancelada").map((v) => v.contact?.id),
    ).size;
    const todayKey = new Date().toDateString();
    const hoje = filtered
      .filter(
        (v) =>
          v.visit.status !== "cancelada" &&
          new Date(v.visit.scheduledAt).toDateString() === todayKey,
      )
      .sort((a, b) => new Date(a.visit.scheduledAt).getTime() - new Date(b.visit.scheduledAt).getTime());
    const agora = new Date().getTime();
    const proxima = hoje.find(
      (v) =>
        ["agendada", "confirmada"].includes(v.visit.status) &&
        new Date(v.visit.scheduledAt).getTime() >= agora,
    );
    const aRealizar = agendadas + confirmadas;
    const encerradas = realizadas + canceladas;
    return {
      ativas,
      clientes,
      hoje: hoje.length,
      proxima: proxima ? formatTime(proxima.visit.scheduledAt) : null,
      confirmadas,
      pctConfirmadas: aRealizar ? Math.round((confirmadas / aRealizar) * 100) : 0,
      aConfirmar: agendadas,
      realizadas,
      comparecimento: encerradas ? Math.round((realizadas / encerradas) * 100) : null,
      canceladas,
    };
  }, [weekFiltered, filtered]);
  const chips = activeAgendaChips(
    filters,
    (id) => inTab.find((v) => v.property?.id === id)?.property?.code ?? "Imóvel",
  );
  // Visitas filtradas nas semanas seguintes à exibida
  const weekEnd = week[0].getTime() + 7 * 864e5;
  const upcomingElsewhere = chips.length || filters.q
    ? filtered.filter((v) => new Date(v.visit.scheduledAt).getTime() >= weekEnd).length
    : 0;

  function visitsFor(day: Date) {
    return filtered
      .filter((v) => {
        const d = new Date(v.visit.scheduledAt);
        return d.toDateString() === day.toDateString();
      })
      .sort(
        (a, b) =>
          new Date(a.visit.scheduledAt).getTime() -
          new Date(b.visit.scheduledAt).getTime(),
      );
  }

  async function setStatus(v: VisitLite, status: string) {
    setBusyId(v.visit.id);
    const prev = visits;
    setVisits((arr) =>
      arr.map((x) =>
        x.visit.id === v.visit.id
          ? { ...x, visit: { ...x.visit, status: status as Visit["status"] } }
          : x,
      ),
    );
    try {
      const res = await fetch(`/api/visits/${v.visit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Visita marcada como ${VISIT_STATUS_LABELS[status].toLowerCase()}.`);
      router.refresh();
    } catch {
      setVisits(prev);
      toast.error("Não foi possível atualizar a visita.");
    } finally {
      setBusyId(null);
    }
  }

  async function reschedule(v: VisitLite, day: Date) {
    const prev = visits;
    const old = new Date(v.visit.scheduledAt);
    const next = new Date(day);
    next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    if (next.toDateString() === old.toDateString()) return;

    setVisits((arr) =>
      arr.map((x) =>
        x.visit.id === v.visit.id
          ? { ...x, visit: { ...x.visit, scheduledAt: next } }
          : x,
      ),
    );
    try {
      const res = await fetch(`/api/visits/${v.visit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: next.toISOString().slice(0, 10) }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        `Visita reagendada para ${next.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}.`,
      );
      router.refresh();
    } catch {
      setVisits(prev);
      toast.error("Não foi possível reagendar a visita.");
    }
  }

  async function createVisit() {
    if (!form.contactId || !form.propertyId || !form.date) {
      toast.error("Selecione contato, imóvel e data.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: form.contactId,
          propertyId: form.propertyId,
          date: form.date,
          time: form.time,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      const contact = contacts.find((c) => c.id === form.contactId) as unknown as Contact;
      const property = properties.find((p) => p.id === form.propertyId) as unknown as Property;
      setVisits((arr) => [...arr, { visit: created, contact, property }]);
      toast.success("Visita agendada — lembrete enviado ao cliente.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Erro ao agendar visita.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Navegação da semana */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setOffset((o) => o - 1)} aria-label="Semana anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setOffset(0)}
            aria-label="Semana atual"
            className="w-auto px-3 text-xs"
          >
            <RotateCcw className="size-3.5" />
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => setOffset((o) => o + 1)} aria-label="Próxima semana">
            <ChevronRight className="size-4" />
          </Button>
          <p className="ml-2 font-mono text-sm tabular text-subtle">{weekLabel}</p>
        </div>
        <Button variant="accent" onClick={() => setOpen(true)}>
          <CalendarPlus className="size-4" />
          Nova visita
        </Button>
      </div>

      <div className="mt-4 inline-flex rounded-full border border-hairline p-1">
        {(
          [
            { id: "todas", label: "Todas", icon: Layers },
            { id: "imoveis", label: "Imóveis", icon: Building2 },
            { id: "rurais", label: "Rurais", icon: Tractor },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-300",
              tab === t.id ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
            <span className="font-mono text-[10.5px] opacity-60">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Buscar por cliente, código ou imóvel…"
            className="pl-10"
          />
        </div>
        <FilterButton count={chips.length} onClick={() => setShowFilters(true)} />
      </div>
      <ActiveChips chips={chips} onClear={patch} onClearAll={resetFilters} />

      {/* Indicadores */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Visitas na semana"
          value={stats.ativas}
          caption={`${stats.clientes} ${stats.clientes === 1 ? "cliente" : "clientes"} · sem canceladas`}
          icon={<CalendarDays className="size-4" />}
        />
        <StatCard
          label="Hoje"
          value={stats.hoje}
          caption={stats.proxima ? `Próxima às ${stats.proxima}` : stats.hoje ? "Nenhuma pendente" : "Agenda livre"}
          icon={<Clock className="size-4" />}
        />
        <StatCard
          label="Confirmadas"
          value={stats.confirmadas}
          caption={
            stats.aConfirmar
              ? `${stats.pctConfirmadas}% · ${stats.aConfirmar} a confirmar`
              : "Nenhuma pendente de confirmação"
          }
          icon={<Check className="size-4" />}
        />
        <StatCard
          label="Realizadas"
          value={stats.realizadas}
          caption={
            stats.comparecimento != null
              ? `${stats.comparecimento}% de comparecimento`
              : "Nenhuma visita encerrada"
          }
          icon={<CheckCheck className="size-4" />}
        />
        <StatCard
          label="Canceladas"
          value={stats.canceladas}
          caption="Na semana exibida"
          icon={<X className="size-4" />}
        />
      </div>

      <FilterSheet
        open={showFilters}
        onClose={closeFilters}
        onReset={resetFilters}
        title="Filtrar agenda"
        activeCount={chips.length}
        resultLabel={`Ver ${weekFiltered.length} ${weekFiltered.length === 1 ? "visita" : "visitas"} na semana`}
      >
        <AgendaFiltersPanel value={filters} onChange={patch} visits={inTab} weekVisits={weekVisits} />
      </FilterSheet>

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
        {weekFiltered.length} de {weekVisits.length} visitas nesta semana
        {upcomingElsewhere > 0 && (
          <> · {upcomingElsewhere} {upcomingElsewhere === 1 ? "outra" : "outras"} nas próximas semanas</>
        )}
        {" "}· arraste os cartões entre os dias para reagendar
      </p>

      {/* Grade da semana */}
      <div className="mt-5 grid gap-2.5 overflow-x-auto md:grid-cols-7">
        {week.map((day, i) => {
          const isToday = day.toDateString() === new Date().toDateString();
          const dayVisits = visitsFor(day);
          return (
            <div
              key={i}
              onDragOver={(e) => {
                e.preventDefault();
                setOverDay(i);
              }}
              onDragLeave={() => setOverDay((d) => (d === i ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                const v = visits.find((x) => x.visit.id === dragId);
                if (v) reschedule(v, day);
                setDragId(null);
                setOverDay(null);
              }}
              className={cn(
                "min-h-72 min-w-44 rounded-2xl border p-2.5 transition-colors duration-200",
                overDay === i && dragId
                  ? "border-[rgb(var(--accent))/0.6] bg-soft ring-2 ring-[rgb(var(--accent))/0.2]"
                  : isToday
                    ? "border-[rgb(var(--accent))/0.4] bg-soft/60"
                    : "border-hairline bg-card",
              )}
            >
              <div className="flex items-baseline justify-between px-1.5 pb-2.5 pt-1">
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.18em]",
                    isToday ? "font-semibold text-accent" : "text-subtle",
                  )}
                >
                  {DAY_NAMES[i]}
                </span>
                <span
                  className={cn(
                    "font-mono text-sm tabular",
                    isToday ? "font-semibold text-accent" : "text-ink",
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-1.5">
                {dayVisits.map((v) => (
                  <div
                    key={v.visit.id}
                    draggable={["agendada", "confirmada"].includes(v.visit.status)}
                    onDragStart={() => setDragId(v.visit.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverDay(null);
                    }}
                    title={
                      ["agendada", "confirmada"].includes(v.visit.status)
                        ? "Arraste para reagendar"
                        : undefined
                    }
                    className={cn(
                      "group rounded-lg border border-hairline border-l-4 bg-canvas p-2.5 transition-all duration-200 hover:shadow-md",
                      STATUS_BORDER[v.visit.status],
                      ["agendada", "confirmada"].includes(v.visit.status) &&
                        "cursor-grab active:cursor-grabbing",
                      dragId === v.visit.id && "rotate-2 opacity-40 shadow-lg",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-1.5 font-mono text-xs font-semibold tabular">
                        {new Date(v.visit.scheduledAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {v.visit.googleEventId && (
                          <Cloud
                            className="size-3 text-blue-500"
                            aria-label="Sincronizado com Google Calendar"
                          />
                        )}
                      </p>
                      <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {v.visit.status === "agendada" && (
                          <button
                            title="Confirmar"
                            disabled={busyId === v.visit.id}
                            onClick={() => setStatus(v, "confirmada")}
                            className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10"
                          >
                            <Check className="size-3" />
                          </button>
                        )}
                        {["agendada", "confirmada"].includes(v.visit.status) && (
                          <button
                            title="Cancelar"
                            disabled={busyId === v.visit.id}
                            onClick={() => setStatus(v, "cancelada")}
                            className="rounded p-1 text-red-400 hover:bg-red-500/10"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 truncate text-xs font-medium">
                      {v.contact?.name ?? "—"}
                    </p>
                    <p className="flex items-center gap-1 truncate text-[10.5px] text-subtle">
                      {isRuralVisit(v) && (
                        <Tractor className="size-3 shrink-0 text-emerald-600" aria-label="Propriedade rural" />
                      )}
                      <span className="truncate">{v.property?.title ?? "—"}</span>
                    </p>
                  </div>
                ))}
                {dayVisits.length === 0 && (
                  <p className="px-1.5 py-4 text-center font-mono text-[10px] uppercase tracking-wider text-subtle/50">
                    livre
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Nova visita */}
      <Modal open={open} onClose={() => setOpen(false)} title="Agendar visita">
        <div className="space-y-4">
          <Field label="Cliente">
            <Select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
              <option value="">Selecionar contato…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={tab === "rurais" ? "Propriedade" : "Imóvel"}>
            <Select value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
              <option value="">{tab === "rurais" ? "Selecionar propriedade…" : "Selecionar imóvel…"}</option>
              {modalProperties.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.title}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Horário">
              <Select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}>
                {TIMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="accent" loading={saving} onClick={createVisit}>
            <CalendarPlus className="size-4" />
            Agendar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
