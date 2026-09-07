/**
 * Contact normalisation. Normalised forms are for *search* only — a contact
 * match is a candidate, never proof of ownership (master spec §9).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Keep a leading `+`, drop everything that isn't a digit. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const prefix = trimmed.startsWith("+") ? "+" : "";
  return prefix + trimmed.replace(/\D/g, "");
}
