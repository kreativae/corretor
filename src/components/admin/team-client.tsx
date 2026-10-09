"use client";

import { Badge, Button, Field, Input, Modal, Select, Switch } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/labels";
import { cn, initials, timeAgo } from "@/lib/utils";
import { KeyRound, Pencil, Plus, ShieldCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "corretor";
  creci: string | null;
  phone: string | null;
  active: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export function TeamClient({
  users,
  currentUserId,
}: {
  users: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwTarget, setPwTarget] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({ name: "", creci: "", phone: "" });
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "corretor",
    creci: "",
    phone: "",
    password: "",
  });

  async function createUser() {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      toast.error("Nome, e-mail e senha (mín. 6 caracteres) são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${form.name} agora tem acesso à plataforma.`);
      setForm({ name: "", email: "", role: "corretor", creci: "", phone: "", password: "" });
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Erro ao criar acesso.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(id: string, patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      return true;
    } catch {
      toast.error("Não foi possível atualizar o usuário.");
      return false;
    }
  }

  function openEdit(u: TeamMember) {
    setEditTarget(u);
    setEditForm({ name: u.name, creci: u.creci ?? "", phone: u.phone ?? "" });
  }

  async function saveEdit() {
    if (!editTarget || !editForm.name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    setSaving(true);
    const ok = await updateUser(editTarget.id, editForm);
    if (ok) {
      toast.success("Cadastro atualizado.");
      setEditTarget(null);
    }
    setSaving(false);
  }

  async function resetPassword() {
    if (!pwTarget || newPassword.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setSaving(true);
    const ok = await updateUser(pwTarget.id, { password: newPassword });
    if (ok) {
      toast.success(`Senha de ${pwTarget.name.split(" ")[0]} redefinida.`);
      setPwTarget(null);
      setNewPassword("");
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Novo acesso
        </Button>
      </div>

      <div className="card-elev overflow-x-auto rounded-2xl border border-hairline bg-card">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
              <th className="px-5 py-3.5 font-medium">Membro</th>
              <th className="px-4 py-3.5 font-medium">Papel</th>
              <th className="px-4 py-3.5 font-medium">CRECI</th>
              <th className="px-4 py-3.5 font-medium">Último acesso</th>
              <th className="px-4 py-3.5 text-center font-medium">Ativo</th>
              <th className="px-4 py-3.5 text-right font-medium">Senha</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-hairline/60 transition-colors last:border-0 hover:bg-soft/40"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-ink font-mono text-[10px] font-semibold text-canvas">
                      {initials(u.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium leading-tight">
                        {u.name}
                        {u.id === currentUserId && (
                          <span className="rounded-full bg-accent/12 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">
                            você
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[11px] text-subtle">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <Select
                    value={u.role}
                    disabled={u.id === currentUserId}
                    onChange={async (e) => {
                      const ok = await updateUser(u.id, { role: e.target.value });
                      if (ok) toast.success(`${u.name} agora é ${ROLE_LABELS[e.target.value].toLowerCase()}.`);
                    }}
                    className="h-8 w-40 text-xs"
                  >
                    <option value="corretor">Corretor</option>
                    <option value="admin">Administrador</option>
                  </Select>
                </td>
                <td className="px-4 py-3.5 font-mono text-xs text-subtle">
                  {u.creci ?? "—"}
                </td>
                <td className="px-4 py-3.5 font-mono text-xs text-subtle">
                  {u.lastLoginAt ? timeAgo(u.lastLoginAt) : "nunca"}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex justify-center">
                    <Switch
                      checked={u.active}
                      disabled={u.id === currentUserId}
                      onChange={async (v) => {
                        const ok = await updateUser(u.id, { active: v });
                        if (ok)
                          toast.success(
                            v ? `${u.name} reativado.` : `${u.name} desativado.`,
                          );
                      }}
                    />
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-2">
                    <Badge
                      className={cn(
                        "border",
                        u.hasPassword
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-500",
                      )}
                    >
                      {u.hasPassword ? "definida" : "pendente"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(u)}
                      className="h-8"
                      aria-label={`Editar ${u.name}`}
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPwTarget(u)}
                      className="h-8"
                    >
                      <KeyRound className="size-3.5" />
                      Redefinir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-elev mt-5 flex items-start gap-3.5 rounded-2xl border border-hairline bg-card p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-subtle">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Controle de acesso por papel (RBAC)</p>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-subtle">
            <strong className="text-ink">Administradores</strong> acessam o
            painel master: equipe, conteúdo do site, integrações e chaves de API.{" "}
            <strong className="text-ink">Corretores</strong> acessam apenas o
            CRM operacional — imóveis, pipeline, contatos e agenda. Senhas são
            armazenadas com hash scrypt + salt único.
          </p>
        </div>
      </div>

      {/* Novo acesso */}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo acesso" wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Ana Beatriz Mendes"
            />
          </Field>
          <Field label="E-mail (login)">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ana@imobiliaria.com.br"
            />
          </Field>
          <Field label="Senha inicial" hint="Mínimo 6 caracteres">
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="senha provisória"
              className="font-mono"
            />
          </Field>
          <Field label="Papel">
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="corretor">Corretor</option>
              <option value="admin">Administrador</option>
            </Select>
          </Field>
          <Field label="CRECI (opcional)">
            <Input
              value={form.creci}
              onChange={(e) => setForm({ ...form, creci: e.target.value })}
              placeholder="198.442-F"
            />
          </Field>
          <Field label="WhatsApp (opcional)" hint="DDI + DDD + número · aparece na ficha">
            <Input
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
              placeholder="5543999999999"
              className="font-mono"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="accent" loading={saving} onClick={createUser}>
            <UserPlus className="size-4" />
            Criar acesso
          </Button>
        </div>
      </Modal>

      {/* Editar cadastro */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar cadastro">
        <div className="space-y-4">
          <Field label="Nome completo">
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CRECI">
              <Input
                value={editForm.creci}
                onChange={(e) => setEditForm({ ...editForm, creci: e.target.value })}
                placeholder="000.000-F"
              />
            </Field>
            <Field label="WhatsApp" hint="DDI + DDD + número">
              <Input
                inputMode="tel"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, "") })
                }
                placeholder="5543999999999"
                className="font-mono"
              />
            </Field>
          </div>
          <p className="text-[11px] text-subtle">
            Nome, CRECI e WhatsApp aparecem na ficha do imóvel gerada por este usuário.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditTarget(null)}>
            Cancelar
          </Button>
          <Button variant="accent" loading={saving} onClick={saveEdit}>
            Salvar
          </Button>
        </div>
      </Modal>

      {/* Redefinir senha */}
      <Modal
        open={!!pwTarget}
        onClose={() => {
          setPwTarget(null);
          setNewPassword("");
        }}
        title="Redefinir senha"
      >
        <p className="text-sm text-subtle">
          Nova senha para{" "}
          <span className="font-medium text-ink">{pwTarget?.name}</span>. Informe
          ao usuário por canal seguro.
        </p>
        <Field label="Nova senha" className="mt-4" hint="Mínimo 6 caracteres">
          <Input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="font-mono"
            placeholder="nova-senha-2026"
          />
        </Field>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPwTarget(null);
              setNewPassword("");
            }}
          >
            Cancelar
          </Button>
          <Button variant="accent" loading={saving} onClick={resetPassword}>
            <KeyRound className="size-4" />
            Redefinir senha
          </Button>
        </div>
      </Modal>
    </div>
  );
}
