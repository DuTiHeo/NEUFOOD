BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ordering_hours_exempt BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('canteen_open_time', '07:30', 'Giờ bắt đầu phục vụ và nhận đơn đặt ngay'),
('canteen_order_cutoff_time', '18:30', 'Giờ ngừng nhận đơn đặt ngay (bao gồm đúng mốc HH:MM:00)'),
('canteen_close_time', '19:00', 'Giờ kết thúc phục vụ và giờ hẹn nhận cuối cùng (bao gồm đúng mốc HH:MM:00)')
ON CONFLICT (setting_key) DO NOTHING;
UPDATE system_settings SET setting_value='07:30' WHERE setting_key='canteen_open_time' AND setting_value='06:30';
UPDATE system_settings SET setting_value='19:00', description='Giờ kết thúc phục vụ và giờ hẹn nhận cuối cùng (bao gồm đúng mốc HH:MM:00)' WHERE setting_key='canteen_close_time' AND setting_value='19:30';
UPDATE system_settings SET setting_value='30' WHERE setting_key='min_preorder_lead_minutes' AND setting_value ~ '^\d+$' AND setting_value::numeric < 30;
COMMIT;
