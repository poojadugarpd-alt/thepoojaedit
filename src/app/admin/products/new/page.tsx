import { ActionForm, Field } from "@/features/admin/action-form";

import { createProductAction } from "../actions";

export const metadata = { title: "New product" };

export default function NewProduct() {
  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold">New product</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Creates a draft. Add variants, images and (for thrift) details, then publish.
      </p>
      <div className="mt-6">
        <ActionForm action={createProductAction} submitLabel="Create draft">
          <fieldset>
            <legend className="text-xs font-medium">Catalogue *</legend>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="catalog"
                value="THE_POOJA_EDIT"
                defaultChecked
              />
              The Pooja Edit (new apparel)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="catalog" value="THRIFT" />
              Thrift (pre-loved, one of one)
            </label>
          </fieldset>
          <Field label="Slug" name="slug" required hint="lowercase, digits, hyphens" />
          <Field label="Title" name="title" required />
        </ActionForm>
      </div>
    </div>
  );
}
