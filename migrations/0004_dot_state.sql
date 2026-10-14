-- Logged in: each person's setup per dot (prompt, seed, version), on every device.
CREATE TABLE dot_state (
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  state TEXT NOT NULL, -- JSON, same shape as the URL (?v=&prompt=&seed=)
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (userId, slug)
);
