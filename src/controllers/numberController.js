const db = require('../config/database');

const getNumbers = async (req, res) => {
  try {
    const { page = 1, per = 20, q, mine, range_id, status, active } = req.query;
    const offset = (page - 1) * per;
    let query = `
      SELECT n.*, r.name as range_name, u.username 
      FROM numbers n 
      LEFT JOIN ranges r ON n.range_id = r.id 
      LEFT JOIN users u ON n.assigned_to = u.id 
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) FROM numbers n WHERE 1=1';
    let params = [];
    let pIdx = 1;

    if (q) {
      query += ` AND (n.number ILIKE $${pIdx} OR u.username ILIKE $${pIdx})`;
      countQuery += ` AND (n.number ILIKE $${pIdx} OR u.username ILIKE $${pIdx})`;
      params.push(`%${q}%`);
      pIdx++;
    }

    if (mine === '1') {
      query += ` AND n.assigned_to = $${pIdx}`;
      countQuery += ` AND n.assigned_to = $${pIdx}`;
      params.push(req.user.id);
      pIdx++;
    }

    if (range_id) {
      query += ` AND n.range_id = $${pIdx}`;
      countQuery += ` AND n.range_id = $${pIdx}`;
      params.push(range_id);
      pIdx++;
    }

    if (status === 'assigned') {
      query += ' AND n.assigned_to IS NOT NULL';
      countQuery += ' AND n.assigned_to IS NOT NULL';
    } else if (status === 'stock') {
      query += ' AND n.assigned_to IS NULL';
      countQuery += ' AND n.assigned_to IS NULL';
    }

    if (active === '1') {
      query += ' AND n.active = true';
      countQuery += ' AND n.active = true';
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
    params.push(parseInt(per), offset);

    const result = await db.query(query, params);
    const countResult = await db.query(countQuery, params.slice(0, pIdx - 1));

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      per: parseInt(per),
    });
  } catch (err) {
    console.error('Get numbers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const allocateNumbers = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { range_id, user_id, qty, payout } = req.body;
    if (!range_id || !user_id || !qty) {
      return res.status(400).json({ error: 'Range ID, user ID, and quantity are required' });
    }

    await client.query('BEGIN');

    // Check stock
    const stockResult = await client.query(
      'SELECT id, name FROM ranges WHERE id = $1 AND stock_count >= $2',
      [range_id, qty]
    );
    if (stockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock in range' });
    }

    const range = stockResult.rows[0];

    // Get available numbers
    const numbersResult = await client.query(
      'SELECT id FROM numbers WHERE range_id = $1 AND assigned_to IS NULL LIMIT $2',
      [range_id, qty]
    );

    const numIds = numbersResult.rows.map(n => n.id);
    if (numIds.length < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Failed to find enough available numbers' });
    }

    // Assign numbers
    const payoutValue = payout || null;
    await client.query(
      `UPDATE numbers 
       SET assigned_to = $1, assigned_date = CURRENT_TIMESTAMP, payout = COALESCE($2, payout) 
       WHERE id = ANY($3)`,
      [user_id, payoutValue, numIds]
    );

    // Update range counts
    await client.query(
      'UPDATE ranges SET assigned_count = assigned_count + $1, stock_count = stock_count - $1 WHERE id = $2',
      [numIds.length, range_id]
    );

    // Get username for log
    const userResult = await client.query('SELECT username FROM users WHERE id = $1', [user_id]);
    const username = userResult.rows[0]?.username;

    // Log allocation
    await client.query(
      'INSERT INTO allocation_log (user_id, username, range_id, range_name, qty) VALUES ($1, $2, $3, $4, $5)',
      [user_id, username, range_id, range.name, numIds.length]
    );

    await client.query('COMMIT');
    res.json({ message: 'Numbers allocated successfully', allocated: numIds.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Allocation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const unassignNumber = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT range_id, assigned_to FROM numbers WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Number not found' });
    }

    const { range_id, assigned_to } = result.rows[0];
    if (!assigned_to) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Number is already in stock' });
    }

    await client.query(
      'UPDATE numbers SET assigned_to = NULL, assigned_date = NULL WHERE id = $1',
      [id]
    );

    await client.query(
      'UPDATE ranges SET assigned_count = assigned_count - 1, stock_count = stock_count + 1 WHERE id = $1',
      [range_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Number returned to stock' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Unassign error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const deleteNumber = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT range_id, assigned_to FROM numbers WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Number not found' });
    }

    const { range_id, assigned_to } = result.rows[0];

    await client.query('DELETE FROM numbers WHERE id = $1', [id]);

    // Update range counts
    if (assigned_to) {
      await client.query(
        'UPDATE ranges SET total_count = total_count - 1, assigned_count = assigned_count - 1 WHERE id = $1',
        [range_id]
      );
    } else {
      await client.query(
        'UPDATE ranges SET total_count = total_count - 1, stock_count = stock_count - 1 WHERE id = $1',
        [range_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Number deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete number error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const getAllocationLog = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM allocation_log ORDER BY created_at DESC LIMIT 100');
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get allocation log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getNumbers,
  allocateNumbers,
  unassignNumber,
  deleteNumber,
  getAllocationLog,
};
