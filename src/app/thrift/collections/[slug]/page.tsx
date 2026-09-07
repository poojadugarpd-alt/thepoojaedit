import type { Metadata } from "next";

import {
  CollectionPage,
  buildCollectionMetadata,
} from "@/features/catalog/collection-page";

type Params = { params: Promise<{ slug: string }> };

export function generateMetadata({ params }: Params): Promise<Metadata> {
  return params.then(({ slug }) => buildCollectionMetadata("THRIFT", slug));
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  return <CollectionPage catalog="THRIFT" slug={slug} />;
}
