import { GerenciaLogin } from "@/components/gerencia/gerencia-login";
import { getSuperadmin } from "@/lib/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gerência", robots: { index: false } };

export default async function GerenciaEntrarPage() {
  if (await getSuperadmin()) redirect("/gerencia");
  return <GerenciaLogin keyConfigured={(process.env.GERENCIA_KEY ?? "").length >= 12} />;
}
