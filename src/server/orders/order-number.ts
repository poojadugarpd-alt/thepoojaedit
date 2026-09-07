import { randomInt } from "node:crypto";

/**
 * Public order number: `PE-YYMMDD-XXXXXX` (Crockford base32, no I/L/O/U). It is
 * an identifier, not a credential (master §9). The caller writes it under the
 * `@@unique` constraint and retries on the rare collision.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateOrderNumber(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `PE-${yy}${mm}${dd}-${suffix}`;
}
