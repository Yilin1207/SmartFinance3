const express = require('express');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const pool = require('./db/db');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = Boolean(process.env.VERCEL);
const SESSION_COOKIE_NAME = 'smartfinance_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
let tablesReadyPromise = null;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[+\d\s()-]{7,20}$/.test(phone);
}

function toPositiveNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(headerValue = '') {
  return headerValue
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const separatorIndex = item.indexOf('=');

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = item.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(item.slice(separatorIndex + 1).trim());
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function setSessionCookie(res, token) {
  const maxAge = Math.floor(SESSION_MAX_AGE_MS / 1000);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      session_token VARCHAR(128),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS session_token VARCHAR(128)
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  await pool.query(`
    UPDATE users
    SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
    WHERE created_at IS NULL
  `);

  await pool.query(`
    DELETE FROM users
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY email ORDER BY id DESC) AS row_number
        FROM users
        WHERE email IS NOT NULL
      ) duplicated_users
      WHERE duplicated_users.row_number > 1
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_session_token
    ON users(session_token)
    WHERE session_token IS NOT NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_requests (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_contact_requests_email
    ON contact_requests(email)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS brokerage_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_name VARCHAR(255) NOT NULL,
      base_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      cash_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE brokerage_accounts
    DROP CONSTRAINT IF EXISTS brokerage_accounts_user_id_key
  `);

  await pool.query(`
    ALTER TABLE brokerage_accounts
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_brokerage_positions_account_id
    ON brokerage_positions(account_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_brokerage_accounts_user_id
    ON brokerage_accounts(user_id)
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_brokerage_accounts_active_user
    ON brokerage_accounts(user_id)
    WHERE is_active = TRUE
  `);

  await pool.query(`
    WITH ranked_accounts AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS row_number
      FROM brokerage_accounts
      WHERE user_id IN (
        SELECT user_id
        FROM brokerage_accounts
        GROUP BY user_id
        HAVING BOOL_OR(is_active) = FALSE
      )
    )
    UPDATE brokerage_accounts
    SET is_active = TRUE
    WHERE id IN (
      SELECT id
      FROM ranked_accounts
      WHERE row_number = 1
    )
  `);
}

async function prepareDatabase() {
  if (!tablesReadyPromise) {
    tablesReadyPromise = ensureTables().catch((error) => {
      tablesReadyPromise = null;
      throw error;
    });
  }

  return tablesReadyPromise;
}

async function attachCurrentUser(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies[SESSION_COOKIE_NAME];

    if (!sessionToken) {
      req.currentUser = null;
      return next();
    }

    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE session_token = $1',
      [sessionToken]
    );

    req.currentUser = result.rows[0] || null;
    return next();
  } catch (error) {
    console.error('Failed to read session:', error.message);
    req.currentUser = null;
    return next();
  }
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    return res.redirect('/register.html');
  }

  return next();
}

function requireApiAuth(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  return next();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(attachCurrentUser);

app.get('/api/db-config', (req, res) => {
  return res.status(200).json({
    success: true,
    hasDatabaseUrl: Boolean(pool.hasDatabaseUrl),
    nodeEnv: process.env.NODE_ENV || null,
    vercel: Boolean(process.env.VERCEL)
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await prepareDatabase();

    return res.status(200).json({
      success: true,
      message: 'Database connection is ready',
      hasDatabaseUrl: Boolean(pool.hasDatabaseUrl)
    });
  } catch (error) {
    console.error('Health check failed:', error.message);

    return res.status(503).json({
      success: false,
      message: 'Database is not configured or unavailable',
      hasDatabaseUrl: Boolean(pool.hasDatabaseUrl),
      errorCode: error.code || null,
      errorName: error.name || null,
      errorMessage: error.message || null
    });
  }
});

app.use('/api', async (req, res, next) => {
  try {
    await prepareDatabase();
    return next();
  } catch (error) {
    console.error('Database is not ready:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database is not configured or unavailable'
    });
  }
});

app.get('/', (req, res) => {
  if (!req.currentUser) {
    return res.redirect('/register.html');
  }

  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', requireAuth, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register.html', (req, res) => {
  if (req.currentUser) {
    return res.redirect('/');
  }

  return res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/api/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Fill in name, email, password and password confirmation'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least 6 characters'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    const passwordHash = hashPassword(password);
    const sessionToken = generateSessionToken();
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, session_token)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash, sessionToken]
    );

    setSessionCookie(res, sessionToken);

    return res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Registration error:', error.message);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to register user',
      error: error.message
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Enter email and password'
      });
    }

    const result = await pool.query(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0 || !verifyPassword(password, result.rows[0].password_hash)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const sessionToken = generateSessionToken();
    await pool.query(
      'UPDATE users SET session_token = $1 WHERE id = $2',
      [sessionToken, result.rows[0].id]
    );

    setSessionCookie(res, sessionToken);

    return res.status(200).json({
      success: true,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to log in',
      error: error.message
    });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    if (req.currentUser) {
      await pool.query(
        'UPDATE users SET session_token = NULL WHERE id = $1',
        [req.currentUser.id]
      );
    }

    clearSessionCookie(res);

    return res.status(200).json({
      success: true,
      message: 'Logged out'
    });
  } catch (error) {
    console.error('Logout error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to log out',
      error: error.message
    });
  }
});

