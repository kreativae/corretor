import { timeAgo } from "@/lib/utils";
import type { Activity } from "@/db/schema";
import {
  CalendarDays,
  FileText,
  MessageCircle,
  Move,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  User,
} from "lucide-react";

const ICONS: Record<string, typeof Plus> = {
  created: Plus,
  updated: Pencil,
  visit: CalendarDays,
  sync: RefreshCw,
  pdf: FileText,
  stage: Move,
  message: MessageCircle,
  match: Sparkles,
  lead: User,
};

export function Timeline({ items }: { items: Activity[] }) {
  if (!items.length) {
    return (
      <p className="py-8 text-center text-sm text-subtle">
        Nenhuma atividade registrada ainda.
      </p>
    );
  }
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-hairline">
      {items.map((a, i) => {
        const Icon = ICONS[a.kind] ?? Plus;
        return (
          <li
            key={a.id}
            className="animate-fade-in relative flex gap-4"
            style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
          >
            <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-subtle">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-[13.5px] leading-snug text-ink">{a.text}</p>
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">
                {timeAgo(a.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
