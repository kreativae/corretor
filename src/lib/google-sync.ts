import "server-only";

import { getDb } from "@/db";
import {
  activities,
  agendaEvents,
  contacts,
  deals,
  integrations,
  properties,
  visits,
  type AgendaEvent,
  type Contact,
  type Integration,
  type Property,
  type Visit,
} from "@/db/schema";
import { GoogleApiError, googleApi } from "@/lib/google";
import { count, eq } from "drizzle-orm";

/* ─────────────────────────── Tipos Google ─────────────────────────── */

type GooglePerson = {
  resourceName?: string;
  etag?: string;
  names?: { displayName?: string; givenName?: string; familyName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string }[];
  metadata?: {
    deleted?: boolean;
    sources?: { type?: string; etag?: string; updateTime?: string }[];
  };
};

type ConnectionsResponse = {
  connections?: GooglePerson[];
  nextPageToken?: string;
  nextSyncToken?: string;
  totalPeople?: number;
};

type GoogleEvent = {
  id?: string;
  etag?: string;
  status?: "confirmed" | "cancelled" | "tentative";
  summary?: string;
  description?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
};

export type GoogleSyncResult = {
  provider: string;
  pulled: number;
  pushed: number;
  unchanged: number;
  removed: number;
  errors: string[];
};

function normalizedPhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
}

function personSource(person: GooglePerson) {
  return person.metadata?.sources?.find((s) => s.type === "CONTACT") ??
    person.metadata?.sources?.[0];
}

function personValues(person: GooglePerson) {
  return {
    name:
      person.names?.[0]?.displayName ||
      [person.names?.[0]?.givenName, person.names?.[0]?.familyName]
        .filter(Boolean)
        .join(" ") ||
      "Contato Google",
    email: person.emailAddresses?.[0]?.value?.trim().toLowerCase() || null,
    phone: person.phoneNumbers?.[0]?.value?.trim() || "",
  };
}

function googlePersonBody(contact: Contact, current?: GooglePerson) {
  const parts = contact.name.trim().split(/\s+/);
  const givenName = parts.shift() ?? contact.name;
  const familyName = parts.join(" ");
  const body: Record<string, unknown> = {
    names: [{ givenName, familyName }],
  };
  if (contact.googleResourceName) body.resourceName = contact.googleResourceName;
  if (contact.email) body.emailAddresses = [{ value: contact.email }];
  if (contact.phone) body.phoneNumbers = [{ value: contact.phone }];
  // updateContact exige o etag da pessoa e o da fonte CONTACT, que são diferentes.
  if (current) {
    body.etag = current.etag;
    const source = personSource(current);
    if (source) body.metadata = { sources: [{ type: source.type, etag: source.etag }] };
  }
  return body;
}

const PERSON_FIELDS = "names,emailAddresses,phoneNumbers,metadata";

/** Envia o contato do CRM ao Google. Lê a pessoa na hora para ter os ETags atuais e
 * tenta de novo uma vez se ela mudou entre a leitura e a gravação. */
async function updateGooglePerson(
  integration: Integration,
  resourceName: string,
  local: Contact,
) {
  for (let attempt = 0; ; attempt++) {
    const current = await googleApi<GooglePerson>(
      integration,
      `https://people.googleapis.com/v1/${resourceName}?personFields=metadata`,
    );
    try {
      return await googleApi<GooglePerson>(
        integration,
        `https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers&personFields=${PERSON_FIELDS}`,
        { method: "PATCH", body: JSON.stringify(googlePersonBody(local, current)) },
      );
    } catch (error) {
      const stale =
        error instanceof GoogleApiError && error.status === 400 && /etag/i.test(error.message);
      if (!stale || attempt > 0) throw error;
    }
  }
}

