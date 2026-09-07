# Deferred Scope

Explicitly **out** of the MVP (master specification §11). Recorded so they are not accidentally built, and so schema/interface seams are left where the spec asks for them.

| Item | Treatment in MVP | Seam to preserve |
| --- | --- | --- |
| **Cashfree payments** | Not implemented. Razorpay only. | Provider-neutral payment interface (create-order / verify-checkout / verify-webhook / fetch-reconcile / create-refund / fetch-refund). Cashfree is an interface-compatible future adapter, labelled **disabled** — never a fake working integration. |
| **SMS notifications** | Disabled. | Notification channel abstraction supports WhatsApp + email + admin in-app; SMS slot left in the channel matrix, off. |
| **Wishlist / favourites** | Not built. | — |
| **Loyalty / rewards** | Not built. | — |
| **Product reviews / ratings** | Not built. Do **not** invent reviews or review structured data. | — |
| **Advanced promotions / coupons / campaigns** | Not built. Discounts exist only as deterministic line allocations on an order, not a promo engine. | Discount allocation snapshots on `OrderItem`. |
| **Preorders / backorders** | Not built. Out-of-stock = not purchasable. | Publication status vs derived availability already separated. |
| **Multi-warehouse / complex fulfilment routing** | Not built. Single pickup location. | `Shipment` / `ShipmentItem` schema is split-ready (one initial shipment in UI). |
| **Advanced admin roles / granular permissions** | Not built. Only `OWNER` and `ADMIN` + active flag. | `AdminUser.role` enum; guards call `requireAdmin()` / ownership checks. |
| **Margin-scheme GST (`SECOND_HAND_MARGIN`)** | Reserved in schema/strategy, **disabled** in checkout. Not inferred from acquisition cost. | `TaxClass.treatment` enum includes it; tax service strategy dispatch leaves the slot. |
| **Real-time admin (WebSockets/SSE)** | Not built. Modest polling with visibility-aware backoff. | Polling hooks, not a socket layer. |
| **Split shipments UI** | One-shipment UI initially. | `ShipmentItem` per-order-item quantities modelled from the start. |
| **Native mobile app** | Out of scope. Mobile-first responsive web only. | — |

## Providers that may block "production ready"

If any of these cannot be configured with real credentials + (where applicable) a supported test mode, the relevant AC is recorded `blocked` and full production readiness is **not** declared:

- Shiprocket test/sandbox mode (AC-13) — currently unconfirmed.
- Razorpay live configuration (AC-06/08/09).
- WhatsApp approved templates + Resend verified sender (AC-14).
- Owner-confirmed GST/legal/invoice configuration (AC-11, launch checklist).
