const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const getDevCodes = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM dev_codes ORDER BY created_at DESC');
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get dev codes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const generateDevCode = async (req, res) => {
  try {
    const code = `DEV-${uuidv4().substring(0, 8).toUpperCase()}`;
    const result = await db.query(
      'INSERT INTO dev_codes (code, created_by) VALUES ($1, $2) RETURNING *',
      [code, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Generate dev code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteDevCode = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM dev_codes WHERE id = $1', [id]);
    res.json({ message: 'Code deleted' });
  } catch (err) {
    console.error('Delete dev code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSystemInfo = async (req, res) => {
  try {
    const userCount = await db.query('SELECT COUNT(*) FROM users');
    const numberCount = await db.query('SELECT COUNT(*) FROM numbers');
    const dbVersion = await db.query('SELECT version()');

    const formatMemory = (bytes) => {
      const mb = bytes / (1024 * 1024);
      return mb.toFixed(2) + ' MB';
    };

    const formatUptime = (seconds) => {
      const days = Math.floor(seconds / (24 * 3600));
      const hours = Math.floor((seconds % (24 * 3600)) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${days}d ${hours}h ${minutes}m`;
    };

    res.json({
      node_version: process.version,
      uptime: formatUptime(process.uptime()),
      memory_used: formatMemory(process.memoryUsage().rss),
      db_version: dbVersion.rows[0].version.split(',')[0],
      total_users: parseInt(userCount.rows[0].count),
      total_numbers: parseInt(numberCount.rows[0].count),
      os_platform: os.platform(),
      os_release: os.release(),
    });
  } catch (err) {
    console.error('System info error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getDevCodes,
  generateDevCode,
  deleteDevCode,
  getSystemInfo,
};
