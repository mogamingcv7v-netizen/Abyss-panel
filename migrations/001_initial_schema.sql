-- Initial Schema for ABYSS PANEL

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    email VARCHAR(100),
    country VARCHAR(50),
    role VARCHAR(20) DEFAULT 'user', -- superadmin, dev, user
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Ranges Table
CREATE TABLE IF NOT EXISTS ranges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(50),
    prefix VARCHAR(20),
    default_payout DECIMAL(10, 4) DEFAULT 0.0000,
    default_payterm INTEGER DEFAULT 30,
    total_count INTEGER DEFAULT 0,
    assigned_count INTEGER DEFAULT 0,
    stock_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Numbers Table
CREATE TABLE IF NOT EXISTS numbers (
    id SERIAL PRIMARY KEY,
    number VARCHAR(30) UNIQUE NOT NULL,
    range_id INTEGER REFERENCES ranges(id) ON DELETE CASCADE,
    country VARCHAR(50),
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_date TIMESTAMP WITH TIME ZONE,
    payout DECIMAL(10, 4) DEFAULT 0.0000,
    payterm INTEGER DEFAULT 30,
    active BOOLEAN DEFAULT true,
    sms_today INTEGER DEFAULT 0,
    sms_total INTEGER DEFAULT 0,
    last_sms_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Traffic Table
CREATE TABLE IF NOT EXISTS traffic (
    id SERIAL PRIMARY KEY,
    number_id INTEGER REFERENCES numbers(id) ON DELETE SET NULL,
    number VARCHAR(30),
    range_id INTEGER REFERENCES ranges(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    cli VARCHAR(30),
    sms INTEGER DEFAULT 1,
    payout DECIMAL(10, 4) DEFAULT 0.0000,
    currency VARCHAR(10) DEFAULT 'USD',
    ip VARCHAR(45),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Targets Table
CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20), -- daily, monthly
    value INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, type)
);

-- 6. Dev Codes Table
CREATE TABLE IF NOT EXISTS dev_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_by INTEGER REFERENCES users(id),
    used BOOLEAN DEFAULT false,
    used_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE
);

-- 7. Allocation Log Table
CREATE TABLE IF NOT EXISTS allocation_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(50),
    range_id INTEGER REFERENCES ranges(id) ON DELETE SET NULL,
    range_name VARCHAR(100),
    qty INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_numbers_range ON numbers(range_id);
CREATE INDEX IF NOT EXISTS idx_numbers_assigned ON numbers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_numbers_number ON numbers(number);
CREATE INDEX IF NOT EXISTS idx_traffic_number ON traffic(number);
CREATE INDEX IF NOT EXISTS idx_traffic_user ON traffic(user_id);
CREATE INDEX IF NOT EXISTS idx_traffic_date ON traffic(recorded_at);
CREATE INDEX IF NOT EXISTS idx_traffic_range ON traffic(range_id);
