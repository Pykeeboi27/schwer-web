-- Add 'closed' status to approval_status_enum so quotations can be marked
-- read-only after conversion to a purchase order.
ALTER TYPE public.approval_status_enum ADD VALUE IF NOT EXISTS 'closed';