async function listGooglePeople(integration: Integration) {
  const people: GooglePerson[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  let useCursor = !!integration.syncCursor;

  // Sync token expira em 7 dias. Em 410, refazemos uma sincronização completa.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      people.length = 0;
      pageToken = undefined;
      nextSyncToken = undefined;
      do {
        const params = new URLSearchParams({
          personFields: "names,emailAddresses,phoneNumbers,metadata",
          pageSize: "1000",
          requestSyncToken: "true",
          sources: "READ_SOURCE_TYPE_CONTACT",
        });
        if (useCursor && integration.syncCursor) {
          params.set("syncToken", integration.syncCursor);
        }
        if (pageToken) params.set("pageToken", pageToken);

        const data = await googleApi<ConnectionsResponse>(
          integration,
          `https://people.googleapis.com/v1/people/me/connections?${params}`,
        );
        people.push(...(data.connections ?? []));
        pageToken = data.nextPageToken;
        if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
      } while (pageToken);
      return { people, nextSyncToken, full: !useCursor };
    } catch (error) {
      if (error instanceof GoogleApiError && error.status === 410 && useCursor) {
        useCursor = false;
        continue;
      }
      throw error;
    }
  }
  return { people, nextSyncToken, full: !useCursor };
}

/**
 * Contato apagado no Google: remove do CRM, a menos que tenha negociações
 * ou visitas — nesse caso só desfaz o vínculo para preservar o histórico.
 * Em ambos os casos o contato não é recriado no Google.
 */
async function removeDeletedGoogleContact(local: Contact, syncedAt: Date) {
  const [[d], [v]] = await Promise.all([
    (await getDb()).select({ n: count() }).from(deals).where(eq(deals.contactId, local.id)),
    (await getDb()).select({ n: count() }).from(visits).where(eq(visits.contactId, local.id)),
  ]);
  if (!d.n && !v.n) {
    await (await getDb()).delete(contacts).where(eq(contacts.id, local.id));
    return true;
  }
  await (await getDb())
    .update(contacts)
    .set({
      googleResourceName: null,
      googleEtag: null,
      googleRemoteUpdatedAt: null,
      googleSyncedAt: syncedAt,
    })
    .where(eq(contacts.id, local.id));
  return false;
}

