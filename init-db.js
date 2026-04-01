require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
    try {
        console.log('🔧 Initializing database...');
        
        // Create teachers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS teachers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(20),
                subject VARCHAR(100),
                department VARCHAR(50),
                qualification VARCHAR(100),
                experience INTEGER,
                office_hours JSONB,
                employee_id VARCHAR(50) UNIQUE,
                photo_url TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        
        console.log('✅ Teachers table created');
        
        // Verify table exists
        const result = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'teachers'
        `);
        
        console.log('✅ Table verified with columns:', result.rows.map(r => r.column_name).join(', '));
        
        // Test insert
        const testResult = await pool.query(
            `INSERT INTO teachers (name, employee_id, department) VALUES ($1, $2, $3) RETURNING *`,
            ['Test Teacher', 'TEST001', 'Test Dept']
        );
        
        console.log('✅ Test insert successful:', testResult.rows[0]);
        
        // Clean up test
        await pool.query('DELETE FROM teachers WHERE employee_id = $1', ['TEST001']);
        console.log('✅ Test data cleaned up');
        
        console.log('✅✅✅ DATABASE READY! ✅✅✅');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

initDatabase();
