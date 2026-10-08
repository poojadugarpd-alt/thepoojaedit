/**
 * Couriers used by hand when Shadowfax can't take a parcel (D-153). No API
 * integration: the owner books on the courier's own site, enters the AWB, and
 * the customer gets that courier's public tracking page by email.
 */

/** Pre-filled courier for orders Shadowfax couldn't book. */
export const DEFAULT_OTHER_COURIER = "Delhivery";

const TRACKING: Record<string, (awb: string) => string> = {
  delhivery: (awb) => `https://www.delhivery.com/track-v2/package/${awb}`,
};

/** Public tracking page for a courier we know, or null. */
export function courierTrackingUrl(courier: string, awb: string): string | null {
  const build = TRACKING[courier.trim().toLowerCase()];
  return build ? build(encodeURIComponent(awb.trim())) : null;
}
