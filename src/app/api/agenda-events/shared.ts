import { getDb } from "@/db";
import { contacts } from "@/db/schema";
import { eq } from "drizzle-orm";

const KINDS = ["evento", "reuniao"] as const;
const STATUSES = ["agendado", "realizado", "cancelado"] as const;

/** Campos válidos de um evento/reunião vindos do formulário (só os presentes) */
export async function eventFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if ("kind" in body) out.kind = KINDS.includes(body.kind as never) ? body.kind : "reuniao";
  if ("title" in body) out.title = String(body.title ?? "").trim().slice(0, 160);
  if ("startsAt" in body) {
    const d = new Date(String(body.startsAt));
    if (!Number.isNaN(d.getTime())) out.startsAt = d;
  }
  if ("endsAt" in body) {
    const d = body.endsAt ? new Date(String(body.endsAt)) : null;
    out.endsAt = d && !Number.isNaN(d.getTime()) ? d : null;
  }
  if ("location" in body) out.location = String(body.location ?? "").trim().slice(0, 200) || null;
  if ("notes" in body) out.notes = String(body.notes ?? "").trim().slice(0, 2000) || null;
  if ("status" in body) out.status = STATUSES.includes(body.status as never) ? body.status : "agendado";
  if ("contactId" in body) {
    const id = String(body.contactId ?? "");
    let ok: string | null = null;
    if (/^[0-9a-f-]{36}$/i.test(id)) {
      const [c] = await (await getDb()).select({ id: contacts.id }).from(contacts).where(eq(contacts.id, id));
      ok = c?.id ?? null;
    }
    out.contactId = ok;
  }
  // Fim antes do início não vale
  if (out.endsAt && out.startsAt && (out.endsAt as Date) <= (out.startsAt as Date)) out.endsAt = null;
  return out;
}
