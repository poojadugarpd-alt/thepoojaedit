import type { CatalogType } from "@/lib/catalog-routes";

/**
 * Per-item return-policy disclosure (master spec §4). Placeholder wording drawn
 * from the legacy stores; the real text becomes an owner-confirmed
 * StoreSettings value before live checkout (Phase 9/13).
 */
export function returnPolicyNote(catalog: CatalogType): string {
  return catalog === "THRIFT"
    ? "Final sale — thrift pieces are sold as-is and are not returnable or exchangeable."
    : "Returns & exchanges for size issues within 48 hours of delivery, with an unboxing video and original tags intact.";
}
