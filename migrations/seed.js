const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'abyss_panel',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@abyss.com';

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    await client.query(
      'INSERT INTO users (username, password, name, email, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING',
      [adminUsername, hashedPassword, 'System Admin', adminEmail, 'superadmin']
    );

    console.log(`Seeded admin user: ${adminUsername}`);
    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
