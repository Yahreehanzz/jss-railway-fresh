require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrateDatabase() {
    try {
        console.log('🔧 Migrating database...');
        
        // Add employee_id column
        await pool.query(`
            ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;
        `);
        console.log('✅ Added employee_id column');
        
        // Add photo_url column
        await pool.query(`
            ALTER TABLE teachers ADD COLUMN IF NOT EXISTS photo_url TEXT;
        `);
        console.log('✅ Added photo_url column');
        
        // Verify columns exist
        const result = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'teachers'
            ORDER BY ordinal_position
        `);
        
        console.log('✅ Teachers table columns:');
        result.rows.forEach(row => console.log(`   - ${row.column_name}`));
        
        console.log('\n✅✅✅ DATABASE MIGRATION COMPLETE! ✅✅✅');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

migrateDatabase();
