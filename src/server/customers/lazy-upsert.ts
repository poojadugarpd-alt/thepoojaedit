import "server-only";

import type { Customer, PrismaClient } from "@/generated/prisma";

import { normalizeEmail } from "./normalize";

/**
 * Lazy-create (or refresh) the Customer row for a verified Supabase identity,
 * keyed on the auth user id (master spec §9). Guests never reach this — they
 * have no auth id.
 */
export async function lazyUpsertCustomer(
  db: PrismaClient,
  identity: { authUserId: string; email: string | null },
): Promise<Customer> {
  const emailFields = identity.email
    ? { email: identity.email, emailNormalized: normalizeEmail(identity.email) }
    : {};

  return db.customer.upsert({
    where: { authUserId: identity.authUserId },
    update: emailFields,
    create: { authUserId: identity.authUserId, ...emailFields },
  });
}
