const { Pool } = require('pg');
require('dotenv').config();

function cleanConnectionString(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .trim()
    .replace(/^DATABASE_URL\s*=\s*/i, '')
    .replace(/^["']|["']$/g, '');
}

function removeSslMode(connectionString) {
  return connectionString
    .replace(/[?&]sslmode=[^&]*/i, (match) => (match.startsWith('?') ? '?' : ''))
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

function getConnectionInfo(value) {
  if (!value) {
    return {
      mode: 'DB_* variables',
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: String(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'test_db',
      usesPooler: false,
      hasPassword: Boolean(process.env.DB_PASSWORD)
    };
  }

  try {
    const parsedUrl = new URL(value);
    const user = decodeURIComponent(parsedUrl.username || '');
    const host = parsedUrl.hostname;

    return {
      mode: 'DATABASE_URL',
      user,
      host,
      port: parsedUrl.port || null,
      database: parsedUrl.pathname.replace(/^\//, '') || null,
      usesPooler: host.includes('pooler.supabase.com'),
      hasPassword: Boolean(parsedUrl.password)
    };
  } catch (error) {
    return {
      mode: 'DATABASE_URL',
      parseError: error.message,
      usesPooler: /pooler\.supabase\.com/i.test(value),
      hasPassword: /:[^:@/]+@/.test(value)
    };
  }
}

const databaseUrl = cleanConnectionString(
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DB
);
const connectionString = removeSslMode(databaseUrl);
const connectionInfo = getConnectionInfo(connectionString);
const hasDatabaseUrl = Boolean(databaseUrl);
const isProduction = process.env.NODE_ENV === 'production';
const requiresSsl = hasDatabaseUrl && /sslmode=require|supabase\.co|pooler\.supabase\.com/i.test(databaseUrl);

const pool = new Pool(
  hasDatabaseUrl
    ? {
        connectionString,
        ssl: isProduction || requiresSsl ? { rejectUnauthorized: false } : undefined,
        max: Number(process.env.DB_POOL_MAX || 5),
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000
      }
    : {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'test_db'
      }
);

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

console.log('PostgreSQL pool configured:');
console.log(`   Mode: ${hasDatabaseUrl ? 'DATABASE_URL' : 'DB_* variables'}`);
console.log(`   Host: ${process.env.DB_HOST || (hasDatabaseUrl ? 'from DATABASE_URL' : 'localhost')}`);
console.log(`   Port: ${process.env.DB_PORT || (hasDatabaseUrl ? 'from DATABASE_URL' : 5432)}`);
console.log(`   Database: ${process.env.DB_NAME || (hasDatabaseUrl ? 'from DATABASE_URL' : 'test_db')}`);

pool.hasDatabaseUrl = hasDatabaseUrl;
pool.connectionInfo = connectionInfo;
module.exports = pool;
module.exports.pool = pool;
module.exports.hasDatabaseUrl = hasDatabaseUrl;
module.exports.connectionInfo = connectionInfo;