app.get('/api/me', (req, res) => {
  if (!req.currentUser) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  return res.status(200).json({
    success: true,
    data: req.currentUser
  });
});

app.get('/api/brokerage-account', requireApiAuth, async (req, res) => {
  try {
    const requestedAccountId = Number(req.query.accountId);
    const accountResult = await pool.query(
      `SELECT id, account_name, base_currency, cash_balance, is_active, created_at
       FROM brokerage_accounts
       WHERE user_id = $1
       ORDER BY is_active DESC, created_at DESC, id DESC`,
      [req.currentUser.id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          accounts: [],
          selectedAccount: null
        }
      });
    }

    const selectedAccount = Number.isInteger(requestedAccountId) && requestedAccountId > 0
      ? accountResult.rows.find((account) => account.id === requestedAccountId) || accountResult.rows[0]
      : accountResult.rows.find((account) => account.is_active) || accountResult.rows[0];

    const positionsResult = await pool.query(
      `SELECT id, asset_key, asset_name, asset_type, symbol, quantity, entry_price, current_price, created_at
       FROM brokerage_positions
       WHERE account_id = $1
       ORDER BY created_at DESC, id DESC`,
      [selectedAccount.id]
    );

    const positions = positionsResult.rows.map((position) => {
      const quantity = Number(position.quantity);
      const entryPrice = Number(position.entry_price);
      const currentPrice = Number(position.current_price);
      const investedValue = quantity * entryPrice;
      const marketValue = quantity * currentPrice;
      const pnl = marketValue - investedValue;

      return {
        ...position,
        quantity,
        entry_price: entryPrice,
        current_price: currentPrice,
        invested_value: investedValue,
        market_value: marketValue,
        pnl
      };
    });

    const cashBalance = Number(selectedAccount.cash_balance);
    const investedValue = positions.reduce((sum, position) => sum + position.invested_value, 0);
    const marketValue = positions.reduce((sum, position) => sum + position.market_value, 0);
    const totalEquity = cashBalance + marketValue;
    const totalPnl = marketValue - investedValue;

    return res.status(200).json({
      success: true,
      data: {
        accounts: accountResult.rows.map((account) => ({
          ...account,
          cash_balance: Number(account.cash_balance)
        })),
        selectedAccount: {
          account: {
            ...selectedAccount,
            cash_balance: cashBalance
          },
          positions,
          summary: {
            cashBalance,
            investedValue,
            marketValue,
            totalEquity,
            totalPnl,
            positionsCount: positions.length
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to load brokerage account:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load brokerage account',
      error: error.message
    });
  }
});

app.post('/api/brokerage-account', requireApiAuth, async (req, res) => {
  try {
    const accountName = String(req.body.accountName || '').trim();
    const baseCurrency = String(req.body.baseCurrency || 'USD').trim().toUpperCase();
    const initialDeposit = toPositiveNumber(req.body.initialDeposit);

    if (!accountName) {
      return res.status(400).json({
        success: false,
        message: 'Account name is required'
      });
    }

    if (!['USD', 'EUR', 'GBP'].includes(baseCurrency)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported base currency'
      });
    }

    if (initialDeposit === null) {
      return res.status(400).json({
        success: false,
        message: 'Initial deposit must be a positive number'
      });
    }

    await pool.query('BEGIN');

    await pool.query(
      'UPDATE brokerage_accounts SET is_active = FALSE WHERE user_id = $1',
      [req.currentUser.id]
    );

    const result = await pool.query(
      `INSERT INTO brokerage_accounts (user_id, account_name, base_currency, cash_balance, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, account_name, base_currency, cash_balance, is_active, created_at`,
      [req.currentUser.id, accountName, baseCurrency, initialDeposit]
    );

    await pool.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Brokerage account created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Failed to create brokerage account:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create brokerage account',
      error: error.message
    });
  }
});

app.post('/api/brokerage-account/select', requireApiAuth, async (req, res) => {
  try {
    const accountId = Number(req.body.accountId);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid account id is required'
      });
    }

    const accountResult = await pool.query(
      'SELECT id FROM brokerage_accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.currentUser.id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Brokerage account not found'
      });
    }

    await pool.query('BEGIN');
    await pool.query('UPDATE brokerage_accounts SET is_active = FALSE WHERE user_id = $1', [req.currentUser.id]);
    await pool.query('UPDATE brokerage_accounts SET is_active = TRUE WHERE id = $1', [accountId]);
    await pool.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Active brokerage account updated'
    });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Failed to switch brokerage account:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to switch brokerage account',
      error: error.message
    });
  }
});

