import { LoginForm } from "@/components/auth/login-form";
import { Mark, Wordmark } from "@/components/brand";
import { Monogram } from "@/components/monogram";
import { getCurrentUser } from "@/lib/auth";
import { getWhiteLabel } from "@/lib/queries";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [user, wl, sp] = await Promise.all([
    getCurrentUser(),
    getWhiteLabel(),
    searchParams,
  ]);
  if (user) redirect(sp.next || "/crm");

  return (
    <div className="flex min-h-screen">
      {/* Painel esquerdo — editorial */}
      <div className="dark relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#2B2B5D] p-12 text-ink lg:flex">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-[0.07]" />
        {/* Monograma grande como marca d'água */}
        <Monogram className="pointer-events-none absolute -bottom-24 -right-20 size-[520px] text-white opacity-[0.05]" tip="#F47525" />
        <Wordmark className="relative [&_svg]:size-10" sub={wl.tagline} />

        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink/50">
            Área do corretor
          </p>
          <h1 className="mt-5 max-w-md font-display text-5xl font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
            Todo o seu negócio, em um só lugar.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink/65">
            Imóveis, contatos, agenda, pipeline e portais — sincronizados e
            prontos para o seu dia.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
          {[
            ["10", "Ferramentas integradas"],
            ["4", "Portais conectados"],
            ["24/7", "Sincronização"],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-mono text-2xl font-medium tabular text-ink">
                {v}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-ink/50">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <Mark className="size-10" />
          </div>
          <p className="mt-8 font-mono text-[10.5px] uppercase tracking-[0.22em] text-subtle lg:mt-0">
            Acesso restrito
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            Entrar na plataforma
          </h2>
          <p className="mt-2 text-sm text-subtle">
            Use as credenciais fornecidas pela administração.
          </p>

          <LoginForm nextPath={sp.next} />

          <p className="mt-8 text-center text-xs text-subtle">
            <Link href="/" className="transition-colors hover:text-ink">
              ← Voltar ao site público
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
