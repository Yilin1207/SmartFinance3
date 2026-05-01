CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  session_token VARCHAR(128),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_session_token
  ON users(session_token)
  WHERE session_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email
  ON newsletter_subscribers(email);

CREATE TABLE IF NOT EXISTS contact_requests (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_email
  ON contact_requests(email);

CREATE TABLE IF NOT EXISTS brokerage_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_name VARCHAR(255) NOT NULL,
  base_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  cash_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brokerage_positions (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES brokerage_accounts(id) ON DELETE CASCADE,
  asset_key VARCHAR(100) NOT NULL,
  asset_name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(50) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  quantity NUMERIC(18, 6) NOT NULL,
  entry_price NUMERIC(18, 6) NOT NULL,
  current_price NUMERIC(18, 6) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brokerage_positions_account_id
  ON brokerage_positions(account_id);

CREATE INDEX IF NOT EXISTS idx_brokerage_accounts_user_id
  ON brokerage_accounts(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brokerage_accounts_active_user
  ON brokerage_accounts(user_id)
  WHERE is_active = TRUE;
