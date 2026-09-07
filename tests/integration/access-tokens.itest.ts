import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { ResourceNotFoundError } from "../../src/server/auth/errors";
import {
  issueOrderAccessToken,
  revokeOrderAccessToken,
  verifyOrderAccessToken,
} from "../../src/server/orders/access-tokens";
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

async function makeOrder() {
  return db.order.create({
    data: {
      orderNumber: `O-${randomUUID().slice(0, 8)}`,
      contactPhone: "+910000000000",
      paymentMethod: "PREPAID_RAZORPAY",
      subtotalPaise: 1000,
      totalPaise: 1000,
    },
  });
}

describe("guest order access tokens", () => {
  it("issues a plaintext token once and stores only its hash", async () => {
    const order = await makeOrder();
    const { id, token } = await issueOrderAccessToken(db, {
      orderId: order.id,
      scope: "ORDER_VIEW",
      ttlSeconds: 3600,
    });

    const row = await db.orderAccessToken.findUniqueOrThrow({ where: { id } });
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies a correct token + scope and returns the order id", async () => {
    const order = await makeOrder();
    const { token } = await issueOrderAccessToken(db, {
      orderId: order.id,
      scope: "ORDER_VIEW",
      ttlSeconds: 3600,
    });

    await expect(
      verifyOrderAccessToken(db, { token, scope: "ORDER_VIEW" }),
    ).resolves.toEqual({ orderId: order.id });

    await expect(
      verifyOrderAccessToken(db, {
        token,
        scope: "ORDER_VIEW",
        orderId: order.id,
      }),
    ).resolves.toEqual({ orderId: order.id });
  });

  it("gives a generic 'not found' for wrong token, wrong scope, wrong order", async () => {
    const order = await makeOrder();
    const { token } = await issueOrderAccessToken(db, {
      orderId: order.id,
      scope: "ORDER_VIEW",
      ttlSeconds: 3600,
    });

    for (const call of [
      verifyOrderAccessToken(db, { token: "garbage", scope: "ORDER_VIEW" }),
      verifyOrderAccessToken(db, { token, scope: "INVOICE_DOWNLOAD" }),
      verifyOrderAccessToken(db, {
        token,
        scope: "ORDER_VIEW",
        orderId: randomUUID(),
      }),
    ]) {
      await expect(call).rejects.toBeInstanceOf(ResourceNotFoundError);
    }
  });

  it("rejects an expired token", async () => {
    const order = await makeOrder();
    const { token } = await issueOrderAccessToken(db, {
      orderId: order.id,
      scope: "TRACKING_VIEW",
      ttlSeconds: -1,
    });
    await expect(
      verifyOrderAccessToken(db, { token, scope: "TRACKING_VIEW" }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("rejects a revoked token", async () => {
    const order = await makeOrder();
    const { id, token } = await issueOrderAccessToken(db, {
      orderId: order.id,
      scope: "ORDER_VIEW",
      ttlSeconds: 3600,
    });
    await revokeOrderAccessToken(db, id);
    await expect(
      verifyOrderAccessToken(db, { token, scope: "ORDER_VIEW" }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
