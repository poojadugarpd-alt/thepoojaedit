import type { Metadata } from "next";

import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { ReviewForm } from "@/components/ReviewForm";

// A page for clients, not for search results.
export const metadata: Metadata = {
  title: { absolute: "Leave a review | Pooja Dugar Edit Studio" },
  robots: { index: false, follow: false },
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <>
      <PageHeader message="Hi Pooja! I'd like to leave a review." />
      <main id="top">
        <section className="block" aria-labelledby="review-title">
          <h1 id="review-title" className="display display-md">
            leave a review
          </h1>
          <p className="service-answer">
            thank you for working with me. a few honest words help other creators
            decide, and i read every one. nothing goes on the site until i have approved
            it.
          </p>
          <ReviewForm invite={invite} />
        </section>
      </main>
      <Footer />
    </>
  );
}
