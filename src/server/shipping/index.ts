import "server-only";

/**
 * Shipping boundary (master §2, §8). Phase 5 ships a typed TEST adapter,
 * visibly restricted to development; Phase 8 swaps in Shiprocket behind the same
 * interface. Provider calls always happen OUTSIDE the checkout transaction.
 */

export interface ShippingQuoteRequest {
  destinationPostcode: string;
  items: { weightGrams: number; quantity: number }[];
  paymentMethod: "PREPAID_RAZORPAY" | "COD";
  orderValuePaise: number;
}

export interface ShippingQuote {
  serviceable: boolean;
  shippingPaise: number;
  codAllowed: boolean;
  codFeePaise: number;
  /** Present only for the test adapter, so it can never be mistaken for real. */
  testAdapter?: true;
  reason?: string;
}

export interface ShippingPort {
  quote(req: ShippingQuoteRequest): Promise<ShippingQuote>;
}

/** Deterministic dev/test adapter. Not a real carrier. */
export class TestShippingAdapter implements ShippingPort {
  constructor(
    private readonly opts: {
      flatShippingPaise?: number;
      codFeePaise?: number;
      nonServiceablePostcodes?: string[];
      codDisallowedPostcodes?: string[];
      codMaxOrderValuePaise?: number;
      freeShippingThresholdPaise?: number;
    } = {},
  ) {}

  async quote(req: ShippingQuoteRequest): Promise<ShippingQuote> {
    const nonServiceable = this.opts.nonServiceablePostcodes ?? ["000000", "999999"];
    if (nonServiceable.includes(req.destinationPostcode)) {
      return {
        serviceable: false,
        shippingPaise: 0,
        codAllowed: false,
        codFeePaise: 0,
        testAdapter: true,
        reason: "postcode not serviceable (test adapter)",
      };
    }

    const flat = this.opts.flatShippingPaise ?? 10_000; // ₹100
    const freeThreshold = this.opts.freeShippingThresholdPaise ?? Infinity;
    const shippingPaise = req.orderValuePaise >= freeThreshold ? 0 : flat;

    const codDisallowed = this.opts.codDisallowedPostcodes ?? [];
    const codMax = this.opts.codMaxOrderValuePaise ?? 2_000_000; // ₹20,000
    const codAllowed =
      req.paymentMethod === "COD"
        ? !codDisallowed.includes(req.destinationPostcode) &&
          req.orderValuePaise <= codMax
        : true;

    return {
      serviceable: true,
      shippingPaise,
      codAllowed,
      codFeePaise: req.paymentMethod === "COD" ? (this.opts.codFeePaise ?? 3_000) : 0,
      testAdapter: true,
    };
  }
}
