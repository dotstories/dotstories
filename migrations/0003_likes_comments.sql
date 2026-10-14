-- One like per person per dot.
CREATE TABLE dot_like (
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (userId, slug)
);

-- Comments on a dot; replies point to a top-level comment.
CREATE TABLE comment (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  parentId TEXT REFERENCES comment(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX comment_by_dot ON comment (slug, createdAt);
