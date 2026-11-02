import { getStudioReviews } from "@/lib/reviews";

/** What clients say. Shows nothing until there is at least one approved review. */
export async function ReviewsBlock({ tone }: { tone?: "blush" }) {
  const reviews = await getStudioReviews();
  if (reviews.length === 0) return null;
  return (
    <section
      className={`block ${tone === "blush" ? "blush" : ""}`}
      aria-labelledby="reviews-title"
    >
      <h2 id="reviews-title" className="section-title">
        what clients say
      </h2>
      <div className="review-grid">
        {reviews.map((r) => (
          <figure key={r.id} className="review-card">
            {r.rating ? (
              <p className="review-stars" aria-label={`${r.rating} out of 5`}>
                {"★".repeat(r.rating)}
                <span aria-hidden="true">{"☆".repeat(5 - r.rating)}</span>
              </p>
            ) : null}
            <blockquote className="review-text">&ldquo;{r.text}&rdquo;</blockquote>
            <figcaption className="review-by">
              <strong>{r.displayName}</strong>
              {r.instagram ? (
                <>
                  {" "}
                  <a
                    className="text-link"
                    href={`https://instagram.com/${r.instagram}`}
                    target="_blank"
                    rel="noopener"
                  >
                    @{r.instagram}
                  </a>
                </>
              ) : null}
              <span className="review-meta">
                {r.service}
                {r.verified ? " · client" : ""}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
