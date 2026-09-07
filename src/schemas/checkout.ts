import { z } from "zod";

import { isValidStateCode, stateNameForCode } from "@/lib/in-states";

/**
 * Checkout input validation (master §7.1). The server recomputes the quote and
 * never trusts client prices; these schemas only shape and bound the request.
 */

const phone = z
  .string()
  .trim()
  .min(8, "Enter a valid phone number")
  .max(20)
  .regex(/^[+0-9 \-()]+$/, "Enter a valid phone number");

export const addressSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone,
  line1: z.string().trim().min(1, "Address is required").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(120),
  stateCode: z
    .string()
    .trim()
    .refine(isValidStateCode, "Choose a state"),
  postcode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a 6-digit PIN code"),
  country: z.literal("IN").default("IN"),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

export const paymentMethodSchema = z.enum(["PREPAID_RAZORPAY", "COD"]);

export const prepareCheckoutSchema = z.object({
  lines: z.array(checkoutLineSchema).min(1, "Your cart is empty").max(50),
  paymentMethod: paymentMethodSchema,
  destinationStateCode: z.string().trim().refine(isValidStateCode, "Choose a state"),
  destinationPostcode: z.string().trim().regex(/^[1-9][0-9]{5}$/),
});

export const placeCheckoutSchema = z.object({
  idempotencyKey: z.string().min(8).max(200),
  lines: z.array(checkoutLineSchema).min(1).max(50),
  paymentMethod: paymentMethodSchema,
  email: z.string().email().max(200).optional().or(z.literal("")),
  contactPhone: phone,
  billing: addressSchema,
  shipping: addressSchema,
  clientQuoteHash: z.string().min(8).max(128),
  source: z.string().max(60).optional(),
});

export type PlaceCheckoutInput = z.infer<typeof placeCheckoutSchema>;

/** Add the derived `stateName` to a validated address. */
export function withStateName(a: AddressInput) {
  return {
    ...a,
    line2: a.line2 || null,
    landmark: a.landmark || null,
    stateName: stateNameForCode(a.stateCode) ?? a.stateCode,
  };
}
