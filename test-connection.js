const {Pool} = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

pool.query('SELECT NOW() as time, current_database() as db', (err, res) => {
  if (err) {
    console.log('❌ Connection Failed');
    console.log('Error:', err.message);
    console.log('Code:', err.code);
  } else {
    console.log('✅ Connection Success!');
    console.log('Database:', res.rows[0].db);
    console.log('Time:', res.rows[0].time);
  }
  process.exit();
});
