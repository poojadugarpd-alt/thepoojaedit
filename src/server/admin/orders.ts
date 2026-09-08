import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma";

/**
 * Admin order reads (master §10). Composition only — every state change goes
 * through the `orders` / `payments` / `shipping` / `refunds` / `returns` domain
 * services, never re-implemented here. Keyset pagination on `(createdAt, id)` is
 * stable under inserts.
 */

export interface OrderListFilter {
  q?: string;
  orderStatus?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  paymentMethod?: string;
  /** keyset cursor: `<iso>|<id>` of the last row from the previous page */
  cursor?: string;
  limit?: number;
}

export interface OrderListRow {
  id: string;
  orderNumber: string;
  createdAt: Date;
  placedAt: Date | null;
  contactPhone: string;
  contactEmail: string | null;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentMethod: string;
  totalPaise: number;
}

export interface OrderListPage {
  rows: OrderListRow[];
  nextCursor: string | null;
}

export async function listOrders(
  db: PrismaClient,
  filter: OrderListFilter = {},
): Promise<OrderListPage> {
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);

  const and: Prisma.OrderWhereInput[] = [];
  if (filter.orderStatus) and.push({ orderStatus: filter.orderStatus as never });
  if (filter.paymentStatus) and.push({ paymentStatus: filter.paymentStatus as never });
  if (filter.fulfillmentStatus)
    and.push({ fulfillmentStatus: filter.fulfillmentStatus as never });
  if (filter.paymentMethod) and.push({ paymentMethod: filter.paymentMethod as never });
  if (filter.q?.trim()) {
    const q = filter.q.trim();
    and.push({
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { contactPhone: { contains: q } },
        { contactEmail: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (filter.cursor?.includes("|")) {
    const [iso, id] = filter.cursor.split("|");
    const at = new Date(iso);
    // strictly "before" the cursor in (createdAt desc, id desc) order
    and.push({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] });
  }
  const where: Prisma.OrderWhereInput = and.length ? { AND: and } : {};

  const rows = await db.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      placedAt: true,
      contactPhone: true,
      contactEmail: true,
      orderStatus: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      paymentMethod: true,
      totalPaise: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
  };
}

export async function orderStatusCounts(
  db: PrismaClient,
): Promise<Record<string, number>> {
  const rows = await db.order.groupBy({ by: ["orderStatus"], _count: true });
  return Object.fromEntries(rows.map((r) => [r.orderStatus, r._count]));
}

const DETAIL_INCLUDE = {
  items: { orderBy: { createdAt: "asc" } },
  addresses: true,
  events: { orderBy: { createdAt: "asc" } },
  paymentAttempts: { orderBy: { createdAt: "asc" } },
  refunds: { orderBy: { createdAt: "asc" } },
  shipments: {
    orderBy: { createdAt: "asc" },
    include: { events: { orderBy: { occurredAt: "asc" } }, codRemittances: true },
  },
  invoices: true,
  returnRequests: {
    orderBy: { createdAt: "asc" },
    include: { items: { include: { orderItem: true } } },
  },
  codRemittances: true,
  customer: { include: { notes: { orderBy: { createdAt: "desc" }, include: { author: true } } } },
} as const;

export type AdminOrderDetail = Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export async function getAdminOrder(
  db: PrismaClient,
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  return db.order.findUnique({
    where: { orderNumber },
    include: DETAIL_INCLUDE,
  });
}
