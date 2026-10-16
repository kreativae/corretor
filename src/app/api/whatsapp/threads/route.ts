import { getDb } from "@/db";
import { contacts, waThreads } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { lineFor } from "@/lib/whatsapp";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/** Conversas do número de quem está logado (mais recentes primeiro) */
export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { line } = await lineFor(user.id);
  const archived = new URL(req.url).searchParams.get("arquivadas") === "1";
  const rows = await (await getDb())
    .select({
      phone: waThreads.phone,
      contactId: waThreads.contactId,
      contactName: contacts.name,
      contactType: contacts.type,
      profileName: waThreads.profileName,
      lastMessage: waThreads.lastMessage,
      lastMessageAt: waThreads.lastMessageAt,
      lastInboundAt: waThreads.lastInboundAt,
      unread: waThreads.unread,
      archived: waThreads.archived,
    })
    .from(waThreads)
    .leftJoin(contacts, eq(contacts.id, waThreads.contactId))
    .where(and(eq(waThreads.line, line), eq(waThreads.archived, archived)))
    .orderBy(desc(waThreads.lastMessageAt))
    .limit(300);
  return NextResponse.json(rows);
}
