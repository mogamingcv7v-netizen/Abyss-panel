const db = require('../config/database');

const getTargets = async (req, res) => {
  try {
    const { user_id } = req.params;
    let query = 'SELECT * FROM targets';
    let params = [];

    if (user_id) {
      query += ' WHERE user_id = $1';
      params.push(user_id);
    }

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get targets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateTarget = async (req, res) => {
  try {
    const { user_id, type } = req.params;
    const { value } = req.body;

    if (!['daily', 'monthly'].includes(type)) {
      return res.status(400).json({ error: 'Invalid target type' });
    }

    const result = await db.query(
      `INSERT INTO targets (user_id, type, value) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id, type) 
       DO UPDATE SET value = EXCLUDED.value 
       RETURNING *`,
      [user_id, type, value]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update target error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getTargets,
  updateTarget,
};
