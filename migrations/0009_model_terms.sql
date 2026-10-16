-- Logged in: which model terms each person accepted (model + terms version), on every device.
CREATE TABLE model_terms (
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  terms TEXT NOT NULL, -- e.g. krea2-turbo@1.0 (lib/models.ts termsKey)
  acceptedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (userId, terms)
);
