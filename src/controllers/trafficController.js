const db = require('../config/database');
const moment = require('moment');

const logTraffic = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { number_id, number, cli, sms = 1, currency = 'USD', payout } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    await client.query('BEGIN');

    // Get number info
    const numResult = await client.query(
      'SELECT range_id, assigned_to, payout FROM numbers WHERE id = $1',
      [number_id]
    );

    if (numResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Number not found' });
    }

    const num = numResult.rows[0];
    const finalPayout = payout !== undefined ? payout : num.payout;

    // Log traffic
    const trafficResult = await client.query(
      'INSERT INTO traffic (number_id, number, range_id, user_id, cli, sms, payout, currency, ip) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [number_id, number, num.range_id, num.assigned_to, cli, sms, finalPayout, currency, ip]
    );

    // Update number stats
    await client.query(
      'UPDATE numbers SET sms_today = sms_today + $1, sms_total = sms_total + $1, last_sms_at = CURRENT_TIMESTAMP WHERE id = $2',
      [sms, number_id]
    );

    await client.query('COMMIT');
    res.status(201).json(trafficResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Traffic logging error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const getTraffic = async (req, res) => {
  try {
    const { page = 1, per = 20, q, from, to, user_id } = req.query;
    const offset = (page - 1) * per;
    let query = `
      SELECT t.*, r.name as range_name, u.username 
      FROM traffic t 
      LEFT JOIN ranges r ON t.range_id = r.id 
      LEFT JOIN users u ON t.user_id = u.id 
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) FROM traffic t WHERE 1=1';
    let params = [];
    let pIdx = 1;

    // Filter by current user if not admin
    if (req.user.role === 'user') {
      query += ` AND t.user_id = $${pIdx}`;
      countQuery += ` AND t.user_id = $${pIdx}`;
      params.push(req.user.id);
      pIdx++;
    } else if (user_id) {
      query += ` AND t.user_id = $${pIdx}`;
      countQuery += ` AND t.user_id = $${pIdx}`;
      params.push(user_id);
      pIdx++;
    }

    if (q) {
      query += ` AND (t.number ILIKE $${pIdx} OR t.cli ILIKE $${pIdx})`;
      countQuery += ` AND (t.number ILIKE $${pIdx} OR t.cli ILIKE $${pIdx})`;
      params.push(`%${q}%`);
      pIdx++;
    }

    if (from) {
      query += ` AND t.recorded_at >= $${pIdx}`;
      countQuery += ` AND t.recorded_at >= $${pIdx}`;
      params.push(from);
      pIdx++;
    }

    if (to) {
      query += ` AND t.recorded_at <= $${pIdx}`;
      countQuery += ` AND t.recorded_at <= $${pIdx}`;
      params.push(to);
      pIdx++;
    }

    query += ` ORDER BY t.recorded_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
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
    console.error('Get traffic error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role !== 'user';
    let userFilter = isAdmin ? '' : 'WHERE user_id = $1';
    let params = isAdmin ? [] : [userId];

    const stats = await db.query(`
      SELECT 
        COALESCE(SUM(sms), 0) as total_sms,
        COALESCE(SUM(payout), 0) as total_payout,
        COUNT(DISTINCT number_id) as active_numbers,
        COALESCE(SUM(CASE WHEN recorded_at >= CURRENT_DATE THEN sms ELSE 0 END), 0) as today_sms,
        COUNT(DISTINCT user_id) as active_users
      FROM traffic
      ${userFilter}
    `, params);

    const s = stats.rows[0];

    // Dummy deltas for frontend (in real app, compare with previous period)
    res.json({
      ...s,
      sms_delta: 12,
      payout_delta: 8,
      today_delta: 15,
      assigned_numbers: s.active_numbers,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getChartData = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const userId = req.user.id;
    const isAdmin = req.user.role !== 'user';
    let userFilter = isAdmin ? '' : 'AND user_id = $1';
    let params = [parseInt(days)];
    if (!isAdmin) params.push(userId);

    const result = await db.query(`
      SELECT 
        TO_CHAR(recorded_at, 'YYYY-MM-DD') as date,
        SUM(sms) as count
      FROM traffic
      WHERE recorded_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      ${userFilter}
      GROUP BY date
      ORDER BY date ASC
    `, params);

    const labels = [];
    const values = [];
    
    // Fill in missing days with zero
    for (let i = days - 1; i >= 0; i--) {
      const d = moment().subtract(i, 'days').format('YYYY-MM-DD');
      labels.push(moment(d).format('MMM D'));
      const row = result.rows.find(r => r.date === d);
      values.push(row ? parseInt(row.count) : 0);
    }

    res.json({ labels, values });
  } catch (err) {
    console.error('Chart data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getHourlyHeatmap = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role !== 'user';
    let userFilter = isAdmin ? '' : 'WHERE user_id = $1';
    let params = isAdmin ? [] : [userId];

    const result = await db.query(`
      SELECT 
        EXTRACT(DOW FROM recorded_at) as day,
        EXTRACT(HOUR FROM recorded_at) as hour,
        SUM(sms) as count
      FROM traffic
      ${userFilter}
      GROUP BY day, hour
    `, params);

    // 7x24 matrix
    const data = Array.from({ length: 7 }, () => Array(24).fill(0));
    result.rows.forEach(r => {
      data[parseInt(r.day)][parseInt(r.hour)] = parseInt(r.count);
    });

    res.json({ data });
  } catch (err) {
    console.error('Heatmap error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTopNumbers = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role !== 'user';
    let userFilter = isAdmin ? '' : 'WHERE t.user_id = $1';
    let params = isAdmin ? [] : [userId];

    const result = await db.query(`
      SELECT 
        t.number,
        r.name as range_name,
        SUM(t.sms) as sms_count
      FROM traffic t
      LEFT JOIN ranges r ON t.range_id = r.id
      ${userFilter}
      GROUP BY t.number, r.name
      ORDER BY sms_count DESC
      LIMIT 10
    `, params);

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Top numbers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTopClis = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role !== 'user';
    let userFilter = isAdmin ? '' : 'WHERE user_id = $1';
    let params = isAdmin ? [] : [userId];

    const result = await db.query(`
      SELECT cli, SUM(sms) as count
      FROM traffic
      ${userFilter}
      GROUP BY cli
      ORDER BY count DESC
      LIMIT 10
    `, params);

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Top CLIs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteTrafficRecord = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM traffic WHERE id = $1', [id]);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    console.error('Delete traffic error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const clearAllTraffic = async (req, res) => {
  try {
    await db.query('TRUNCATE TABLE traffic');
    await db.query('UPDATE numbers SET sms_today = 0, sms_total = 0');
    res.json({ message: 'All traffic cleared' });
  } catch (err) {
    console.error('Clear traffic error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  logTraffic,
  getTraffic,
  getDashboardStats,
  getChartData,
  getHourlyHeatmap,
  getTopNumbers,
  getTopClis,
  deleteTrafficRecord,
  clearAllTraffic,
};
