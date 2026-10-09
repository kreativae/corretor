"use client";

import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/* ─────────────────────────── Button ─────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", loading, disabled, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-300 ease-expo active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-ink text-canvas hover:opacity-85": variant === "primary",
            "bg-accent text-on-accent hover:brightness-110": variant === "accent",
            "border border-hairline bg-transparent text-ink hover:border-hairline-strong hover:bg-soft":
              variant === "outline",
            "text-subtle hover:bg-soft hover:text-ink": variant === "ghost",
            "bg-red-500/10 text-red-500 hover:bg-red-500/20": variant === "danger",
          },
          {
            "h-8 px-3.5 text-xs": size === "sm",
            "h-10 px-5 text-sm": size === "md",
            "h-12 px-7 text-sm": size === "lg",
            "h-9 w-9": size === "icon",
          },
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

/* ─────────────────────────── Badge ─────────────────────────── */

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
        className ?? "border-hairline bg-soft text-subtle",
      )}
    >
      {children}
    </span>
  );
}

/* ─────────────────────── Form primitives ─────────────────────── */

const fieldBase =
  "w-full rounded-xl border border-hairline bg-card px-3.5 text-sm text-ink outline-none transition-all duration-200 placeholder:text-subtle/50 hover:border-hairline-strong focus:border-[rgb(var(--accent))] focus:ring-4 focus:ring-[rgb(var(--accent))/0.15]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn(fieldBase, "py-2.5 leading-relaxed", className)} {...props} />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(fieldBase, "h-10 cursor-pointer appearance-none pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-subtle">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-subtle/70">{hint}</span>}
    </label>
  );
}

/* ─────────────────────────── Switch ─────────────────────────── */

export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-300 disabled:opacity-40",
        checked
          ? "border-transparent bg-accent"
          : "border-hairline-strong bg-soft",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 size-4.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all duration-300 ease-expo",
          checked ? "left-[calc(100%-1.375rem)]" : "left-1",
        )}
      />
    </button>
  );
}

/* ─────────────────────────── Modal ─────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal>
      <div
        className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        data-lenis-prevent
        className={cn(
          "animate-fade-in relative max-h-[88vh] w-full overflow-y-auto rounded-2xl border border-hairline bg-card p-6 shadow-2xl",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-subtle transition-colors hover:bg-soft hover:text-ink"
            aria-label="Fechar"
          >
            <X className="size-4.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────── Empty state ─────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hairline-strong px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-soft text-subtle">
        {icon}
      </div>
      <p className="font-display text-base font-semibold">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-subtle">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ─────────────────────────── Kbd ─────────────────────────── */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 items-center gap-0.5 rounded-md border border-hairline bg-soft px-1.5 font-mono text-[10px] font-medium text-subtle">
      {children}
    </kbd>
  );
}
