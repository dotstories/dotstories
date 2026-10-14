-- Account deletion anonymizes instead of removing rows: what other people rely on (comment threads, and later
-- dots) keeps working, while everything that identifies the person is removed.
ALTER TABLE user ADD COLUMN deletedAt INTEGER;
ALTER TABLE comment ADD COLUMN deletedAt INTEGER;
