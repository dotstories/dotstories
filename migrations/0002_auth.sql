-- Accounts (Auth.js tables + username/password) and email codes.
CREATE TABLE user (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  email TEXT UNIQUE, -- X/Twitter may not share an email
  emailVerified INTEGER,
  image TEXT,
  password TEXT, -- only for email + password accounts
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE account (
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  PRIMARY KEY (provider, providerAccountId)
);

CREATE TABLE session (
  sessionToken TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);

CREATE TABLE verificationToken (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires INTEGER NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- 6-digit code to verify an email. One per email, 5 tries.
CREATE TABLE email_code (
  email TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  expires INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- Password reset links.
CREATE TABLE password_reset (
  token TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  expires INTEGER NOT NULL
);
