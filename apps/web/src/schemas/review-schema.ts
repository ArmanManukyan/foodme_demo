import { z } from "zod";

// Mirrors OrderReviewRequestDto on the backend (KAN-9 R2, R3).
export const REVIEW_COMMENT_MAX_LENGTH = 1000;

export const reviewSchema = z.object({
  stars: z
    .number({ error: "Choose a rating from 1 to 5 stars" })
    .int("Choose a rating from 1 to 5 stars")
    .min(1, "Choose a rating from 1 to 5 stars")
    .max(5, "Choose a rating from 1 to 5 stars"),
  comment: z
    .string()
    .max(REVIEW_COMMENT_MAX_LENGTH, `Comment must be at most ${REVIEW_COMMENT_MAX_LENGTH} characters`),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;
