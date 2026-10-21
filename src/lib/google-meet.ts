import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { agendaEvents, contacts, integrations, type AgendaEvent } from "@/db/schema";
import { googleApi } from "@/lib/google";
import { agendaEventBody } from "@/lib/google-sync";
import { eq } from "drizzle-orm";

type GoogleEventWithMeet = { id?: string; etag?: string; hangoutLink?: string };

/** Google Calendar conectado (necessário para gerar o Meet) */
export async function calendarIntegration() {
  const [cal] = await (await getDb()).select().from(integrations).where(eq(integrations.provider, "google_calendar"));
  return cal?.connected ? cal : null;
}

/**
 * Gera o link do Google Meet para a reunião: cria o evento no Google Calendar já com a
 * videochamada (ou acrescenta a um evento que já estava lá) e guarda o link.
 */
export async function ensureMeet(ev: AgendaEvent): Promise<AgendaEvent> {
  if (ev.meetUrl) return ev;
  const cal = await calendarIntegration();
  if (!cal) throw new Error("Conecte o Google Calendar em Configurações para gerar o Meet.");
  const [contact] = ev.contactId ? await (await getDb()).select().from(contacts).where(eq(contacts.id, ev.contactId)) : [];
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendarId || "primary")}/events`;
  const conferenceData = { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
  const remote = ev.googleEventId
    ? await googleApi<GoogleEventWithMeet>(cal, `${base}/${encodeURIComponent(ev.googleEventId)}?conferenceDataVersion=1&sendUpdates=all`, {
        method: "PATCH",
        // Corpo completo: leva junto o que mudou aqui (título, horário) desde a última sincronização
        body: JSON.stringify({ ...agendaEventBody(ev, contact ?? null), conferenceData }),
      })
    : await googleApi<GoogleEventWithMeet>(cal, `${base}?conferenceDataVersion=1&sendUpdates=all`, {
        method: "POST",
        body: JSON.stringify({ ...agendaEventBody(ev, contact ?? null), conferenceData }),
      });
  if (!remote.hangoutLink) throw new Error("O Google não devolveu o link do Meet. Tente de novo em instantes.");
  const [row] = await (await getDb())
    .update(agendaEvents)
    .set({ meetUrl: remote.hangoutLink, googleEventId: remote.id, googleEtag: remote.etag, googleSyncedAt: new Date() })
    .where(eq(agendaEvents.id, ev.id))
    .returning();
  return row;
}
