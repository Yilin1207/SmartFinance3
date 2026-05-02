// ============= ПРИМЕРЫ РАСШИРЕНИЯ API =============
// 
// Этот файл показывает, как добавить дополнительные маршруты и функции
// Скопируйте нужный код в routes/users.js

// ===== Пример 1: Получить одного пользователя по ID =====
/*
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении пользователя'
    });
  }
});
*/

// ===== Пример 2: Обновить пользователя =====
/*
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Поля name и email обязательны'
      });
    }
    
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *',
      [name, email, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    res.json({
      success: true,
      message: 'Пользователь обновлен',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении пользователя'
    });
  }
});
*/

// ===== Пример 3: Удалить пользователя =====
/*
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    res.json({
      success: true,
      message: 'Пользователь удален',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении пользователя'
    });
  }
});
*/

// ===== Пример 4: Поиск по email =====
/*
router.get('/search', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Параметр email обязателен'
      });
    }
    
    const result = await pool.query(
      'SELECT * FROM users WHERE email ILIKE $1',
      [`%${email}%`]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка при поиске'
    });
  }
});
*/

// ===== Пример 5: Создание таблицы для сообщений =====
/*
// Сначала создайте таблицу в БД:
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// Затем добавьте этот маршрут:
router.post('/messages', async (req, res) => {
  try {
    const { user_id, subject, content } = req.body;
    
    if (!user_id || !subject || !content) {
      return res.status(400).json({
        success: false,
        message: 'Все поля обязательны'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO messages (user_id, subject, content) VALUES ($1, $2, $3) RETURNING *',
      [user_id, subject, content]
    );
    
    res.status(201).json({
      success: true,
      message: 'Сообщение отправлено',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка при отправке сообщения'
    });
  }
});
*/

// ===== Пример 6: Статистика пользователей =====
/*
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_week,
        MIN(created_at) as first_user_date,
        MAX(created_at) as last_user_date
      FROM users
    `);
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики'
    });
  }
});
*/

// ===== Как использовать эти примеры =====
/*
1. Раскомментируйте нужный код
2. Добавьте его в routes/users.js
3. Перезагрузите сервер
4. Протестируйте новый маршрут

Примеры запросов:

// Получить пользователя по ID
GET http://localhost:3000/api/users/1

// Обновить пользователя
PUT http://localhost:3000/api/users/1
{
  "name": "Новое имя",
  "email": "new@example.com"
}

// Удалить пользователя
DELETE http://localhost:3000/api/users/1

// Поиск по email
GET http://localhost:3000/api/search?email=ivan

// Отправить сообщение
POST http://localhost:3000/api/messages
{
  "user_id": 1,
  "subject": "Тест",
  "content": "Содержание сообщения"
}

// Статистика
GET http://localhost:3000/api/stats
*/
