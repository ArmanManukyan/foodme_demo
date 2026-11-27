import { StarRatingDisplay } from "@/components/ui/star-rating";
import type { OrderReviewDto } from "@/types";

/** The rating a customer gave an order (KAN-9 R13), shown in My Orders and on tracking. */
export function OrderReviewSummary({ review }: { review: OrderReviewDto }) {
  return (
    <div data-testid="order-review" className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-zinc-500">Rating</span>
        <StarRatingDisplay value={review.stars} />
      </div>
      {review.comment && (
        <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-zinc-700">
          {review.comment}
        </p>
      )}
    </div>
  );
}
