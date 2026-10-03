/**
 * Marketing attribution (UTM) captured at landing and stamped on the order.
 *
 * Edge-safe and dependency-free: the middleware calls `utmFromSearchParams` and
 * `serializeUtm`; the checkout action calls `parseUtmCookie`. Last touch wins —
 * any visit that carries a `utm_source` replaces the stored value — so a buyer
 * who first came from the bio link and then from a closet-drop story is
 * credited to the story.
 */

export const UTM_COOKIE = "tpe_utm";
export const UTM_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface Utm {
  source: string;
  medium: string | null;
  campaign: string | null;
}

const MAX_LEN = 64;
const ALLOWED = /^[a-z0-9._+-]+$/;

/** Lower-cases, trims and length-caps a tag; drops anything with odd characters. */
function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase().slice(0, MAX_LEN);
  return v && ALLOWED.test(v) ? v : null;
}

export function utmFromSearchParams(params: URLSearchParams): Utm | null {
  const source = clean(params.get("utm_source"));
  if (!source) return null;
  return {
    source,
    medium: clean(params.get("utm_medium")),
    campaign: clean(params.get("utm_campaign")),
  };
}

export function serializeUtm(utm: Utm): string {
  return [utm.source, utm.medium ?? "", utm.campaign ?? ""].join("|");
}

export function parseUtmCookie(raw: string | null | undefined): Utm | null {
  if (!raw) return null;
  const [source, medium, campaign] = raw.split("|");
  const s = clean(source);
  if (!s) return null;
  return { source: s, medium: clean(medium), campaign: clean(campaign) };
}
