import { z } from "zod";

export const COMMENT_MAX = 1000;
export const CommentSchema = z.object({
  slug: z.string().min(1),
  text: z.string().trim().min(1, "Write something first.").max(COMMENT_MAX, `Up to ${COMMENT_MAX} characters.`),
  parentId: z.string().uuid().optional(),
});
