import type { Metadata } from "next";

import { ReviewForm } from "@/features/reviews/review-form";
import { stylingWhatsAppUrl } from "@/features/styling/whatsapp";
import { prisma } from "@/lib/db";
import { getReviewInvite } from "@/server/reviews";
import { getStylingContent, serviceOptions } from "@/server/styling";

// A page for clients, not for search results.
export const metadata: Metadata = {
  title: "Leave a review",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const c = await getStylingContent(prisma);
  const found = invite ? await getReviewInvite(prisma, invite) : null;
  const styling = found && found.site === "STYLING" ? found : null;
  const services = serviceOptions(c);

  return (
    <div className="u-section">
      <div className="u-page max-w-2xl">
        <h1 className="u-h2">Leave a review</h1>
        <p className="mt-4 max-w-[60ch] text-ink">
          Thank you for working with Pooja. A few honest words help other people decide,
          and she reads every one. Nothing goes on the site until she has approved it.
        </p>
        <div className="mt-10">
          <ReviewForm
            services={services}
            invite={styling ? invite : undefined}
            defaultName={styling?.clientName.split(" ")[0]}
            defaultService={
              styling && services.includes(styling.service)
                ? styling.service
                : undefined
            }
            whatsappUrl={stylingWhatsAppUrl(
              "Hi Pooja, I'd like to ask about my review.",
            )}
          />
        </div>
      </div>
    </div>
  );
}
