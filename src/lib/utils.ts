import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ─────────────────────────── Formatação ─────────────────────────── */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const intFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** 1850000 → "1.850.000" */
export function formatNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(/\D/g, ""));
  return Number.isFinite(n) ? intFormat.format(n) : "";
}

export function formatBRL(value: number | null | undefined) {
  if (value == null) return "—";
  return brl.format(value);
}

/** R$ 1.2M / R$ 890 mil — formato compacto para cards */
export function formatCompact(value: number | null | undefined) {
  if (value == null) return "—";
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return `R$ ${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(".", ",")} mi`;
  }
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return brl.format(value);
}

const monthsShort = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Fuso usado em toda a plataforma (o servidor da Vercel roda em UTC). */
export const TIME_ZONE = "America/Sao_Paulo";

const zonedFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  hourCycle: "h23",
});
const weekdayIndex: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Partes da data no horário de Brasília. */
export function zonedParts(d: Date | string) {
  const parts = Object.fromEntries(
    zonedFormat.formatToParts(new Date(d)).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayIndex[parts.weekday],
  };
}

export function formatDate(d: Date | string) {
  const z = zonedParts(d);
  return `${z.day} ${monthsShort[z.month]} ${z.year}`;
}

export function formatDateTime(d: Date | string) {
  return `${formatDate(d)} · ${formatTime(d)}`;
}

export function formatTime(d: Date | string) {
  const z = zonedParts(d);
  return `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
}

export function weekdayShort(d: Date | string) {
  return weekdays[zonedParts(d).weekday];
}

export function timeAgo(d: Date | string) {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `há ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks} sem`;
  const mths = Math.floor(days / 30);
  return `há ${mths} ${mths === 1 ? "mês" : "meses"}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/**
 * Extrai o ID de um vídeo do YouTube a partir dos formatos comuns:
 * watch?v=, youtu.be/, shorts/, embed/, live/, youtube-nocookie.
 * Retorna null se não for uma URL do YouTube.
 */
export function parseYouTubeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
    /youtube\.com\/shorts\/([\w-]{11})/i,
    /youtube\.com\/embed\/([\w-]{11})/i,
    /youtube\.com\/live\/([\w-]{11})/i,
    /youtube-nocookie\.com\/embed\/([\w-]{11})/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Cor do texto sobre o destaque: a escolhida ou, se vazia, a de maior contraste
 *  entre branco e marinho (WCAG). */
export function onAccentColor(accent: string, chosen?: string): string {
  if (chosen && /^#[0-9a-f]{6}$/i.test(chosen)) return chosen;
  const m = /^#?([0-9a-f]{6})$/i.exec(accent);
  if (!m) return "#1c1c45";
  const lum = (hex: string) => {
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const L = lum(m[1]);
  const vsWhite = 1.05 / (L + 0.05);
  const vsNavy = (L + 0.05) / (lum("1c1c45") + 0.05);
  return vsWhite >= vsNavy ? "#ffffff" : "#1c1c45";
}

/** "#10B981" → "16 185 129" (triplas RGB p/ variáveis CSS) */
export function hexToRgbTriplet(hex: string): string | null {
  const m = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function plural(n: number, singular: string, pluralForm?: string) {
  return n === 1 ? singular : pluralForm ?? `${singular}s`;
}
