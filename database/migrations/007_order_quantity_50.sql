-- Raise the per-dish quantity limit without changing existing order snapshots.
BEGIN;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_quantity_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0 AND quantity <= 50);
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('max_dish_quantity_per_order', '50', 'Số lượng tối đa của một món ăn trong một đơn hàng (phần)')
ON CONFLICT (setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value;
COMMIT;
