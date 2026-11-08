BEGIN;
-- Recruitment only: preserve all existing user/order data.
CREATE TABLE IF NOT EXISTS recruitment_applications (
    id VARCHAR(32) PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    student_id VARCHAR(30) NOT NULL,
    position VARCHAR(30) NOT NULL,
    availability JSONB NOT NULL,
    intro TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    internal_note TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recruitment_status_check CHECK (status IN ('pending','contacting','hired','rejected')),
    CONSTRAINT recruitment_position_check CHECK (position IN ('shipper','packing','customer_support','communications')),
    CONSTRAINT recruitment_student_check CHECK (student_id = upper(btrim(student_id)) AND length(student_id) > 0),
    CONSTRAINT recruitment_availability_check CHECK (jsonb_typeof(availability) = 'array' AND jsonb_array_length(availability) BETWEEN 4 AND 12),
    CONSTRAINT recruitment_version_check CHECK (version >= 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS recruitment_one_open_student ON recruitment_applications(student_id) WHERE status IN ('pending','contacting');
CREATE INDEX IF NOT EXISTS recruitment_status_created ON recruitment_applications(status,created_at);
-- Employee records are independent of login accounts.
CREATE TABLE IF NOT EXISTS employee_profiles (
    id VARCHAR(32) PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL DEFAULT '',
    position VARCHAR(30) NOT NULL,
    employment_status VARCHAR(20) NOT NULL DEFAULT 'active',
    student_id VARCHAR(30) NOT NULL DEFAULT '',
    start_date DATE,
    source_application_id VARCHAR(32) UNIQUE REFERENCES recruitment_applications(id),
    weekly_schedule JSONB NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT employee_status_check CHECK (employment_status IN ('active','on_leave','resigned')),
    CONSTRAINT employee_position_check CHECK (position IN ('shipper','packing','customer_support','communications','kitchen_assistant','chef','cashier')),
    CONSTRAINT employee_version_check CHECK (version >= 1),
    CONSTRAINT employee_schedule_check CHECK (jsonb_typeof(weekly_schedule) = 'array' AND jsonb_array_length(weekly_schedule) BETWEEN 0 AND 12)
);
CREATE UNIQUE INDEX IF NOT EXISTS employee_unique_student ON employee_profiles(student_id) WHERE student_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS employee_unique_email ON employee_profiles(email) WHERE email <> '';
CREATE TABLE IF NOT EXISTS personnel_audit (
    id SERIAL PRIMARY KEY,
    record_type VARCHAR(20) NOT NULL,
    record_id VARCHAR(32) NOT NULL,
    action VARCHAR(40) NOT NULL,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_personnel_audit_record_id ON personnel_audit(record_id);
COMMIT;
