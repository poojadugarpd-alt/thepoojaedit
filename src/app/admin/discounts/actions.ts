"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/app/admin/products/actions";
import { prisma } from "@/lib/db";
import { rupeesToPaise } from "@/lib/money";
import { requireAdmin } from "@/server/auth/require-admin";
import { ValidationError } from "@/server/catalog/admin";
import {
  createDiscountCode,
  deleteDiscountCode,
  updateDiscountCode,
  type DiscountCodeInput,
} from "@/server/discounts";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function handle(e: unknown): ActionState {
  if (e instanceof ValidationError)
    return { ok: false, message: e.message, errors: e.errors };
  if (e instanceof Error) return { ok: false, message: e.message };
  return { ok: false, message: "Something went wrong." };
}

/** A calendar day in India: `start` = 00:00 IST that day, `end` = 00:00 IST
 *  the day after, so a code runs through its whole last day. */
function istDay(v: string, edge: "start" | "end"): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00+05:30`);
  if (edge === "end") d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function fromForm(form: FormData): DiscountCodeInput {
  const kind = str(form.get("kind")) === "FIXED" ? "FIXED" : "PERCENT";
  const value = str(form.get("value"));
  const scope = str(form.get("appliesTo"));
  const min = str(form.get("minSubtotal"));
  const max = str(form.get("maxRedemptions"));
  return {
    code: str(form.get("code")),
    kind,
    percent: kind === "PERCENT" ? Number(value) : null,
    amountPaise: kind === "FIXED" && value ? rupeesToPaise(value) : null,
    appliesTo: scope === "LABEL" || scope === "CLOSET" ? scope : "ALL",
    minSubtotalPaise: min ? rupeesToPaise(min) : null,
    startsAt: istDay(str(form.get("startsOn")), "start"),
    endsAt: istDay(str(form.get("endsOn")), "end"),
    maxRedemptions: max ? Number(max) : null,
    isActive: form.get("isActive") === "on",
    note: str(form.get("note")) || null,
  };
}

export async function createDiscountAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await createDiscountCode(prisma, admin, fromForm(form));
  } catch (e) {
    return handle(e);
  }
  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}

export async function updateDiscountAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await updateDiscountCode(prisma, admin, id, fromForm(form));
  } catch (e) {
    return handle(e);
  }
  revalidatePath("/admin/discounts");
  revalidatePath(`/admin/discounts/${id}`);
  return { ok: true, message: "Saved." };
}

export async function deleteDiscountAction(
  id: string,
  /* eslint-disable @typescript-eslint/no-unused-vars */
  _prev: ActionState,
  _form: FormData,
  /* eslint-enable @typescript-eslint/no-unused-vars */
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await deleteDiscountCode(prisma, admin, id);
  } catch (e) {
    return handle(e);
  }
  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}
