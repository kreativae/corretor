import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";
import Link from "next/link";

export type MiniMessage = {
  id: string;
  direction: string;
  body: string | null;
  createdAt: string | Date;
};

/** Últimas mensagens do WhatsApp em bolhas compactas + atalho para a conversa */
export function WhatsAppMini({
  messages,
  phone,
  onNavigate,
}: {
  messages: MiniMessage[];
  /** Telefone do contato (abre a conversa em CRM › WhatsApp) */
  phone: string;
  onNavigate?: () => void;
}) {
  const href = `/crm/whatsapp?tel=${phone.replace(/\D/g, "")}`;
  return (
    <div>
      {messages.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline-strong px-3 py-4 text-center text-xs text-subtle">
          Nenhuma mensagem pelo WhatsApp ainda.
        </p>
      ) : (
        <div className="space-y-1.5 rounded-xl bg-soft/60 p-3">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px]",
                  m.direction === "out" ? "rounded-br-md bg-emerald-600 text-white" : "rounded-bl-md bg-card",
                )}
              >
                <p className="line-clamp-4 whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn("mt-0.5 text-right font-mono text-[9.5px]", m.direction === "out" ? "text-white/70" : "text-subtle")}>
                  {new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <Link
        href={href}
        onClick={onNavigate}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline"
      >
        <MessageCircle className="size-3.5" />
        {messages.length ? "Abrir conversa no CRM" : "Iniciar conversa no CRM"}
      </Link>
    </div>
  );
}
