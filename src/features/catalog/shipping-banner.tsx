/**
 * Moving banner at the top of the Closet page (owner, 2026-11-15):
 * "Shipping free above ₹3000", changed to ₹1000 on 2026-11-20. Pure CSS marquee: the message repeats and the
 * track slides left forever. It stops moving for anyone who prefers reduced
 * motion, and screen readers get the message once, not once per repeat.
 * Keep the amount in step with `fees.closetFreeAtPaise` (src/server/settings).
 */
const MESSAGE = "Shipping free above ₹1000";

export function ShippingBanner() {
  return (
    <div className="u-marquee" role="note" aria-label={MESSAGE}>
      <div className="u-marquee__track" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="u-marquee__item">
            {MESSAGE}
          </span>
        ))}
      </div>
    </div>
  );
}
