import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../src/generated/prisma";

/**
 * Safe, idempotent development seed (master spec §5, playbook Phase 2).
 *
 * Fixtures: new-apparel product with size variants, one available one-of-one
 * thrift piece, one SOLD thrift piece, a completed mixed prepaid order, and a
 * pending COD order. Everything keys on natural unique fields and upserts, so
 * running it twice changes nothing.
 *
 * All money is integer paise. The GST rate here is a clearly-labelled DEV
 * PLACEHOLDER — not a tax determination. Real rates/GSTIN are owner-confirmed
 * before any live checkout.
 */
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — start `npm run db:dev` first.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PAST = new Date("2026-04-01T00:00:00.000Z");

async function seedTaxAndSettings() {
  const taxClass = await prisma.taxClass.upsert({
    where: { code: "STANDARD_APPAREL" },
    update: {},
    create: {
      code: "STANDARD_APPAREL",
      name: "Standard apparel (DEV placeholder rate)",
      treatment: "STANDARD",
      hsnCode: "6104",
      rules: {
        create: {
          pricingMode: "INCLUSIVE",
          totalRateBps: 500,
          cgstRateBps: 250,
          sgstRateBps: 250,
          igstRateBps: 500,
          appliesToShipping: false,
          effectiveFrom: PAST,
        },
      },
    },
  });

  await prisma.storeSettings.upsert({
    where: { key: "business.profile" },
    update: {},
    create: {
      key: "business.profile",
      value: {
        _fixture: true,
        legalName: "DEV PLACEHOLDER — The Pooja Edit",
        gstin: "DEV-PLACEHOLDER",
        stateName: "Rajasthan",
        stateCode: "08",
        addressLines: ["DEV fixture address"],
        supportEmail: "dev@example.invalid",
      },
    },
  });

  await prisma.storeSettings.upsert({
    where: { key: "checkout.rules" },
    update: {},
    create: {
      key: "checkout.rules",
      value: { _fixture: true, reservationTtlSeconds: 600, codFeePaise: 3000 },
    },
  });

  return taxClass;
}

async function seedAdmin() {
  await prisma.adminUser.upsert({
    where: { email: "owner@example.invalid" },
    update: {},
    create: {
      email: "owner@example.invalid",
      authUserId: randomUUID(),
      role: "OWNER",
      isActive: true,
    },
  });
}

async function seedCategories() {
  const dresses = await upsertCategory("THE_POOJA_EDIT", "dresses", "Dresses & kurtas");
  const outerwear = await upsertCategory("THRIFT", "outerwear", "Outerwear");
  await upsertCategory(null, "sale", "Sale");
  return { dresses, outerwear };
}

async function upsertCategory(
  catalog: "THE_POOJA_EDIT" | "THRIFT" | null,
  slug: string,
  name: string,
) {
  const existing = await prisma.category.findFirst({ where: { catalog, slug } });
  if (existing) return existing;
  return prisma.category.create({ data: { catalog, slug, name } });
}

async function seedNewApparel(taxClassId: string, categoryId: string) {
  const slug = "marigold-cotton-kurta";
  const existing = await prisma.product.findUnique({
    where: { catalog_slug: { catalog: "THE_POOJA_EDIT", slug } },
  });
  if (existing) return existing;

  return prisma.product.create({
    data: {
      catalog: "THE_POOJA_EDIT",
      slug,
      title: "Marigold Cotton Kurta",
      description: "Hand-block printed cotton kurta in marigold.",
      status: "PUBLISHED",
      publishedAt: PAST,
      categoryId,
      taxClassId,
      brand: "The Pooja Edit",
      hsnCode: "6104",
      images: {
        create: [
          {
            path: "the-pooja-edit/marigold-cotton-kurta/primary.webp",
            altText: "Marigold cotton kurta, front",
            type: "PRIMARY",
            isPrimary: true,
            sortPosition: 0,
          },
        ],
      },
      variants: {
        create: (["S", "M", "L"] as const).map((size) => ({
          sku: `TPE-KURTA-MRGLD-${size}`,
          size,
          pricePaise: 149900,
          compareAtPaise: 199900,
          onHandQty: 10,
          reservedQty: 0,
          lowStockThreshold: 2,
          weightGrams: 300,
        })),
      },
    },
  });
}

