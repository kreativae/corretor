import { parseNotes } from "@/lib/contact-notes";
import { cn } from "@/lib/utils";
import { MessageSquareText } from "lucide-react";

/** Histórico das mensagens/anotações do contato, com origem, dia e hora. */
export function NotesHistory({
  notes,
  leadDates,
  className,
}: {
  notes: string | null | undefined;
  /** Datas de entrada como lead (ISO, mais antigas primeiro) */
  leadDates?: string[];
  className?: string;
}) {
  const entries = parseNotes(notes, leadDates);
  if (!entries.length) return null;
  return (
    <ol className={cn("space-y-2", className)}>
      {entries.map((e, i) => (
        <li key={i} className="rounded-xl bg-soft p-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink">
              <MessageSquareText className="size-3.5 text-accent" />
              {e.source ?? "Anotação"}
            </span>
            {e.date && <span className="font-mono text-[10.5px] text-subtle">{e.date}</span>}
          </div>
          {e.text && (
            <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-subtle">{e.text}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
