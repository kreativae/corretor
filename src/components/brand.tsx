import { cn } from "@/lib/utils";

/** Marca "N" — traço esmeralda sobre quadrado preto */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-7", className)} aria-hidden>
      <rect width="64" height="64" rx="14" className="fill-ink" />
      <path
        d="M20 46V18l24 28V18"
        fill="none"
        stroke="rgb(var(--accent))"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({
  name,
  sub,
  className,
  invert,
}: {
  name: string;
  sub?: string;
  className?: string;
  invert?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Mark className={invert ? "[&>rect]:fill-white" : undefined} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-semibold tracking-tight">
          {name}
        </span>
        {sub && (
          <span className="mt-0.5 text-[9.5px] font-medium uppercase tracking-[0.22em] text-subtle">
            {sub}
          </span>
        )}
      </span>
    </span>
  );
}
