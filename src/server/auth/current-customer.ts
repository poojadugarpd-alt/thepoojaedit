import "server-only";

import type { Customer } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { lazyUpsertCustomer } from "@/server/customers/lazy-upsert";

import { AuthenticationError } from "./errors";
import { getVerifiedIdentity } from "./identity";

/** The signed-in customer (lazily created), or null for a guest. */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const identity = await getVerifiedIdentity();
  if (!identity) return null;
  return lazyUpsertCustomer(prisma, identity);
}

/** Same, but throws AuthenticationError instead of returning null. */
export async function requireCurrentCustomer(): Promise<Customer> {
  const customer = await getCurrentCustomer();
  if (!customer) throw new AuthenticationError();
  return customer;
}
