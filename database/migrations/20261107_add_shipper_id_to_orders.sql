-- Run once on databases created before shipper assignment was added.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipper_id INT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shipper_id ON orders(shipper_id);
