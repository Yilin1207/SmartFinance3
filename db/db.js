const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'test_db'
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

console.log('PostgreSQL pool configured:');
console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
console.log(`   Port: ${process.env.DB_PORT || 5432}`);
console.log(`   Database: ${process.env.DB_NAME || 'test_db'}`);

module.exports = pool;
