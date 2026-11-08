from sqlalchemy import text

from app.db.session import engine


def ensure_delivery_assignment_schema() -> None:
    """Apply the small, idempotent schema change needed by shipper assignment."""
    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE orders "
            "ADD COLUMN IF NOT EXISTS shipper_id INTEGER "
            "REFERENCES users(id) ON DELETE SET NULL"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_orders_shipper_id ON orders(shipper_id)"
        ))
