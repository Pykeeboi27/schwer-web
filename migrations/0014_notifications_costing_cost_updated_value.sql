-- Isolated ALTER TYPE ADD VALUE (see migrations/0005 and 0012 for why this
-- can't share a transaction with anything that references the new value).

ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'costing_cost_updated';
