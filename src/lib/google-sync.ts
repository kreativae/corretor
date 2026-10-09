import "server-only";

import { db } from "@/db";
import {
  activities,
  contacts,
  integrations,
  properties,
  visits,
  type Contact,
  type Integration,
  type Property,
  type Visit,
} from "@/db/schema";
import { GoogleApiError, googleApi } from "@/lib/google";
import { eq } from "drizzle-orm";

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

function googlePersonBody(contact: Contact, etag?: string | null) {
  const parts = contact.name.trim().split(/\s+/);
  const givenName = parts.shift() ?? contact.name;
  const familyName = parts.join(" ");
  const body: Record<string, unknown> = {
    names: [{ givenName, familyName }],
  };
  if (contact.googleResourceName) body.resourceName = contact.googleResourceName;
  if (contact.email) body.emailAddresses = [{ value: contact.email }];
  if (contact.phone) body.phoneNumbers = [{ value: contact.phone }];
  if (etag) {
    body.etag = etag;
    body.metadata = { sources: [{ type: "CONTACT", etag }] };
  }
  return body;
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
      return { people, nextSyncToken };
    } catch (error) {
      if (error instanceof GoogleApiError && error.status === 410 && useCursor) {
        useCursor = false;
        continue;
      }
      throw error;
    }
  }
  return { people, nextSyncToken };
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
    errors: [],
  };
  const startedAt = new Date();
  const locals = await db.select().from(contacts);
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

  const { people, nextSyncToken } = await listGooglePeople(integration);
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
        if (local) {
          await db
            .update(contacts)
            .set({
              googleResourceName: null,
              googleEtag: null,
              googleRemoteUpdatedAt: null,
              googleSyncedAt: startedAt,
            })
            .where(eq(contacts.id, local.id));
          handled.add(local.id);
        }
        continue;
      }

      const remoteUpdated = source?.updateTime ? new Date(source.updateTime) : startedAt;
      const remoteEtag = source?.etag || person.etag || null;

      if (!local) {
        const [created] = await db
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
        const updated = await googleApi<GooglePerson>(
          integration,
          `https://people.googleapis.com/v1/${person.resourceName}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers&personFields=names,emailAddresses,phoneNumbers,metadata`,
          {
            method: "PATCH",
            body: JSON.stringify(googlePersonBody(local, remoteEtag)),
          },
        );
        const newSource = personSource(updated);
        await db
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
        await db
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
        await db
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
      if (local.googleResourceName) {
        const localChanged =
          local.updatedAt.getTime() > (local.googleSyncedAt?.getTime() ?? 0) + 1000;
        if (!localChanged) {
          result.unchanged += 1;
          continue;
        }
        const updated = await googleApi<GooglePerson>(
          integration,
          `https://people.googleapis.com/v1/${local.googleResourceName}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers&personFields=names,emailAddresses,phoneNumbers,metadata`,
          {
            method: "PATCH",
            body: JSON.stringify(googlePersonBody(local, local.googleEtag)),
          },
        );
        const source = personSource(updated);
        await db
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
      await db
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
  await db
    .update(integrations)
    .set({
      syncCursor: nextSyncToken ?? integration.syncCursor,
      lastSyncAt: startedAt,
      lastSyncCount: processed,
      statusMessage: `${result.pulled} recebidos · ${result.pushed} enviados${result.errors.length ? ` · ${result.errors.length} erros` : ""}.`,
    })
    .where(eq(integrations.id, integration.id));

  await db.insert(activities).values({
    entity: "sistema",
    entityId: null,
    kind: "sync",
    text: `Google Contacts: ${result.pulled} recebidos, ${result.pushed} enviados${result.errors.length ? `, ${result.errors.length} erros` : ""}.`,
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

/** Sincronização bidirecional das visitas com o Google Calendar. */
export async function syncGoogleCalendar(
  integration: Integration,
): Promise<GoogleSyncResult> {
  const result: GoogleSyncResult = {
    provider: integration.provider,
    pulled: 0,
    pushed: 0,
    unchanged: 0,
    errors: [],
  };
  const startedAt = new Date();
  const rows = await db
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
        await db
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
            await db
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
          await db
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
          await db
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
        await db
          .update(visits)
          .set({
            ...(remoteStart && !Number.isNaN(remoteStart.getTime())
              ? { scheduledAt: remoteStart, updatedAt: new Date(remote.updated!) }
              : {}),
            ...(remote.status === "cancelled" ? { status: "cancelada" as const } : {}),
            googleEtag: remote.etag,
            googleSyncedAt: startedAt,
          })
          .where(eq(visits.id, visit.id));
        result.pulled += 1;
      } else {
        await db
          .update(visits)
          .set({ googleEtag: remote.etag, googleSyncedAt: startedAt })
          .where(eq(visits.id, visit.id));
        result.unchanged += 1;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Erro em evento Google");
    }
  }

  const processed = result.pulled + result.pushed + result.unchanged;
  await db
    .update(integrations)
    .set({
      lastSyncAt: startedAt,
      lastSyncCount: processed,
      statusMessage: `${result.pulled} recebidos · ${result.pushed} enviados${result.errors.length ? ` · ${result.errors.length} erros` : ""}.`,
    })
    .where(eq(integrations.id, integration.id));
  await db.insert(activities).values({
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
