"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { CatalogType } from "@/generated/prisma";
import type { ActionState } from "@/app/admin/products/actions";
import { prisma } from "@/lib/db";
import {
  ValidationError,
  addProductToCollection,
  createCollection,
  reorderCollectionProduct,
  removeProductFromCollection,
  searchAddableCollectionProducts,
  updateCollection,
} from "@/server/catalog/admin";
import { requireAdmin } from "@/server/auth/require-admin";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function handle(e: unknown): ActionState {
  if (e instanceof ValidationError) return { ok: false, message: e.message, errors: e.errors };
  if (e instanceof Error) return { ok: false, message: e.message };
  return { ok: false, message: "Something went wrong." };
}

export async function createCollectionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const catalog = str(form.get("catalog"));
  if (catalog !== "THE_POOJA_EDIT" && catalog !== "THRIFT") {
    return { ok: false, message: "Choose a catalogue." };
  }
  let id: string;
  try {
    const col = await createCollection(prisma, admin, {
      catalog: catalog as CatalogType,
      name: str(form.get("name")),
      // No slug field on this form (owner feedback, 2026-09-13, Part B3) —
      // createCollection generates and uniques one from the name.
    });
    id = col.id;
  } catch (e) {
    return handle(e);
  }
  revalidatePath("/admin/collections");
  redirect(`/admin/collections/${id}`);
}

export async function updateCollectionAction(
  collectionId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await updateCollection(prisma, admin, collectionId, {
      name: str(form.get("name")),
      description: str(form.get("description")) || null,
      isActive: form.get("isActive") === "on",
    });
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/collections/${collectionId}`);
  revalidatePath("/admin/collections");
  return { ok: true, message: "Saved." };
}

export async function addProductToCollectionAction(
  collectionId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const productId = str(form.get("productId"));
  try {
    await addProductToCollection(prisma, admin, collectionId, productId);
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/collections/${collectionId}`);
  revalidatePath("/");
  return { ok: true, message: "Added." };
}

export async function removeProductFromCollectionAction(
  collectionId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const productId = str(form.get("productId"));
  try {
    await removeProductFromCollection(prisma, admin, collectionId, productId);
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/collections/${collectionId}`);
  revalidatePath("/");
  return { ok: true, message: "Removed." };
}

export async function reorderCollectionProductAction(
  collectionId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const productId = str(form.get("productId"));
  const direction = str(form.get("direction"));
  try {
    await reorderCollectionProduct(
      prisma,
      admin,
      collectionId,
      productId,
      direction === "up" ? "up" : "down",
    );
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/collections/${collectionId}`);
  revalidatePath("/");
  return { ok: true };
}

export type AddableProduct = { id: string; title: string; image: string | null };

/** Called directly from client JS as the search box types — not a <form
 * action>, matching the request/confirm image-upload actions' pattern
 * (src/app/admin/products/actions.ts). */
export async function searchAddableProductsAction(
  collectionId: string,
  catalog: string,
  q: string,
): Promise<AddableProduct[]> {
  await requireAdmin();
  if (catalog !== "THE_POOJA_EDIT" && catalog !== "THRIFT") return [];
  const rows = await searchAddableCollectionProducts(
    prisma,
    collectionId,
    catalog as CatalogType,
    q,
  );
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    image: p.images[0]?.publicUrl ?? null,
  }));
}

