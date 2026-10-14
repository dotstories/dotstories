-- The budget stop is now a general kill switch: started by the budget guard or by hand.
ALTER TABLE budget_stop ADD COLUMN reason TEXT NOT NULL DEFAULT 'budget';
