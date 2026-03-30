const { Pool } = require('pg');

const dbUrl = 'postgresql://postgres:OQzangvNttXuPESssyHyTrnnpXyuwDRi@hopper.proxy.rlwy.net:59337/railway';

console.log('\n🔍 Testing DATABASE_URL Connection...\n');
console.log('URL:', dbUrl.replace(/:[^@]*@/, ':****@'), '\n');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

pool.query('SELECT NOW() as time, current_database() as db, COUNT(*) as table_count FROM information_schema.tables WHERE table_schema=\'public\'', 
  (err, res) => {
    if (err) {
      console.log('❌ Connection FAILED');
      console.log('Error:', err.message);
      console.log('Code:', err.code);
    } else {
      console.log('✅ Connection SUCCESS!');
      console.log('Database Name:', res.rows[0].db);
      console.log('Current Time:', res.rows[0].time);
      console.log('Public Tables:', res.rows[0].table_count);
      console.log('\n✅ This DATABASE_URL is CORRECT and working!\n');
    }
    process.exit(0);
  }
);

setTimeout(() => {
  console.log('❌ TIMEOUT - Connection took too long');
  process.exit(1);
}, 12000);
