/** Papéis: gerência (kreativ.ae) › administrador (cliente) › corretor */
export type Role = "superadmin" | "admin" | "corretor";

type WithRole = { role: string } | null | undefined;

/** Administrador do cliente ou gerência — tudo que o admin pode, a gerência também pode */
export const isAdmin = (u: WithRole) => u?.role === "admin" || u?.role === "superadmin";

/** Gerência: acima do administrador, controla conta, plano e módulos */
export const isSuperadmin = (u: WithRole) => u?.role === "superadmin";

export const roleLabel = (role: string) =>
  role === "superadmin" ? "Gerência" : role === "admin" ? "Administrador" : "Corretor";
