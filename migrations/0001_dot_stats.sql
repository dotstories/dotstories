-- Counters per dot, shown on the dot page.
CREATE TABLE dot_stats (
  slug TEXT PRIMARY KEY NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0
);
