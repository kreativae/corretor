import { requireSuperadmin } from "@/lib/auth";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/** Gerência: sempre com login real de um usuário de gerência */
export default async function GerenciaLayout({ children }: { children: ReactNode }) {
  await requireSuperadmin();
  return <div className="min-h-dvh bg-canvas text-ink">{children}</div>;
}
