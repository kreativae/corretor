import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Foto de imóvel servida pelo proxy → versão com marca d'água (site público). */
export function siteImage<T extends string | null | undefined>(
  url: T,
  /** Modo do parceiro dono do imóvel; vazio = padrão do site */
  mode?: string | null,
): T {
  if (!url) return url;
  // Arquivo do próprio sistema: sempre pelo domínio atual. A foto guarda o endereço completo de
  // quando foi enviada (ex.: domínio antigo), que pode não responder mais
  const own = url.match(/^https?:\/\/[^/]+(\/api\/media\/.+)$/);
  if (own) url = own[1] as T;
  if (!url || !url.includes("/api/media/imoveis/") || url.includes("?")) return url;
  if (mode === "nenhuma") return url;
  return `${url}?wm=${mode === "logo" || mode === "linhas" ? mode : "padrao"}` as T;
}

/** Telefone para exibição: "43. 99664. 7565" (sem o 55 do país). */
/** Códigos de país mais comuns (DDI), do mais longo para o mais curto */
const DDI = new Set(
  "1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98 212 213 216 238 239 244 245 258 351 352 353 354 355 356 357 358 359 370 371 372 380 385 386 420 421 591 593 595 598 852 965 966 971 972 973 974".split(" "),
);
/** Grupos de dígitos por país (o resto vai de 3 em 3) */
const GROUPS: Record<string, number[]> = { "1": [3, 3, 4], "351": [3, 3, 3], "34": [3, 3, 3], "971": [2, 3, 4], "44": [4, 6], "33": [1, 2, 2, 2, 2] };

/**
 * Telefone para exibição. Brasil: "+55 43 99911. 7632" (celular antigo sem o 9,
 * como o WhatsApp às vezes entrega, ganha o 9). Exterior: "+351 961 267 424".
 * Aceita o número nacional brasileiro (10 ou 11 dígitos) ou com DDI; com "+" na
 * frente é sempre lido como internacional (ex.: números do WhatsApp).
 */
export function formatPhone(raw: string | null | undefined) {
  const d = (raw ?? "").replace(/\D/g, "");
  const br = (n: string) => {
    let local = n.slice(2);
    if (local.length === 8 && /^[6-9]/.test(local)) local = `9${local}`;
    return `+55 ${n.slice(0, 2)} ${local.slice(0, -4)}. ${local.slice(-4)}`;
  };
  if (!(raw ?? "").trim().startsWith("+") && (d.length === 10 || d.length === 11)) return br(d);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return br(d.slice(2));
  if (d.length >= 8 && d.length <= 15) {
    const cc = [3, 2, 1].map((n) => d.slice(0, n)).find((c) => DDI.has(c));
    if (cc) {
      const rest = d.slice(cc.length);
      const parts: string[] = [];
      let i = 0;
      for (const g of GROUPS[cc] ?? []) {
        if (i >= rest.length) break;
        parts.push(rest.slice(i, i + g));
        i += g;
      }
      for (; i < rest.length; i += 3) parts.push(rest.slice(i, i + 3));
      // Último grupo de 1 dígito fica junto do anterior
      if (parts.length > 1 && parts[parts.length - 1].length === 1) parts.splice(-2, 2, parts.at(-2)! + parts.at(-1)!);
      return `+${cc} ${parts.join(" ")}`;
    }
    return `+${d}`;
  }
  return raw ?? "";
}

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
