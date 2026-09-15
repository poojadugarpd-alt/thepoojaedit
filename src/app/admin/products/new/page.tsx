import { ProductEditor } from "@/features/admin/product-editor/product-editor";

export const metadata = { title: "New product" };

export default function NewProduct() {
  return <ProductEditor initial={null} initialCatalog="THE_POOJA_EDIT" />;
}
