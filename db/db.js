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

const databaseUrl = cleanConnectionString(
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DB
);
const hasDatabaseUrl = Boolean(databaseUrl);
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
  hasDatabaseUrl
    ? {
        connectionString: databaseUrl,
        ssl: isProduction ? { rejectUnauthorized: false } : undefined
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

module.exports = pool;
module.exports.hasDatabaseUrl = hasDatabaseUrl;
