-- Existing links keep working. Their owner token is retained on the next authenticated visit.
-- 0 means no expiry for client links; view-as sessions still expire after one hour.
ALTER TABLE portal_sessions ADD COLUMN token_cipher TEXT;
