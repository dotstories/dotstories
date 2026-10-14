-- Set by the budget guard Worker when the month's estimated spend passes the budget.
-- While this row exists the app refuses uploads and file reads. Reset: scripts/budget-reset.mjs.
CREATE TABLE budget_stop (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  at TEXT NOT NULL,
  estimateUsd REAL NOT NULL,
  disabled TEXT NOT NULL DEFAULT '[]' -- JSON: R2 domains it turned off
);
