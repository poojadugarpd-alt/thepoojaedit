/** Inventory invariant violations (master §7). */
export class InsufficientStockError extends Error {
  constructor(readonly variantId: string) {
    super(`Insufficient stock for variant ${variantId}`);
    this.name = "InsufficientStockError";
  }
}

export class ReservationNotActiveError extends Error {
  constructor(
    readonly reservationKey: string,
    readonly status: string,
  ) {
    super(`Reservation ${reservationKey} is ${status}, not ACTIVE`);
    this.name = "ReservationNotActiveError";
  }
}
