/*const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'node_api',
  password: '01022007',
  port: 5432,
});

pool.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch((err) => console.error('Error connecting to PostgreSQL database:', err));

app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM posts ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).send('Error fetching data from database');
  }
});

app.post('/posts/add', async (req, res) => {
    const { title, anons, full_text } = req.body;
  try {
    await pool.query('INSERT INTO posts (title, anons, full_text) VALUES ($1, $2, $3)', [title, anons, full_text]);
    res.send('Post added successfully');
  } catch (err) {
    res.status(500).send('Error fetching data from database');
  }
});

app.delete('/posts/:id', async (req, res) => {
    const { id } = req.params;
  try {
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    res.send('Post deleted successfully');
  } catch (err) {
    res.status(500).send('Error fetching data from database');
  }
});

app.listen(3000, () => {
  console.log('Server is running:http://localhost:3000');
});*/