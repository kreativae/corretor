import { requireModule } from "@/lib/account";
import type { ReactNode } from "react";

/** Módulo liberado pela gerência (senão, a página não existe) */
export default async function ModuleLayout({ children }: { children: ReactNode }) {
  await requireModule("valorM2");
  return children;
}
