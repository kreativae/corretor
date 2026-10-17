import "server-only";
import { getDb } from "@/db";
import { mailMessages, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { and, eq, isNull, or, type SQL } from "drizzle-orm";

/** Usuário da sessão com o endereço de e-mail dele */
export async function mailUser() {
  const me = await getCurrentUser();
  if (!me) return null;
  const [row] = await (await getDb())
    .select({ mailbox: users.mailbox })
    .from(users)
    .where(eq(users.id, me.id));
  return { ...me, mailbox: row?.mailbox ?? null, admin: isAdmin(me) };
}

export type MailUser = NonNullable<Awaited<ReturnType<typeof mailUser>>>;

/** Mensagens que o usuário pode ver: as dele e, se for administrador, as da caixa geral */
export function visibleTo(u: MailUser): SQL {
  return u.admin
    ? (or(eq(mailMessages.userId, u.id), isNull(mailMessages.userId)) as SQL)
    : eq(mailMessages.userId, u.id);
}

export async function findVisibleMessage(u: MailUser, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await (await getDb())
    .select()
    .from(mailMessages)
    .where(and(eq(mailMessages.id, id), visibleTo(u)));
  return row ?? null;
}
