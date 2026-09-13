"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/app/admin/products/actions";
import { prisma } from "@/lib/db";
import { updateSetting } from "@/server/admin";
import type { HomeContent } from "@/server/settings";
import { requireAdmin } from "@/server/auth/require-admin";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export async function updateHomeContentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  // Every field is optional here on purpose: `getHomeContent()` falls back to
  // the shipped default per field, so a blank box just means "use the
  // default wording" rather than a validation error.
  const value: HomeContent = {
    hero: {
      eyebrow: str(form.get("hero.eyebrow")),
      heading: str(form.get("hero.heading")),
      lead: str(form.get("hero.lead")),
      primaryCta: str(form.get("hero.primaryCta")),
      secondaryCta: str(form.get("hero.secondaryCta")),
    },
    editorial: { linkLabel: str(form.get("editorial.linkLabel")) },
    newIn: {
      eyebrow: str(form.get("newIn.eyebrow")),
      heading: str(form.get("newIn.heading")),
      linkLabel: str(form.get("newIn.linkLabel")),
    },
    fromCloset: {
      eyebrow: str(form.get("fromCloset.eyebrow")),
      heading: str(form.get("fromCloset.heading")),
      linkLabel: str(form.get("fromCloset.linkLabel")),
    },
    labelBlock: {
      heading: str(form.get("labelBlock.heading")),
      body: str(form.get("labelBlock.body")),
      cta: str(form.get("labelBlock.cta")),
    },
    closetBlock: {
      heading: str(form.get("closetBlock.heading")),
      body: str(form.get("closetBlock.body")),
      cta: str(form.get("closetBlock.cta")),
    },
    newsletter: {
      eyebrow: str(form.get("newsletter.eyebrow")),
      heading: str(form.get("newsletter.heading")),
      body: str(form.get("newsletter.body")),
      buttonLabel: str(form.get("newsletter.buttonLabel")),
    },
  };
  try {
    await updateSetting(prisma, {
      key: "home.content",
      value,
      adminUserId: admin.id,
      reason: str(form.get("reason")) || undefined,
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  // Not the JSON editor's `/admin/settings` — the home page itself, and
  // immediately, so the change is live without waiting on `revalidate = 300`.
  revalidatePath("/", "page");
  return { ok: true, message: "Saved. The home page is updated." };
}
