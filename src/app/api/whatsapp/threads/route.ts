import { db } from "@/db";
import { contacts, waThreads } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/** Lista de conversas (mais recentes primeiro) */
export async function GET(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const archived = new URL(req.url).searchParams.get("arquivadas") === "1";
  const rows = await db
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
    .where(eq(waThreads.archived, archived))
    .orderBy(desc(waThreads.lastMessageAt))
    .limit(300);
  return NextResponse.json(rows);
}