async function seedThriftPiece(opts: {
  slug: string;
  title: string;
  categoryId: string;
  sku: string;
  pricePaise: number;
  onHandQty: number;
}) {
  const existing = await prisma.product.findUnique({
    where: { catalog_slug: { catalog: "THRIFT", slug: opts.slug } },
  });
  if (existing) return existing;

  return prisma.product.create({
    data: {
      catalog: "THRIFT",
      slug: opts.slug,
      title: opts.title,
      description: `${opts.title} — pre-loved, one of one.`,
      status: "PUBLISHED",
      publishedAt: PAST,
      categoryId: opts.categoryId,
      thriftDetails: {
        create: {
          conditionGrade: "GOOD",
          conditionNotes: "Gentle wear, no major flaws.",
          originalBrand: "Unknown",
          labelledSize: "M",
          recommendedFit: "Regular",
          fabric: "Cotton denim",
          measurements: {
            chest: { value: 52, unit: "cm" },
            length: { value: 68, unit: "cm" },
          },
          flaws: [{ description: "Small fade near left cuff" }],
          isOneOfOne: true,
          acquisitionCostPaise: 50000,
          acquisitionDate: PAST,
        },
      },
      images: {
        create: [
          {
            path: `thrift/${opts.slug}/primary.webp`,
            altText: `${opts.title}, front`,
            type: "PRIMARY",
            isPrimary: true,
          },
        ],
      },
      variants: {
        create: {
          sku: opts.sku,
          pricePaise: opts.pricePaise,
          onHandQty: opts.onHandQty,
          reservedQty: 0,
          lowStockThreshold: 0,
        },
      },
    },
  });
}

async function seedMixedPrepaidOrder(kurtaVariantId: string, scarfVariantId: string) {
  const orderNumber = "DEV-1001";
  const existing = await prisma.order.findUnique({ where: { orderNumber } });
  if (existing) return existing;

  return prisma.order.create({
    data: {
      orderNumber,
      customerId: null, // guest
      contactEmail: "guest@example.invalid",
      contactPhone: "+919999900001",
      orderStatus: "COMPLETED",
      paymentStatus: "PAID",
      fulfillmentStatus: "DELIVERED",
      paymentMethod: "PREPAID_RAZORPAY",
      source: "instagram",
      subtotalPaise: 228381,
      discountPaise: 0,
      shippingPaise: 0,
      codFeePaise: 0,
      taxPaise: 11419,
      totalPaise: 239800,
      taxBreakdown: {
        mode: "INCLUSIVE",
        totalRateBps: 500,
        components: { cgst: 5709, sgst: 5710 },
      },
      placedAt: PAST,
      confirmedAt: PAST,
      completedAt: PAST,
      addresses: {
        create: [buildAddress("BILLING"), buildAddress("SHIPPING")],
      },
      items: {
        create: [
          {
            variantId: kurtaVariantId,
            catalog: "THE_POOJA_EDIT",
            sku: "TPE-KURTA-MRGLD-M",
            title: "Marigold Cotton Kurta",
            size: "M",
            quantity: 1,
            unitPricePaise: 149900,
            discountPaise: 0,
            hsnCode: "6104",
            taxTreatment: "STANDARD",
            taxRateBps: 500,
            taxableValuePaise: 142762,
            cgstPaise: 3569,
            sgstPaise: 3569,
            igstPaise: 0,
            totalPaise: 149900,
            returnPolicySnapshot: { windowDays: 7, catalog: "THE_POOJA_EDIT" },
          },
          {
            variantId: scarfVariantId,
            catalog: "THRIFT",
            sku: "THR-SCARF-001",
            title: "Silk Scarf — Paisley",
            quantity: 1,
            unitPricePaise: 89900,
            discountPaise: 0,
            taxTreatment: "STANDARD",
            taxRateBps: 500,
            taxableValuePaise: 85619,
            cgstPaise: 2140,
            sgstPaise: 2141,
            igstPaise: 0,
            totalPaise: 89900,
            returnPolicySnapshot: { windowDays: 0, catalog: "THRIFT", finalSale: true },
          },
        ],
      },
    },
  });
}

async function seedCodOrder(kurtaVariantId: string) {
  const orderNumber = "DEV-1002";
  const existing = await prisma.order.findUnique({ where: { orderNumber } });
  if (existing) return existing;

  return prisma.order.create({
    data: {
      orderNumber,
      contactPhone: "+919999900002",
      orderStatus: "PENDING_CONFIRMATION",
      paymentStatus: "COD_PENDING",
      fulfillmentStatus: "UNFULFILLED",
      paymentMethod: "COD",
      subtotalPaise: 142762,
      discountPaise: 0,
      shippingPaise: 0,
      codFeePaise: 3000,
      taxPaise: 7138,
      totalPaise: 152900,
      placedAt: PAST,
      addresses: { create: [buildAddress("BILLING"), buildAddress("SHIPPING")] },
      items: {
        create: [
          {
            variantId: kurtaVariantId,
            catalog: "THE_POOJA_EDIT",
            sku: "TPE-KURTA-MRGLD-S",
            title: "Marigold Cotton Kurta",
            size: "S",
            quantity: 1,
            unitPricePaise: 149900,
            hsnCode: "6104",
            taxTreatment: "STANDARD",
            taxRateBps: 500,
            taxableValuePaise: 142762,
            cgstPaise: 3569,
            sgstPaise: 3569,
            totalPaise: 149900,
            returnPolicySnapshot: { windowDays: 7, catalog: "THE_POOJA_EDIT" },
          },
        ],
      },
    },
  });
}

