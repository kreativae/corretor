import { zonedParts } from "@/lib/utils";

/**
 * Anotações do contato como histórico. Cada mensagem recebida entra como um
 * bloco "[Origem · dd/mm/aaaa hh:mm] texto", separado por linha em branco.
 */
export type NoteEntry = { source: string | null; date: string | null; text: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** "12/10/2026 14:32" no fuso de São Paulo */
export function noteStamp(d: Date = new Date()) {
  const z = zonedParts(d);
  return `${pad(z.day)}/${pad(z.month + 1)}/${z.year} ${pad(z.hour % 24)}:${pad(z.minute)}`;
}

/** Cabeçalho de um bloco: "[Site · NRD-2401 · 12/10/2026 14:32]" */
export function noteHeader(parts: string[], d: Date = new Date()) {
  return `[${[...parts, noteStamp(d)].join(" · ")}]`;
}

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}(?: \d{2}:\d{2})?$/;

/**
 * Separa o texto salvo em entradas (mais recentes primeiro). `leadDates`
 * (entradas do contato como lead, mais antigas primeiro) dá dia e hora às
 * mensagens antigas do site, gravadas antes de terem data no cabeçalho.
 */
export function parseNotes(raw: string | null | undefined, leadDates: string[] = []): NoteEntry[] {
  const text = (raw ?? "").trim();
  if (!text) return [];
  // Novo bloco começa numa linha que abre com "[...]"; o resto é o corpo
  const blocks = text.split(/\n\s*\n(?=\[[^\]\n]+\])/);
  const out: NoteEntry[] = [];
  for (const block of blocks) {
    // Notas antigas grudadas na mesma linha: "[Site] a [Site] b"
    for (const piece of block.split(/\s+(?=\[(?:Site|QR)[^\]\n]*\])/)) {
      const m = /^\[([^\]\n]+)\]\s*([\s\S]*)$/.exec(piece.trim());
      if (!m) {
        if (piece.trim()) out.push({ source: null, date: null, text: piece.trim() });
        continue;
      }
      const parts = m[1].split(" · ").map((s) => s.trim());
      const date = parts.length > 1 && DATE_RE.test(parts[parts.length - 1]) ? parts.pop()! : null;
      out.push({ source: parts.join(" · ") || null, date, text: m[2].trim() });
    }
  }
  // Mensagens do site/QR ↔ entradas como lead: só preenche se a contagem bate
  const fromSite = out.filter((e) => e.source && /^(Site|QR)\b/.test(e.source));
  if (fromSite.length && fromSite.length === leadDates.length) {
    fromSite.forEach((e, i) => {
      if (!e.date) e.date = noteStamp(new Date(leadDates[i]));
    });
  }
  return out.reverse();
}
