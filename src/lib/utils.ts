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

export function formatDate(d: Date | string) {
  const date = new Date(d);
  return `${date.getDate()} ${monthsShort[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(d: Date | string) {
  const date = new Date(d);
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)} · ${h}:${m}`;
}

export function formatTime(d: Date | string) {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function weekdayShort(d: Date | string) {
  return weekdays[new Date(d).getDay()];
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
