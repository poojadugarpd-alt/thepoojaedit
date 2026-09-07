import type { Metadata } from "next";

import {
  CollectionPage,
  buildCollectionMetadata,
} from "@/features/catalog/collection-page";

type Params = { params: Promise<{ slug: string }> };

export function generateMetadata({ params }: Params): Promise<Metadata> {
  return params.then(({ slug }) => buildCollectionMetadata("THE_POOJA_EDIT", slug));
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  return <CollectionPage catalog="THE_POOJA_EDIT" slug={slug} />;
}
