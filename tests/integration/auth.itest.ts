import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { bootstrapOwner } from "../../src/server/admin/bootstrap";
import {
  assertActiveAdmin,
  assertOwnsOrder,
  assertRole,
  resolveAdmin,
} from "../../src/server/admin/guards";
import {
  AuthorizationError,
  ResourceNotFoundError,
} from "../../src/server/auth/errors";
import { lazyUpsertCustomer } from "../../src/server/customers/lazy-upsert";
import { makeClient, resetDb } from "./helpers";

let db: PrismaClient;

beforeAll(() => {
  db = makeClient();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
});

describe("lazyUpsertCustomer", () => {
  it("creates on first sight, reuses on second, and refreshes email", async () => {
    const authUserId = randomUUID();

    const first = await lazyUpsertCustomer(db, { authUserId, email: "a@x.com" });
    expect(first.authUserId).toBe(authUserId);
    expect(first.emailNormalized).toBe("a@x.com");

    const second = await lazyUpsertCustomer(db, {
      authUserId,
      email: "A@X.com ",
    });
    expect(second.id).toBe(first.id);

    const third = await lazyUpsertCustomer(db, {
      authUserId,
      email: "new@x.com",
    });
    expect(third.id).toBe(first.id);
    expect(third.emailNormalized).toBe("new@x.com");

    expect(await db.customer.count()).toBe(1);
  });

  it("keeps distinct customers per auth id", async () => {
    await lazyUpsertCustomer(db, { authUserId: randomUUID(), email: null });
    await lazyUpsertCustomer(db, { authUserId: randomUUID(), email: null });
    expect(await db.customer.count()).toBe(2);
  });
});

describe("admin guards", () => {
  async function makeAdmin(
    overrides: Partial<{ isActive: boolean; role: "OWNER" | "ADMIN" }> = {},
  ) {
    const authUserId = randomUUID();
    await db.adminUser.create({
      data: {
        authUserId,
        email: `${authUserId}@x.com`,
        isActive: overrides.isActive ?? true,
        role: overrides.role ?? "ADMIN",
      },
    });
    return authUserId;
  }

  it("resolveAdmin returns null for an unknown auth id", async () => {
    expect(await resolveAdmin(db, randomUUID())).toBeNull();
  });

  it("assertActiveAdmin rejects null and inactive, passes active", async () => {
    expect(() => assertActiveAdmin(null)).toThrow(AuthorizationError);

    const inactive = await resolveAdmin(db, await makeAdmin({ isActive: false }));
    expect(() => assertActiveAdmin(inactive)).toThrow(AuthorizationError);

    const active = await resolveAdmin(db, await makeAdmin());
    expect(() => assertActiveAdmin(active)).not.toThrow();
  });

  it("assertRole enforces OWNER-only actions", async () => {
    const admin = await resolveAdmin(db, await makeAdmin({ role: "ADMIN" }));
    assertActiveAdmin(admin);
    expect(() => assertRole(admin, "OWNER")).toThrow(AuthorizationError);
    expect(() => assertRole(admin, "ADMIN", "OWNER")).not.toThrow();
  });
});

describe("assertOwnsOrder", () => {
  async function makeOrder(customerId: string | null) {
    return db.order.create({
      data: {
        orderNumber: `O-${randomUUID().slice(0, 8)}`,
        contactPhone: "+910000000000",
        paymentMethod: "COD",
        customerId,
        subtotalPaise: 1000,
        totalPaise: 1000,
      },
    });
  }

  it("passes for the owner", async () => {
    const c = await db.customer.create({ data: {} });
    const order = await makeOrder(c.id);
    await expect(assertOwnsOrder(db, c.id, order.id)).resolves.toBeUndefined();
  });

  it("is 'not found' for another customer's order", async () => {
    const owner = await db.customer.create({ data: {} });
    const other = await db.customer.create({ data: {} });
    const order = await makeOrder(owner.id);
    await expect(assertOwnsOrder(db, other.id, order.id)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });

  it("is 'not found' for a guest order and for a null customer", async () => {
    const guestOrder = await makeOrder(null);
    const c = await db.customer.create({ data: {} });
    await expect(assertOwnsOrder(db, c.id, guestOrder.id)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    await expect(assertOwnsOrder(db, null, guestOrder.id)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });
});

describe("bootstrapOwner — not a public escalation route", () => {
  const deps = () => ({ db, bootstrapToken: "s3cret" });

  it("rejects a wrong / missing token", async () => {
    await expect(
      bootstrapOwner(deps(), {
        authUserId: randomUUID(),
        email: "o@x.com",
        providedToken: "nope",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    await expect(
      bootstrapOwner(
        { db, bootstrapToken: undefined },
        { authUserId: randomUUID(), email: "o@x.com", providedToken: "nope" },
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("creates the first OWNER, then refuses once an admin exists", async () => {
    const owner = await bootstrapOwner(deps(), {
      authUserId: randomUUID(),
      email: "o@x.com",
      providedToken: "s3cret",
    });
    expect(owner.role).toBe("OWNER");
    expect(owner.isActive).toBe(true);

    await expect(
      bootstrapOwner(deps(), {
        authUserId: randomUUID(),
        email: "second@x.com",
        providedToken: "s3cret",
      }),
    ).rejects.toThrow(/already exists/i);
  });
});