function buildAddress(type: "BILLING" | "SHIPPING") {
  return {
    type,
    name: "Dev Buyer",
    phone: "+919999900001",
    line1: "12 Fixture Lane",
    city: "Jaipur",
    stateName: "Rajasthan",
    stateCode: "08",
    postcode: "302001",
    country: "IN",
  };
}

/**
 * Notification templates (master §8). Rows exist so an operator can DISABLE a
 * channel; the rendering + variable schema live in `src/server/notifications`.
 * `variableSchema` here is a human-facing hint, not the enforcement.
 */
async function seedNotificationTemplates() {
  const defs: {
    key: string;
    channels: ("EMAIL" | "WHATSAPP" | "IN_APP")[];
    vars: string[];
    providerTemplateId?: string;
  }[] = [
    { key: "order_confirmation_prepaid", channels: ["EMAIL", "WHATSAPP"], vars: ["orderNumber", "totalPaise", "itemCount", "orderUrl"], providerTemplateId: "order_confirmed_prepaid" },
    { key: "order_confirmation_cod", channels: ["EMAIL", "WHATSAPP"], vars: ["orderNumber", "totalPaise", "itemCount", "orderUrl"], providerTemplateId: "order_received_cod" },
    { key: "shipment_dispatched", channels: ["EMAIL", "WHATSAPP"], vars: ["orderNumber", "awb", "courier", "trackingUrl"], providerTemplateId: "shipment_dispatched" },
    { key: "shipment_out_for_delivery", channels: ["EMAIL", "WHATSAPP"], vars: ["orderNumber", "trackingUrl"], providerTemplateId: "out_for_delivery" },
    { key: "order_delivered", channels: ["EMAIL", "WHATSAPP"], vars: ["orderNumber"], providerTemplateId: "order_delivered" },
    { key: "delivery_failed", channels: ["EMAIL", "WHATSAPP"], vars: ["orderNumber", "reason", "trackingUrl"], providerTemplateId: "delivery_failed" },
    { key: "order_cancelled", channels: ["EMAIL", "WHATSAPP"], vars: ["orderNumber", "reason"], providerTemplateId: "order_cancelled" },
    { key: "refund_completed", channels: ["EMAIL", "WHATSAPP"], vars: ["orderNumber", "amountPaise"], providerTemplateId: "refund_completed" },
    { key: "admin_new_order", channels: ["IN_APP"], vars: ["orderNumber", "paymentMethod", "totalPaise"] },
    { key: "admin_pending_cod", channels: ["IN_APP"], vars: ["orderNumber", "totalPaise"] },
    { key: "admin_delivery_failed", channels: ["IN_APP"], vars: ["orderNumber", "reason"] },
  ];
  for (const d of defs) {
    for (const channel of d.channels) {
      await prisma.notificationTemplate.upsert({
        where: {
          key_channel_version_language: { key: d.key, channel, version: 1, language: "en" },
        },
        update: { isEnabled: true },
        create: {
          key: d.key,
          channel,
          version: 1,
          language: "en",
          isEnabled: true,
          providerTemplateId: channel === "WHATSAPP" ? (d.providerTemplateId ?? null) : null,
          variableSchema: { required: d.vars },
        },
      });
    }
  }
}

async function main() {
  const taxClass = await seedTaxAndSettings();
  await seedAdmin();
  await seedNotificationTemplates();
  const { dresses, outerwear } = await seedCategories();

  const kurta = await seedNewApparel(taxClass.id, dresses.id);
  await seedThriftPiece({
    slug: "vintage-denim-jacket",
    title: "Vintage Denim Jacket",
    categoryId: outerwear.id,
    sku: "THR-DENIM-001",
    pricePaise: 249900,
    onHandQty: 1,
  });
  await seedThriftPiece({
    slug: "silk-scarf-paisley",
    title: "Silk Scarf — Paisley",
    categoryId: outerwear.id,
    sku: "THR-SCARF-001",
    pricePaise: 89900,
    onHandQty: 0, // SOLD
  });

  const kurtaVariants = await prisma.productVariant.findMany({
    where: { productId: kurta.id },
    orderBy: { sku: "asc" },
  });
  const kurtaM = kurtaVariants.find((v) => v.size === "M")!;
  const scarfVariant = await prisma.productVariant.findUniqueOrThrow({
    where: { sku: "THR-SCARF-001" },
  });

  await seedMixedPrepaidOrder(kurtaM.id, scarfVariant.id);
  await seedCodOrder(kurtaVariants[0]!.id);

  const counts = {
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
  };
  console.log("seed complete:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
