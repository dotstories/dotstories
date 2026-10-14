-- Deleted accounts: their email, username and social logins can't be used again (no impersonating the old
-- author, no coming back after a ban). Only SHA-256 hashes are stored, never the values.
CREATE TABLE retired (
  hash TEXT PRIMARY KEY NOT NULL,
  createdAt INTEGER NOT NULL
);