/** Sincronização bidirecional Google Contacts ↔ agenda do CRM. */
export async function syncGoogleContacts(
  integration: Integration,
): Promise<GoogleSyncResult> {
  const result: GoogleSyncResult = {
    provider: integration.provider,
    pulled: 0,
    pushed: 0,
    unchanged: 0,
    removed: 0,
    errors: [],
  };
  const startedAt = new Date();
  const locals = await (await getDb()).select().from(contacts);
  const byResource = new Map(
    locals
      .filter((c) => c.googleResourceName)
      .map((c) => [c.googleResourceName as string, c]),
  );
  const byPhone = new Map(
    locals.filter((c) => c.phone).map((c) => [normalizedPhone(c.phone), c]),
  );
  const byEmail = new Map(
    locals
      .filter((c) => c.email)
      .map((c) => [c.email!.trim().toLowerCase(), c]),
  );

  const { people, nextSyncToken, full } = await listGooglePeople(integration);
  const remoteIds = new Set(
    people.filter((p) => !p.metadata?.deleted).map((p) => p.resourceName),
  );
  const handled = new Set<string>();

  // People API recomenda mutações sequenciais para o mesmo usuário.
  for (const person of people) {
    try {
      if (!person.resourceName) continue;
      const source = personSource(person);
      const values = personValues(person);
      let local =
        byResource.get(person.resourceName) ||
        (values.phone ? byPhone.get(normalizedPhone(values.phone)) : undefined) ||
        (values.email ? byEmail.get(values.email) : undefined);

      if (person.metadata?.deleted) {
        local = byResource.get(person.resourceName);
        if (local && !handled.has(local.id)) {
          handled.add(local.id);
          if (await removeDeletedGoogleContact(local, startedAt)) result.removed += 1;
        }
        continue;
      }

      const remoteUpdated = source?.updateTime ? new Date(source.updateTime) : startedAt;
      const remoteEtag = source?.etag || person.etag || null;

      if (!local) {
        const [created] = await (await getDb())
          .insert(contacts)
          .values({
            name: values.name,
            email: values.email,
            phone: values.phone,
            source: "google",
            googleResourceName: person.resourceName,
            googleEtag: remoteEtag,
            googleRemoteUpdatedAt: remoteUpdated,
            googleSyncedAt: startedAt,
            updatedAt: remoteUpdated,
          })
          .returning();
        handled.add(created.id);
        result.pulled += 1;
        continue;
      }

      handled.add(local.id);
      const syncedMs = local.googleSyncedAt?.getTime() ?? 0;
      const localMs = local.updatedAt.getTime();
      const remoteMs = remoteUpdated.getTime();
      const localChanged = localMs > syncedMs + 1000;
      const remoteChanged = remoteMs > syncedMs + 1000;

      // Alteração local mais recente: envia ao Google usando ETag atual.
      if (localChanged && (!remoteChanged || localMs > remoteMs)) {
        const updated = await updateGooglePerson(integration, person.resourceName, local);
        const newSource = personSource(updated);
        await (await getDb())
          .update(contacts)
          .set({
            googleResourceName: updated.resourceName ?? person.resourceName,
            googleEtag: newSource?.etag || updated.etag || remoteEtag,
            googleRemoteUpdatedAt: newSource?.updateTime
              ? new Date(newSource.updateTime)
              : startedAt,
            googleSyncedAt: startedAt,
          })
          .where(eq(contacts.id, local.id));
        result.pushed += 1;
      } else if (remoteChanged) {
        // Google mais recente: atualiza o CRM.
        await (await getDb())
          .update(contacts)
          .set({
            name: values.name,
            email: values.email,
            phone: values.phone,
            googleResourceName: person.resourceName,
            googleEtag: remoteEtag,
            googleRemoteUpdatedAt: remoteUpdated,
            googleSyncedAt: startedAt,
            updatedAt: remoteUpdated,
          })
          .where(eq(contacts.id, local.id));
        result.pulled += 1;
      } else {
        await (await getDb())
          .update(contacts)
          .set({
            googleResourceName: person.resourceName,
            googleEtag: remoteEtag,
            googleRemoteUpdatedAt: remoteUpdated,
            googleSyncedAt: startedAt,
          })
          .where(eq(contacts.id, local.id));
        result.unchanged += 1;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Erro em contato Google");
    }
  }

  // Segunda fase: envia alterações que existem apenas no CRM e cria os não mapeados.
  for (const local of locals) {
    if (handled.has(local.id)) continue;
    try {
      // Listagem completa: vinculado mas ausente no Google → foi apagado lá.
      if (full && local.googleResourceName && !remoteIds.has(local.googleResourceName)) {
        if (await removeDeletedGoogleContact(local, startedAt)) result.removed += 1;
        continue;
      }

      // Já sincronizado e sem vínculo → foi apagado no Google; não recriar.
      if (!local.googleResourceName && local.googleSyncedAt) {
        if (local.source === "google" && (await removeDeletedGoogleContact(local, startedAt))) {
          result.removed += 1;
        }
        continue;
      }

      if (local.googleResourceName) {
        const localChanged =
          local.updatedAt.getTime() > (local.googleSyncedAt?.getTime() ?? 0) + 1000;
        if (!localChanged) {
          result.unchanged += 1;
          continue;
        }
        const updated = await updateGooglePerson(integration, local.googleResourceName, local);
        const source = personSource(updated);
        await (await getDb())
          .update(contacts)
          .set({
            googleEtag: source?.etag || updated.etag || local.googleEtag,
            googleRemoteUpdatedAt: source?.updateTime
              ? new Date(source.updateTime)
              : startedAt,
            googleSyncedAt: startedAt,
          })
          .where(eq(contacts.id, local.id));
        result.pushed += 1;
        continue;
      }

      const created = await googleApi<GooglePerson>(
        integration,
        "https://people.googleapis.com/v1/people:createContact?personFields=names,emailAddresses,phoneNumbers,metadata",
        { method: "POST", body: JSON.stringify(googlePersonBody(local)) },
      );
      const source = personSource(created);
      await (await getDb())
        .update(contacts)
        .set({
          googleResourceName: created.resourceName,
          googleEtag: source?.etag || created.etag || null,
          googleRemoteUpdatedAt: source?.updateTime
            ? new Date(source.updateTime)
            : startedAt,
          googleSyncedAt: startedAt,
        })
        .where(eq(contacts.id, local.id));
      result.pushed += 1;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Erro ao enviar contato");
    }
  }

  const processed = result.pulled + result.pushed + result.unchanged;
  await (await getDb())
    .update(integrations)
    .set({
      syncCursor: nextSyncToken ?? integration.syncCursor,
      lastSyncAt: startedAt,
      lastSyncCount: processed,
      statusMessage: `${result.pulled} recebidos · ${result.pushed} enviados${result.removed ? ` · ${result.removed} removidos` : ""}${result.errors.length ? ` · ${result.errors.length} erros` : ""}.`,
    })
    .where(eq(integrations.id, integration.id));

  await (await getDb()).insert(activities).values({
    entity: "sistema",
    entityId: null,
    kind: "sync",
    text: `Google Contacts: ${result.pulled} recebidos, ${result.pushed} enviados${result.removed ? `, ${result.removed} removidos` : ""}${result.errors.length ? `, ${result.errors.length} erros` : ""}.`,
  });
  return result;
}

function calendarEventBody(
  visit: Visit,
  contact: Contact,
  property: Property,
) {
  const start = new Date(visit.scheduledAt);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    summary: `Visita · ${contact.name} · ${property.code}`,
    description: [
      `Visita gerenciada pelo ImobManager.`,
      `Cliente: ${contact.name} (${contact.phone})`,
      `Imóvel: ${property.title} (${property.code})`,
      `Status: ${visit.status}`,
      visit.feedback ? `Feedback: ${visit.feedback}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    location: [property.street, property.neighborhood, property.city]
      .filter(Boolean)
      .join(", "),
    start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
    end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
    attendees: contact.email ? [{ email: contact.email, displayName: contact.name }] : [],
    extendedProperties: {
      private: {
        imobVisitId: visit.id,
        imobContactId: contact.id,
        imobPropertyId: property.id,
      },
    },
  };
}

export function agendaEventBody(ev: AgendaEvent, contact: Contact | null) {
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : new Date(start.getTime() + 60 * 60_000);
  const kind = ev.kind === "evento" ? "Evento" : "Reunião";
  return {
    summary: contact ? `${kind} · ${ev.title} · ${contact.name}` : `${kind} · ${ev.title}`,
    description: [`${kind} da agenda do CRM.`, contact ? `Cliente: ${contact.name} (${contact.phone})` : null, ev.notes ? `Observações: ${ev.notes}` : null]
      .filter(Boolean)
      .join("\n"),
    location: ev.location ?? "",
    start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
    end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
    attendees: contact?.email ? [{ email: contact.email, displayName: contact.name }] : [],
    extendedProperties: { private: { imobEventId: ev.id } },
  };
}

/**
 * Eventos e reuniões da agenda no Google Calendar, nos dois sentidos (mesma regra das
 * visitas: quem mudou por último vence; cancelado sai do Google).
 */
async function syncAgendaEventsCalendar(
  integration: Integration,
  calendarId: string,
  startedAt: Date,
  result: GoogleSyncResult,
) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
  const rows = await (await getDb())
    .select({ ev: agendaEvents, contact: contacts })
    .from(agendaEvents)
    .leftJoin(contacts, eq(agendaEvents.contactId, contacts.id));
  const mark = async (id: string, set: Partial<typeof agendaEvents.$inferInsert>) =>
    (await getDb()).update(agendaEvents).set(set).where(eq(agendaEvents.id, id));

  for (const { ev, contact } of rows) {
    try {
      const create = async () => {
        const created = await googleApi<GoogleEvent>(integration, `${base}?sendUpdates=all`, {
          method: "POST",
          body: JSON.stringify(agendaEventBody(ev, contact)),
        });
        await mark(ev.id, { googleEventId: created.id, googleEtag: created.etag, googleSyncedAt: startedAt });
        result.pushed += 1;
      };
      if (!ev.googleEventId) {
        if (ev.status === "cancelado") result.unchanged += 1;
        else await create();
        continue;
      }
      let remote: GoogleEvent;
      try {
        remote = await googleApi<GoogleEvent>(integration, `${base}/${encodeURIComponent(ev.googleEventId)}`);
      } catch (error) {
        // Apagado no Google: recria se ainda vale aqui
        if (error instanceof GoogleApiError && [404, 410].includes(error.status)) {
          if (ev.status !== "cancelado") await create();
          continue;
        }
        throw error;
      }
      const syncedMs = ev.googleSyncedAt?.getTime() ?? 0;
      const localMs = ev.updatedAt.getTime();
      const remoteMs = remote.updated ? new Date(remote.updated).getTime() : 0;
      const localChanged = localMs > syncedMs + 1000;
      const remoteChanged = remoteMs > syncedMs + 1000;
      const url = `${base}/${encodeURIComponent(ev.googleEventId)}?sendUpdates=all`;

      if (localChanged && (!remoteChanged || localMs > remoteMs)) {
        if (ev.status === "cancelado") {
          await googleApi<Record<string, never>>(integration, url, { method: "DELETE" });
          await mark(ev.id, { googleSyncedAt: startedAt });
        } else {
          const updated = await googleApi<GoogleEvent>(integration, url, {
            method: "PATCH",
            body: JSON.stringify(agendaEventBody(ev, contact)),
            headers: remote.etag ? { "If-Match": remote.etag } : undefined,
          });
          await mark(ev.id, { googleEtag: updated.etag, googleSyncedAt: startedAt });
        }
        result.pushed += 1;
      } else if (remoteChanged) {
        const rs = remote.start?.dateTime ? new Date(remote.start.dateTime) : null;
        const re = remote.end?.dateTime ? new Date(remote.end.dateTime) : null;
        const validStart = rs && !Number.isNaN(rs.getTime()) ? rs : null;
        await mark(ev.id, {
          ...(validStart ? { startsAt: validStart, updatedAt: new Date(remote.updated!) } : {}),
          ...(re && !Number.isNaN(re.getTime()) && ev.endsAt ? { endsAt: re } : {}),
          ...(remote.status === "cancelled" ? { status: "cancelado" as const } : {}),
          // Mudou o horário no Google: o lembrete sai de novo
          ...(validStart && validStart.getTime() !== ev.startsAt.getTime() ? { remindedAt: null } : {}),
          googleEtag: remote.etag,
          googleSyncedAt: startedAt,
        });
        result.pulled += 1;
      } else {
        await mark(ev.id, { googleEtag: remote.etag, googleSyncedAt: startedAt });
        result.unchanged += 1;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Erro em evento Google");
    }
  }
}

/** Sincronização bidirecional das visitas com o Google Calendar. */
export async function syncGoogleCalendar(
  integration: Integration,
): Promise<GoogleSyncResult> {
  const result: GoogleSyncResult = {
    provider: integration.provider,
    pulled: 0,
    pushed: 0,
    unchanged: 0,
    removed: 0,
    errors: [],
  };
  const startedAt = new Date();
  const rows = await (await getDb())
    .select({ visit: visits, contact: contacts, property: properties })
    .from(visits)
    .innerJoin(contacts, eq(visits.contactId, contacts.id))
    .innerJoin(properties, eq(visits.propertyId, properties.id));
  const calendarId = encodeURIComponent(integration.calendarId || "primary");

  for (const row of rows) {
    const { visit, contact, property } = row;
    try {
      if (!visit.googleEventId) {
        if (visit.status === "cancelada") {
          result.unchanged += 1;
          continue;
        }
        const created = await googleApi<GoogleEvent>(
          integration,
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=all`,
          {
            method: "POST",
            body: JSON.stringify(calendarEventBody(visit, contact, property)),
          },
        );
        await (await getDb())
          .update(visits)
          .set({
            googleEventId: created.id,
            googleEtag: created.etag,
            googleSyncedAt: startedAt,
          })
          .where(eq(visits.id, visit.id));
        result.pushed += 1;
        continue;
      }

      let remote: GoogleEvent;
      try {
        remote = await googleApi<GoogleEvent>(
          integration,
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(visit.googleEventId)}`,
        );
      } catch (error) {
        if (error instanceof GoogleApiError && [404, 410].includes(error.status)) {
          if (visit.status !== "cancelada") {
            const created = await googleApi<GoogleEvent>(
              integration,
              `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=all`,
              {
                method: "POST",
                body: JSON.stringify(calendarEventBody(visit, contact, property)),
              },
            );
            await (await getDb())
              .update(visits)
              .set({
                googleEventId: created.id,
                googleEtag: created.etag,
                googleSyncedAt: startedAt,
              })
              .where(eq(visits.id, visit.id));
            result.pushed += 1;
          }
          continue;
        }
        throw error;
      }

      const syncedMs = visit.googleSyncedAt?.getTime() ?? 0;
      const localMs = visit.updatedAt.getTime();
      const remoteMs = remote.updated ? new Date(remote.updated).getTime() : 0;
      const localChanged = localMs > syncedMs + 1000;
      const remoteChanged = remoteMs > syncedMs + 1000;

      if (localChanged && (!remoteChanged || localMs > remoteMs)) {
        if (visit.status === "cancelada") {
          await googleApi<Record<string, never>>(
            integration,
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(visit.googleEventId)}?sendUpdates=all`,
            { method: "DELETE" },
          );
          await (await getDb())
            .update(visits)
            .set({ googleSyncedAt: startedAt })
            .where(eq(visits.id, visit.id));
        } else {
          const updated = await googleApi<GoogleEvent>(
            integration,
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(visit.googleEventId)}?sendUpdates=all`,
            {
              method: "PATCH",
              body: JSON.stringify(calendarEventBody(visit, contact, property)),
              headers: remote.etag ? { "If-Match": remote.etag } : undefined,
            },
          );
          await (await getDb())
            .update(visits)
            .set({
              googleEtag: updated.etag,
              googleSyncedAt: startedAt,
            })
            .where(eq(visits.id, visit.id));
        }
        result.pushed += 1;
      } else if (remoteChanged) {
        const remoteStart = remote.start?.dateTime
          ? new Date(remote.start.dateTime)
          : null;
        await (await getDb())
          .update(visits)
          .set({
            ...(remoteStart && !Number.isNaN(remoteStart.getTime())
              ? {
                  scheduledAt: remoteStart,
                  updatedAt: new Date(remote.updated!),
                  // Mudou o horário no Google: o lembrete sai de novo
                  ...(remoteStart.getTime() !== new Date(visit.scheduledAt).getTime() ? { remindedAt: null } : {}),
                }
              : {}),
            ...(remote.status === "cancelled" ? { status: "cancelada" as const } : {}),
            googleEtag: remote.etag,
            googleSyncedAt: startedAt,
          })
          .where(eq(visits.id, visit.id));
        result.pulled += 1;
      } else {
        await (await getDb())
          .update(visits)
          .set({ googleEtag: remote.etag, googleSyncedAt: startedAt })
          .where(eq(visits.id, visit.id));
        result.unchanged += 1;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Erro em evento Google");
    }
  }

  await syncAgendaEventsCalendar(integration, calendarId, startedAt, result);

  const processed = result.pulled + result.pushed + result.unchanged;
  await (await getDb())
    .update(integrations)
    .set({
      lastSyncAt: startedAt,
      lastSyncCount: processed,
      statusMessage: `${result.pulled} recebidos · ${result.pushed} enviados${result.errors.length ? ` · ${result.errors.length} erros` : ""}.`,
    })
    .where(eq(integrations.id, integration.id));
  await (await getDb()).insert(activities).values({
    entity: "sistema",
    entityId: null,
    kind: "sync",
    text: `Google Calendar: ${result.pulled} recebidos, ${result.pushed} enviados${result.errors.length ? `, ${result.errors.length} erros` : ""}.`,
  });
  return result;
}

export async function syncGoogleIntegration(integration: Integration) {
  if (!integration.connected) throw new Error("Conecte a conta Google primeiro.");
  if (integration.provider === "google_contacts") {
    return syncGoogleContacts(integration);
  }
  if (integration.provider === "google_calendar") {
    return syncGoogleCalendar(integration);
  }
  throw new Error("Esta integração não usa o sincronizador Google.");
}

/** Integrações Google com sincronização automática ligada e o intervalo vencido */
export async function syncDueIntegrations() {
  const candidates = (await (await getDb()).select().from(integrations)).filter(
    (item) => item.category === "google" && item.connected && item.autoSync,
  );
  const now = Date.now();
  const due = candidates.filter(
    (item) =>
      !item.lastSyncAt ||
      now - item.lastSyncAt.getTime() >= item.syncIntervalMin * 60_000,
  );

  const results: {
    provider: string;
    ok: boolean;
    pulled?: number;
    pushed?: number;
    error?: string;
  }[] = [];

  for (const integration of due) {
    try {
      const result = await syncGoogleIntegration(integration);
      results.push({
        provider: integration.provider,
        ok: result.errors.length === 0,
        pulled: result.pulled,
        pushed: result.pushed,
        ...(result.errors.length ? { error: result.errors.join("; ") } : {}),
      });
    } catch (error) {
      results.push({
        provider: integration.provider,
        ok: false,
        error: error instanceof Error ? error.message : "Falha desconhecida",
      });
    }
  }

  return { checked: candidates.length, synced: due.length, results };
}
