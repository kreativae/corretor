import { TeamClient } from "@/components/admin/team-client";
import { getCurrentUser } from "@/lib/auth";
import { listUsers } from "@/lib/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Equipe & acessos" };

export default async function EquipePage() {
  const [users, me] = await Promise.all([listUsers(), getCurrentUser()]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Governança · RBAC
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Equipe &amp; acessos
          </h1>
        </div>
        <p className="max-w-sm text-right text-xs leading-relaxed text-subtle">
          Crie acessos, defina papéis e redefina senhas. Administradores veem
          toda a governança; corretores operam apenas o CRM.
        </p>
      </div>
      <TeamClient
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          creci: u.creci,
          active: u.active,
          hasPassword: !!u.passwordHash,
          lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={me?.id ?? ""}
      />
    </div>
  );
}
