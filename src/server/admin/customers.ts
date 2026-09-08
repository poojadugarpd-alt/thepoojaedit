import "server-only";

import type { PrismaClient } from "@/generated/prisma";

import { auditLog } from "./audit";

/**
 * Admin customer reads + private notes (master §10). Search is over stored
 * contact fields — a match is NOT proof of ownership and never merges guest
 * orders (master §9). Notes are authored, immutable, and access-controlled by
 * the admin guard the caller runs.
 */

export interface CustomerListRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  orders: number;
  createdAt: Date;
}

export async function searchCustomers(
  db: PrismaClient,
  opts: { q?: string; limit?: number } = {},
): Promise<CustomerListRow[]> {
  const q = opts.q?.trim();
  const rows = await db.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { emailNormalized: { contains: q.toLowerCase() } },
            { phoneNormalized: { contains: q.replace(/\D/g, "") } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opts.limit ?? 25, 1), 100),
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    orders: r._count.orders,
    createdAt: r.createdAt,
  }));
}

export async function getCustomerDetail(db: PrismaClient, customerId: string) {
  return db.customer.findUnique({
    where: { id: customerId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          orderNumber: true,
          createdAt: true,
          orderStatus: true,
          paymentStatus: true,
          totalPaise: true,
          paymentMethod: true,
        },
      },
      notes: { orderBy: { createdAt: "desc" }, include: { author: true } },
      addresses: true,
    },
  });
}

export async function addCustomerNote(
  db: PrismaClient,
  input: { customerId: string; body: string; adminUserId: string },
): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new Error("Note cannot be empty.");
  await db.$transaction(async (tx) => {
    await tx.customerNote.create({
      data: { customerId: input.customerId, authorId: input.adminUserId, body },
    });
    await auditLog(tx, {
      adminUserId: input.adminUserId,
      action: "customer.note_added",
      entityType: "Customer",
      entityId: input.customerId,
      after: { length: body.length },
    });
  });
}
