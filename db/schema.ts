import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Mirrors migrations/*.sql (the migrations are the source of truth).

export const dotStats = sqliteTable("dot_stats", {
  slug: text("slug").primaryKey(),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
});
