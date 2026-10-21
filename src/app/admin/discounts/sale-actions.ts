"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";

import type { ActionState } from "@/app/admin/products/actions";
import { prisma } from "@/lib/db";
import { updateSetting } from "@/server/admin";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  MAX_SALE_BPS,
  SALE_SETTING_KEY,
  getSaleSettings,
  type SaleScope,
  type SaleSettings,
} from "@/server/sale";
import { SALE_TAG } from "@/server/sale/cached";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

async function saveSale(adminId: string, reason: string, value: SaleSettings) {
  await updateSetting(prisma, {
    key: SALE_SETTING_KEY,
    value,
    adminUserId: adminId,
    reason,
  });
  // After the response (D-155). Catalog pages render per request; the home
  // page is cached for 5 minutes, so refresh it now.
  after(() => {
    // Next 16: expire now (the old one-argument behaviour), not stale-while-revalidate.
    revalidateTag(SALE_TAG, { expire: 0 });
    revalidatePath("/", "page");
  });
}

/** Start the sale, or change one that is running. Ends are times in India. */
export async function saveSaleAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const scopeIn = str(form.get("scope"));
  const scope: SaleScope =
    scopeIn === "ALL" || scopeIn === "LABEL" ? scopeIn : "CLOSET";
  const percent = Number(str(form.get("percent")));
  if (!Number.isFinite(percent) || percent <= 0 || percent * 100 > MAX_SALE_BPS) {
    return {
      ok: false,
      message: `Enter a discount between 1 and ${MAX_SALE_BPS / 100}%.`,
    };
  }
  const endsIn = str(form.get("endsAt"));
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(endsIn)) {
    return { ok: false, message: "Pick when the sale ends." };
  }
  const endsAt = new Date(`${endsIn}:00+05:30`);
  if (endsAt <= new Date()) {
    return { ok: false, message: "The end time has already passed." };
  }
  try {
    await saveSale(admin.id, "started or changed the sale", {
      active: true,
      scope,
      percentBps: Math.round(percent * 100),
      endsAt: endsAt.toISOString(),
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true, message: "Sale saved." };
}

export async function endSaleAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: ActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const current = await getSaleSettings(prisma);
    await saveSale(admin.id, "ended the sale", { ...current, active: false });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true, message: "Sale ended." };
}
