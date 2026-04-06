const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await db.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    if (!user.active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_super_secret_key_min_32_chars',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        country: user.country,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const me = async (req, res) => {
  res.json(req.user);
};

const register = async (req, res) => {
  try {
    const { username, password, name, email, country, dev_code } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user exists
    const checkUser = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    let role = 'user';
    let code_id = null;

    // Check dev code if provided
    if (dev_code) {
      const checkCode = await db.query(
        'SELECT id FROM dev_codes WHERE code = $1 AND used = false',
        [dev_code]
      );
      if (checkCode.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or already used developer code' });
      }
      role = 'dev';
      code_id = checkCode.rows[0].id;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (username, password, name, email, country, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, name, email, country, role',
      [username, hashedPassword, name, email, country, role]
    );

    const newUser = result.rows[0];

    // Mark dev code as used
    if (code_id) {
      await db.query(
        'UPDATE dev_codes SET used = true, used_by = $1, used_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newUser.id, code_id]
      );
    }

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      process.env.JWT_SECRET || 'your_super_secret_key_min_32_chars',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      token,
      user: newUser,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, country } = req.body;
    const result = await db.query(
      'UPDATE users SET name = $1, email = $2, country = $3 WHERE id = $4 RETURNING id, username, name, email, country, role',
      [name, email, country, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    const result = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  me,
  register,
  updateProfile,
  changePassword,
};
