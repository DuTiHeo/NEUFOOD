-- Additive chat tables. Apply on existing databases before enabling chat orders.
BEGIN;
CREATE TABLE IF NOT EXISTS chat_order_drafts (
    id VARCHAR(32) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(64) NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    payload JSON NOT NULL,
    quote JSON,
    expires_at TIMESTAMPTZ NOT NULL,
    order_id VARCHAR(50) REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS ix_chat_order_drafts_user_id ON chat_order_drafts(user_id);
CREATE INDEX IF NOT EXISTS ix_chat_order_drafts_session_id ON chat_order_drafts(session_id);
CREATE TABLE IF NOT EXISTS chat_delivery_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    details JSON NOT NULL
);
COMMIT;
