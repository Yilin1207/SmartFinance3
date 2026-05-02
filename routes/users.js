const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// GET все пользователи
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, created_at FROM users ORDER BY id DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Ошибка при получении пользователей:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении пользователей',
      error: error.message
    });
  }
});

// POST регистрация нового пользователя
router.post('/register', async (req, res) => {
  try {
    const { name, email } = req.body;

    // Проверка входных данных
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Поля name и email обязательны'
      });
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный формат email'
      });
    }

    // Вставка пользователя в БД
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at',
      [name, email]
    );

    res.status(201).json({
      success: true,
      message: 'Пользователь успешно зарегистрирован',
      data: result.rows[0]
    });
  } catch (error) {
    // Проверка на дублирование email
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Email уже зарегистрирован'
      });
    }

    console.error('Ошибка при регистрации:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при регистрации пользователя',
      error: error.message
    });
  }
});

module.exports = router;
