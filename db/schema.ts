import type { AdapterAccountType } from "next-auth/adapters";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Mirrors migrations/*.sql (the migrations are the source of truth).

export const dotStats = sqliteTable("dot_stats", {
  slug: text("slug").primaryKey(),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
});

export const users = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  password: text("password"),
  username: text("username").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" }), // account deleted: personal data removed, row kept
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const emailCodes = sqliteTable("email_code", {
  email: text("email").primaryKey(),
  code: text("code").notNull(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
});

export const passwordResets = sqliteTable("password_reset", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const dotLikes = sqliteTable(
  "dot_like",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.slug] })],
);

export const comments = sqliteTable("comment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  parentId: text("parentId"),
  text: text("text").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" }), // its author deleted their account: text removed
});

export const dotState = sqliteTable(
  "dot_state",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    state: text("state").notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.slug] })],
);
