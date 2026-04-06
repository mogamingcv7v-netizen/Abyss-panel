const db = require('../config/database');
const bcrypt = require('bcryptjs');

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, per = 20, q } = req.query;
    const offset = (page - 1) * per;
    let query = 'SELECT id, username, name, email, country, role, active, last_login, created_at FROM users WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    let params = [];

    if (q) {
      query += ' AND (username ILIKE $1 OR name ILIKE $1 OR email ILIKE $1)';
      countQuery += ' AND (username ILIKE $1 OR name ILIKE $1 OR email ILIKE $1)';
      params.push(`%${q}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(per), offset);

    const result = await db.query(query, params);
    const countResult = await db.query(countQuery, params.slice(0, params.length - 2));

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      per: parseInt(per),
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, username, name, email, country, role, active, last_login, created_at FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, password, name, email, country, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (username, password, name, email, country, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, name, email, country, role',
      [username, hashedPassword, name, email, country, role || 'user']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already taken' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, country, role } = req.body;
    const result = await db.query(
      'UPDATE users SET name = $1, email = $2, country = $3, role = $4 WHERE id = $5 RETURNING id, username, name, email, country, role',
      [name, email, country, role, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const toggleUserActive = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'UPDATE users SET active = NOT active WHERE id = $1 RETURNING active',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ active: result.rows[0].active });
  } catch (err) {
    console.error('Toggle user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteUser = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // Get assigned numbers to return to stock
    const numbersResult = await client.query('SELECT range_id, COUNT(*) as count FROM numbers WHERE assigned_to = $1 GROUP BY range_id', [id]);
    
    for (const row of numbersResult.rows) {
      await client.query(
        'UPDATE ranges SET assigned_count = assigned_count - $1, stock_count = stock_count + $1 WHERE id = $2',
        [row.count, row.range_id]
      );
    }

    await client.query('UPDATE numbers SET assigned_to = NULL, assigned_date = NULL WHERE assigned_to = $1', [id]);
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: 'User deleted and numbers returned to stock' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const getUserPerformance = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id, u.username, u.name,
        COUNT(DISTINCT n.id) as numbers_count,
        COALESCE(SUM(t.sms), 0) as sms_count,
        COALESCE(SUM(t.payout), 0) as total_payout
      FROM users u
      LEFT JOIN numbers n ON u.id = n.assigned_to
      LEFT JOIN traffic t ON u.id = t.user_id
      WHERE u.role = 'user'
      GROUP BY u.id, u.username, u.name
      ORDER BY sms_count DESC
    `);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('User performance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserActive,
  deleteUser,
  getUserPerformance,
};
