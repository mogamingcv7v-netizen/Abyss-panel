const db = require('../config/database');
const fs = require('fs');

const getAllRanges = async (req, res) => {
  try {
    const { q } = req.query;
    let query = 'SELECT * FROM ranges';
    let params = [];

    if (q) {
      query += ' WHERE name ILIKE $1 OR country ILIKE $1 OR prefix ILIKE $1';
      params.push(`%${q}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get ranges error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getRangeById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM ranges WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Range not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get range error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const uploadRange = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, default_payout, default_payterm } = req.body;
    const content = fs.readFileSync(req.file.path, 'utf8');
    const numbers = content.split('\n').map(n => n.trim()).filter(n => n.length > 0);

    if (numbers.length === 0) {
      return res.status(400).json({ error: 'File is empty or invalid' });
    }

    // Basic auto-detect country/prefix from first number
    const firstNum = numbers[0];
    let prefix = '';
    let country = 'Unknown';

    if (firstNum.startsWith('+')) {
      prefix = firstNum.substring(0, 4); // Simplified
      country = 'Auto-detected';
    } else if (firstNum.startsWith('44')) {
      prefix = '44';
      country = 'United Kingdom';
    } else if (firstNum.startsWith('1')) {
      prefix = '1';
      country = 'USA/Canada';
    }

    const rangeName = name || `Range-${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random()*1000)}`;

    const rangeResult = await db.query(
      'INSERT INTO ranges (name, country, prefix, default_payout, default_payterm, total_count, stock_count) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [rangeName, country, prefix, default_payout || 0, default_payterm || 30, numbers.length, numbers.length]
    );

    const range = rangeResult.rows[0];

    // Bulk insert numbers
    // Note: For very large files, use a stream or pg-copy-streams
    for (const num of numbers) {
      await db.query(
        'INSERT INTO numbers (number, range_id, country, payout, payterm) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (number) DO NOTHING',
        [num, range.id, country, range.default_payout, range.default_payterm]
      );
    }

    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Range uploaded and imported successfully',
      range,
      count: numbers.length,
    });
  } catch (err) {
    console.error('Upload range error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateRange = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, default_payout, default_payterm } = req.body;
    const result = await db.query(
      'UPDATE ranges SET name = $1, default_payout = $2, default_payterm = $3 WHERE id = $4 RETURNING *',
      [name, default_payout, default_payterm, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Range not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update range error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteRange = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM ranges WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Range not found' });
    }
    res.json({ message: 'Range and associated numbers deleted' });
  } catch (err) {
    console.error('Delete range error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllRanges,
  getRangeById,
  uploadRange,
  updateRange,
  deleteRange,
};
