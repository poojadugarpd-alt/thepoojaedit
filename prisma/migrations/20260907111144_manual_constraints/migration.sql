-- Manual constraints the Prisma schema cannot express (master spec §5, §6, §7).
-- These are part of the schema contract; later migrations may only extend them.

-- ─────────────────── Inventory bounds (oversell guard) ───────────────────
ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_onhand_nonneg"      CHECK ("onHandQty" >= 0),
  ADD CONSTRAINT "ProductVariant_reserved_nonneg"    CHECK ("reservedQty" >= 0),
  ADD CONSTRAINT "ProductVariant_reserved_le_onhand" CHECK ("reservedQty" <= "onHandQty"),
  ADD CONSTRAINT "ProductVariant_lowstock_nonneg"    CHECK ("lowStockThreshold" >= 0),
  ADD CONSTRAINT "ProductVariant_price_nonneg"       CHECK ("pricePaise" >= 0),
  ADD CONSTRAINT "ProductVariant_compareat_nonneg"   CHECK ("compareAtPaise" IS NULL OR "compareAtPaise" >= 0);

-- ─────────────────── Positive line / movement quantities ─────────────────
ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_qty_pos" CHECK ("quantity" > 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_qty_pos"            CHECK ("quantity" > 0),
  ADD CONSTRAINT "OrderItem_unitprice_nonneg"  CHECK ("unitPricePaise" >= 0),
  ADD CONSTRAINT "OrderItem_discount_nonneg"   CHECK ("discountPaise" >= 0),
  ADD CONSTRAINT "OrderItem_taxable_nonneg"    CHECK ("taxableValuePaise" >= 0),
  ADD CONSTRAINT "OrderItem_taxrate_nonneg"    CHECK ("taxRateBps" >= 0),
  ADD CONSTRAINT "OrderItem_cgst_nonneg"       CHECK ("cgstPaise" >= 0),
  ADD CONSTRAINT "OrderItem_sgst_nonneg"       CHECK ("sgstPaise" >= 0),
  ADD CONSTRAINT "OrderItem_igst_nonneg"       CHECK ("igstPaise" >= 0),
  ADD CONSTRAINT "OrderItem_total_nonneg"      CHECK ("totalPaise" >= 0);

ALTER TABLE "ReturnItem"
  ADD CONSTRAINT "ReturnItem_qty_pos" CHECK ("quantity" > 0);

ALTER TABLE "ShipmentItem"
  ADD CONSTRAINT "ShipmentItem_qty_pos" CHECK ("quantity" > 0);

-- ─────────────────── Order totals contract (master §6) ───────────────────
-- total = subtotal - discount + shipping + codFee + tax, all components >= 0.
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_subtotal_nonneg" CHECK ("subtotalPaise" >= 0),
  ADD CONSTRAINT "Order_discount_nonneg" CHECK ("discountPaise" >= 0),
  ADD CONSTRAINT "Order_shipping_nonneg" CHECK ("shippingPaise" >= 0),
  ADD CONSTRAINT "Order_codfee_nonneg"   CHECK ("codFeePaise" >= 0),
  ADD CONSTRAINT "Order_tax_nonneg"      CHECK ("taxPaise" >= 0),
  ADD CONSTRAINT "Order_total_nonneg"    CHECK ("totalPaise" >= 0),
  ADD CONSTRAINT "Order_total_identity"  CHECK (
    "totalPaise" = "subtotalPaise" - "discountPaise" + "shippingPaise" + "codFeePaise" + "taxPaise"
  );

-- ─────────────── Refund / payment / remittance amounts ──────────────────
ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_amount_pos" CHECK ("amountPaise" > 0);

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_amount_pos" CHECK ("amountPaise" > 0);

ALTER TABLE "CodRemittance"
  ADD CONSTRAINT "CodRemittance_expected_nonneg"  CHECK ("expectedPaise" >= 0),
  ADD CONSTRAINT "CodRemittance_collected_nonneg" CHECK ("collectedPaise" IS NULL OR "collectedPaise" >= 0),
  ADD CONSTRAINT "CodRemittance_remitted_nonneg"  CHECK ("remittedPaise" IS NULL OR "remittedPaise" >= 0);

-- ─────────────── Category: shared-slug uniqueness (NULL = global) ───────
-- A plain UNIQUE(catalog, slug) allows duplicate global slugs because NULLs are
-- distinct in Postgres. Two partial unique indexes cover both cases without an
-- enum::text cast (which is only STABLE, not IMMUTABLE, so it cannot appear in
-- an index expression):
--   • catalog-scoped slugs are unique within each catalog
--   • global slugs (catalog IS NULL) are unique across all globals
CREATE UNIQUE INDEX "Category_catalog_slug_key"
  ON "Category" ("catalog", "slug") WHERE "catalog" IS NOT NULL;
CREATE UNIQUE INDEX "Category_global_slug_key"
  ON "Category" ("slug") WHERE "catalog" IS NULL;

-- ─────────────── Thrift one-of-one physical-piece limit ────────────────
-- For a THRIFT product flagged one-of-one, total on-hand across its variants
-- may never exceed 1 — enforced for every write path, including admin edits
-- (master spec §5). App services enforce the same rule for a friendly error;
-- this trigger is the backstop.
CREATE OR REPLACE FUNCTION enforce_thrift_one_of_one()
RETURNS TRIGGER AS $$
DECLARE
  v_catalog     "CatalogType";
  v_one_of_one  BOOLEAN;
  v_total_onhand INTEGER;
BEGIN
  SELECT p."catalog", COALESCE(td."isOneOfOne", false)
    INTO v_catalog, v_one_of_one
  FROM "Product" p
  LEFT JOIN "ThriftDetails" td ON td."productId" = p."id"
  WHERE p."id" = NEW."productId";

  IF v_catalog = 'THRIFT' AND v_one_of_one THEN
    SELECT COALESCE(SUM("onHandQty"), 0)
      INTO v_total_onhand
    FROM "ProductVariant"
    WHERE "productId" = NEW."productId" AND "id" <> NEW."id";

    IF v_total_onhand + NEW."onHandQty" > 1 THEN
      RAISE EXCEPTION
        'thrift one-of-one violated: product % would have on-hand %',
        NEW."productId", v_total_onhand + NEW."onHandQty"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProductVariant_thrift_one_of_one"
  BEFORE INSERT OR UPDATE OF "onHandQty", "productId" ON "ProductVariant"
  FOR EACH ROW EXECUTE FUNCTION enforce_thrift_one_of_one();
