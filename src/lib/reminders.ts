import "server-only";
import { getDb } from "@/db";
import { activities, agendaEvents, contacts, properties, visits } from "@/db/schema";
import { getMessages, getReminderSettings } from "@/lib/features";
import { waCardText } from "@/lib/messages";
import { forLine, getWhatsAppConfig, MAIN_LINE, sendText, whatsappReady } from "@/lib/whatsapp";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";

const TZ = "America/Sao_Paulo";
const dateBR = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const timeBR = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const first = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/**
 * Lembretes por WhatsApp das visitas, reuniões e eventos que começam dentro da antecedência
 * configurada. Cada horário recebe um lembrete só (reagendar libera outro). Sai pelo número
 * principal; sem WhatsApp configurado ou com os lembretes desligados, não faz nada.
 */
export async function runReminders() {
  const settings = await getReminderSettings();
  if (!settings.enabled) return { sent: 0, skipped: "desligado" };
  const cfg = await getWhatsAppConfig();
  if (!whatsappReady(cfg)) return { sent: 0, skipped: "sem WhatsApp" };
  const line = forLine(cfg, MAIN_LINE);
  const msgs = await getMessages();
  const now = new Date();
  const until = new Date(now.getTime() + settings.hoursBefore * 3600_000);
  const db = await getDb();
  let sent = 0;
  const errors: string[] = [];

  const dueVisits = await db
    .select({ visit: visits, contact: contacts, property: properties })
    .from(visits)
    .innerJoin(contacts, eq(visits.contactId, contacts.id))
    .innerJoin(properties, eq(visits.propertyId, properties.id))
    .where(
      and(
        inArray(visits.status, ["agendada", "confirmada"]),
        isNull(visits.remindedAt),
        gt(visits.scheduledAt, now),
        lte(visits.scheduledAt, until),
      ),
    );
  for (const { visit, contact, property } of dueVisits) {
    if ((contact.phone ?? "").replace(/\D/g, "").length < 10) continue;
    const when = new Date(visit.scheduledAt);
    const text = waCardText(msgs.remindVisit, {
      nome: contact.name,
      primeiro_nome: first(contact.name),
      data: dateBR(when),
      hora: timeBR(when),
      imovel: property.title,
      codigo: property.code,
      // Rua só se o imóvel tiver; senão bairro e cidade
      endereco: [property.street, property.neighborhood, property.city].filter(Boolean).join(", "),
    });
    try {
      await sendText(line, contact.phone, text, "Lembrete automático");
      await db.update(visits).set({ remindedAt: new Date() }).where(eq(visits.id, visit.id));
      await db.insert(activities).values({
        entity: "contato",
        entityId: contact.id,
        kind: "whatsapp",
        text: `Lembrete da visita (${property.code}) enviado pelo WhatsApp.`,
      });
      sent++;
    } catch (e) {
      errors.push(`visita ${visit.id}: ${e instanceof Error ? e.message : "falha"}`);
    }
  }

  const dueEvents = await db
    .select({ event: agendaEvents, contact: contacts })
    .from(agendaEvents)
    .innerJoin(contacts, eq(agendaEvents.contactId, contacts.id))
    .where(
      and(
        eq(agendaEvents.status, "agendado"),
        isNull(agendaEvents.remindedAt),
        gt(agendaEvents.startsAt, now),
        lte(agendaEvents.startsAt, until),
      ),
    );
  for (const { event, contact } of dueEvents) {
    if ((contact.phone ?? "").replace(/\D/g, "").length < 10) continue;
    const when = new Date(event.startsAt);
    const text = waCardText(msgs.remindEvent, {
      nome: contact.name,
      primeiro_nome: first(contact.name),
      data: dateBR(when),
      hora: timeBR(when),
      titulo: event.title,
      tipo: event.kind === "evento" ? "Evento" : "Reunião",
      local: event.location ?? "",
    });
    try {
      await sendText(line, contact.phone, text, "Lembrete automático");
      await db.update(agendaEvents).set({ remindedAt: new Date() }).where(eq(agendaEvents.id, event.id));
      sent++;
    } catch (e) {
      errors.push(`evento ${event.id}: ${e instanceof Error ? e.message : "falha"}`);
    }
  }

  if (errors.length) console.error("[lembretes]", errors.join("; "));
  return { sent, errors: errors.length };
}
