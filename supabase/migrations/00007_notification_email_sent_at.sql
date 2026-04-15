-- Track which notification rows have already been delivered by email
-- so the dispatcher can idempotently drain "unsent" rows. A NULL
-- value means "never sent"; a timestamp means "sent at that moment".
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_email_unsent
  ON public.notifications(user_id)
  WHERE email_sent_at IS NULL;
