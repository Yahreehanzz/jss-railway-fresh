// Database migration script - creates all tables
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log('🔄 Starting database migration...');
        console.log(`📍 Database: ${process.env.DATABASE_URL ? 'Connected' : 'No DATABASE_URL'}`);

        // Read the SQL schema file
        const schemaPath = path.join(__dirname, 'database_schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Connect to database
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL');

        // Execute the schema
        try {
            await client.query(schema);
            console.log('✅ All tables created successfully!');
            
            // Verify tables were created
            const result = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            `);
            
            console.log('\n📊 Tables created:');
            result.rows.forEach(row => {
                console.log(`   ✓ ${row.table_name}`);
            });

        } catch (err) {
            console.error('❌ Error executing schema:', err.message);
            throw err;
        } finally {
            client.release();
        }

        console.log('\n✨ Migration completed successfully!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('   Cannot connect to PostgreSQL - check DATABASE_URL');
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
