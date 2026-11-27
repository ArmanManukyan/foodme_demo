import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { foodmeApi } from "@/api/foodme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { StarRatingInput } from "@/components/ui/star-rating";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  reviewSchema,
  type ReviewFormValues,
} from "@/schemas/review-schema";
import type { FullOrderDto, OrderListResponseDto } from "@/types";

interface RateOrderDialogProps {
  order: FullOrderDto | null;
  onOpenChange: (open: boolean) => void;
}

/** KAN-9 R16–R18: rate a delivered order with 1–5 stars and an optional comment. */
export function RateOrderDialog({ order, onOpenChange }: RateOrderDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { comment: "" },
  });

  const mutation = useMutation({
    mutationFn: ({ number, values }: { number: string; values: ReviewFormValues }) =>
      foodmeApi.reviewMyOrder(number, {
        stars: values.stars,
        comment: values.comment.trim() || undefined,
      }),
    onSuccess: (reviewed) => {
      // Show the stars at once (R17); the invalidations below confirm it from the server.
      queryClient.setQueriesData<OrderListResponseDto>({ queryKey: ["my-orders"] }, (old) =>
        old
          ? { ...old, list: old.list.map((o) => (o.number === reviewed.number ? reviewed : o)) }
          : old,
      );
      queryClient.setQueryData(["order", reviewed.number], reviewed);
      onOpenChange(false);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order"] });
      // The chef's average changed (R12).
      void queryClient.invalidateQueries({ queryKey: ["chef"] });
      void queryClient.invalidateQueries({ queryKey: ["chefs"] });
    },
  });

  // Start each order with an empty form.
  const { reset } = form;
  const resetMutation = mutation.reset;
  useEffect(() => {
    if (order) {
      reset({ comment: "" });
      resetMutation();
    }
  }, [order, reset, resetMutation]);

  const onSubmit = form.handleSubmit((values) => {
    if (order) mutation.mutate({ number: order.number, values });
  });

  const starsError = form.formState.errors.stars?.message;
  const commentError = form.formState.errors.comment?.message;
  const commentLength = useWatch({ control: form.control, name: "comment" })?.length ?? 0;

  return (
    <Dialog open={!!order} onOpenChange={(open) => !mutation.isPending && onOpenChange(open)}>
      <DialogContent className="overflow-y-auto p-6">
        <DialogTitle className="font-display text-xl font-bold text-zinc-900">
          Rate order {order?.number}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-zinc-500">
          How was your food from {order?.chefName}?
        </DialogDescription>

        <form onSubmit={onSubmit} noValidate className="mt-5">
          <Controller
            control={form.control}
            name="stars"
            render={({ field }) => (
              <StarRatingInput
                value={field.value}
                onChange={field.onChange}
                disabled={mutation.isPending}
                invalid={!!starsError}
                aria-describedby={starsError ? "review-stars-error" : undefined}
              />
            )}
          />
          {starsError && (
            <p id="review-stars-error" className="mt-1.5 text-sm text-red-600">
              {starsError}
            </p>
          )}

          <label htmlFor="review-comment" className="sr-only">
            Comment (optional)
          </label>
          <textarea
            id="review-comment"
            rows={4}
            maxLength={REVIEW_COMMENT_MAX_LENGTH}
            placeholder="Tell us about your order"
            disabled={mutation.isPending}
            aria-invalid={!!commentError || undefined}
            aria-describedby="review-comment-count"
            className="mt-4 w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-300 focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-100 disabled:opacity-50"
            {...form.register("comment")}
          />
          <div className="mt-1 flex justify-between gap-4 text-xs">
            <span className="text-red-600">{commentError}</span>
            <span id="review-comment-count" className="tabular-nums text-zinc-400">
              {commentLength}/{REVIEW_COMMENT_MAX_LENGTH}
            </span>
          </div>

          {mutation.isError && (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              Couldn’t save your rating: {mutation.error.message}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting..." : mutation.isError ? "Try again" : "Submit rating"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
