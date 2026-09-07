import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { AccessTokenScope, PrismaClient } from "@/generated/prisma";
import { ResourceNotFoundError } from "@/server/auth/errors";

/**
 * Guest access to an order / tracking / invoice (master spec §9).
 *
 * - The plaintext token is returned exactly once, at issue time.
 * - Only the SHA-256 hash is stored. Logs redact `token` (see src/lib/logger).
 * - Verification failures return a generic "not found" — never distinguish
 *   "wrong token" from "wrong scope" from "expired", to resist enumeration.
 * - An order number is an identifier, not a credential; it is never accepted
 *   here in place of a token.
 */
const TOKEN_BYTES = 32;

export function hashOrderToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueOrderAccessToken(
  db: PrismaClient,
  input: { orderId: string; scope: AccessTokenScope; ttlSeconds: number },
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);

  const row = await db.orderAccessToken.create({
    data: {
      orderId: input.orderId,
      tokenHash: hashOrderToken(token),
      scope: input.scope,
      expiresAt,
    },
    select: { id: true },
  });

  return { id: row.id, token, expiresAt };
}

export async function verifyOrderAccessToken(
  db: PrismaClient,
  input: { token: string; scope: AccessTokenScope; orderId?: string },
): Promise<{ orderId: string }> {
  const row = await db.orderAccessToken.findUnique({
    where: { tokenHash: hashOrderToken(input.token) },
  });

  const valid =
    row !== null &&
    row.scope === input.scope &&
    row.revokedAt === null &&
    row.expiresAt > new Date() &&
    (input.orderId === undefined || row.orderId === input.orderId);

  if (!valid) throw new ResourceNotFoundError();
  return { orderId: row.orderId };
}

export async function revokeOrderAccessToken(
  db: PrismaClient,
  tokenId: string,
): Promise<void> {
  await db.orderAccessToken.updateMany({
    where: { id: tokenId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