app.post('/api/brokerage-account/positions', requireApiAuth, async (req, res) => {
  try {
    const accountId = Number(req.body.accountId);
    const assetKey = String(req.body.assetKey || '').trim();
    const assetName = String(req.body.assetName || '').trim();
    const assetType = String(req.body.assetType || '').trim().toLowerCase();
    const symbol = String(req.body.symbol || '').trim().toUpperCase();
    const quantity = toPositiveNumber(req.body.quantity);
    const entryPrice = toPositiveNumber(req.body.entryPrice);
    const currentPrice = toPositiveNumber(req.body.currentPrice);

    if (!assetKey || !assetName || !symbol) {
      return res.status(400).json({
        success: false,
        message: 'Asset details are required'
      });
    }

    if (!['indices', 'crypto', 'forex'].includes(assetType)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported asset type'
      });
    }

    if (quantity === null || entryPrice === null || currentPrice === null) {
      return res.status(400).json({
        success: false,
        message: 'Quantity, entry price and current price must be positive numbers'
      });
    }

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Choose a brokerage account first'
      });
    }

    const accountResult = await pool.query(
      'SELECT id, cash_balance FROM brokerage_accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.currentUser.id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Create your brokerage account first'
      });
    }

    const account = accountResult.rows[0];
    const requiredCapital = quantity * entryPrice;
    const cashBalance = Number(account.cash_balance);

    if (cashBalance < requiredCapital) {
      return res.status(400).json({
        success: false,
        message: 'Not enough available cash in the account'
      });
    }

    await pool.query('BEGIN');

    const insertResult = await pool.query(
      `INSERT INTO brokerage_positions
        (account_id, asset_key, asset_name, asset_type, symbol, quantity, entry_price, current_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, asset_key, asset_name, asset_type, symbol, quantity, entry_price, current_price, created_at`,
      [account.id, assetKey, assetName, assetType, symbol, quantity, entryPrice, currentPrice]
    );

    await pool.query(
      'UPDATE brokerage_accounts SET cash_balance = cash_balance - $1 WHERE id = $2',
      [requiredCapital, account.id]
    );

    await pool.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Asset added to brokerage account',
      data: insertResult.rows[0]
    });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Failed to add brokerage position:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to add asset to brokerage account',
      error: error.message
    });
  }
});

app.delete('/api/brokerage-account/positions/:positionId', requireApiAuth, async (req, res) => {
  try {
    const positionId = Number(req.params.positionId);

    if (!Number.isInteger(positionId) || positionId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position id'
      });
    }

    const positionResult = await pool.query(
      `SELECT bp.id, bp.quantity, bp.current_price, ba.id AS account_id
       FROM brokerage_positions bp
       JOIN brokerage_accounts ba ON ba.id = bp.account_id
       WHERE bp.id = $1 AND ba.user_id = $2`,
      [positionId, req.currentUser.id]
    );

    if (positionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }

    const position = positionResult.rows[0];
    const releasedCash = Number(position.quantity) * Number(position.current_price);

    await pool.query('BEGIN');
    await pool.query('DELETE FROM brokerage_positions WHERE id = $1', [positionId]);
    await pool.query(
      'UPDATE brokerage_accounts SET cash_balance = cash_balance + $1 WHERE id = $2',
      [releasedCash, position.account_id]
    );
    await pool.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Position removed successfully'
    });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Failed to remove brokerage position:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove position',
      error: error.message
    });
  }
});

app.post('/api/contact-requests', requireAuth, async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();
    const isConfirmed = req.body.isConfirmed === true || req.body.isConfirmed === 'true';

    if (!fullName || !email || !phone || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Fill in name, email, phone, subject and message'
      });
    }

    if (!isConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'Please confirm that your data is correct'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address'
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid phone number'
      });
    }

    const result = await pool.query(
      `INSERT INTO contact_requests
        (full_name, email, phone, subject, message, is_confirmed)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, email, phone, subject, message, is_confirmed, created_at`,
      [fullName, email, phone, subject, message, isConfirmed]
    );

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error while saving contact request:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to save contact request',
      error: error.message
    });
  }
});

app.post('/api/newsletter/subscribe', requireAuth, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email'
      });
    }

    const result = await pool.query(
      `INSERT INTO newsletter_subscribers (email)
       VALUES ($1)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, subscribed_at`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message: 'This email is already subscribed'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Subscription saved successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error while saving subscription:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to save subscription',
      error: error.message
    });
  }
});

app.get('/about.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/Portfolio.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Portfolio.html'));
});

app.get('/News.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'News.html'));
});

app.get('/news-article.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'news-article.html'));
});

app.get('/Contacts.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Contacts.html'));
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }

    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

app.use('/img', express.static(path.join(__dirname, 'img')));

app.use('/api', (err, req, res, next) => {
  console.error('API error:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

if (!IS_VERCEL) {
  prepareDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`
+----------------------------------------+
|         Server started successfully    |
|                                        |
|  URL: http://localhost:${PORT}
+----------------------------------------+
      `);
      });
    })
    .catch((error) => {
      console.error('Failed to prepare database tables:', error.message);
      process.exit(1);
    });
}

module.exports = app;
