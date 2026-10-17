import { TIME_ZONE } from "@/lib/utils";

/** Regras de agenda da visita pelo site (Conteúdo do site › Visita guiada) */
export type VisitRules = {
  times: string[];
  /** Dias da semana abertos (0 = domingo … 6 = sábado) */
  days: number[];
  /** Antecedência mínima em dias (0 = no mesmo dia, 1 = a partir de amanhã…) */
  leadDays: number;
};

/** Quantos dias à frente a lista de datas mostra */
export const VISIT_HORIZON_DAYS = 30;
/** No mesmo dia, só horários a partir de agora + esta folga */
const SAME_DAY_MARGIN_MIN = 120;

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Data (AAAA-MM-DD) e minutos do dia agora, no horário de Brasília */
function nowInZone(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Horários válidos para a data: no mesmo dia, só os que ainda dão tempo */
export function visitTimesFor(date: string, rules: VisitRules, now = new Date()) {
  const times = rules.times.filter((t) => /^\d{1,2}:\d{2}$/.test(t));
  const z = nowInZone(now);
  if (date !== z.date) return times;
  return times.filter((t) => minutesOf(t) >= z.minutes + SAME_DAY_MARGIN_MIN);
}

/** Próximas datas abertas para visita, respeitando dias da semana e antecedência */
export function visitDates(rules: VisitRules, now = new Date()) {
  const start = toUtc(nowInZone(now).date);
  const out: { value: string; label: string }[] = [];
  for (let i = Math.max(0, rules.leadDays); i < rules.leadDays + VISIT_HORIZON_DAYS; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    if (!rules.days.includes(d.getUTCDay())) continue;
    const value = toIso(d);
    if (!visitTimesFor(value, rules, now).length) continue;
    out.push({
      value,
      label: `${WEEKDAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    });
  }
  return out;
}

/** Data e horário permitidos pelas regras (conferido no servidor) */
export function visitAllowed(date: string, time: string, rules: VisitRules, now = new Date()) {
  return visitDates(rules, now).some((d) => d.value === date) && visitTimesFor(date, rules, now).includes(time);
}
