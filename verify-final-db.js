require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verifyAndFixDatabase() {
    try {
        console.log('🔧 Verifying database schema...\n');
        
        // Get all columns
        const result = await pool.query(`
            SELECT column_name, data_type FROM information_schema.columns 
            WHERE table_name = 'teachers'
            ORDER BY ordinal_position
        `);
        
        console.log('📋 Current columns in teachers table:');
        result.rows.forEach(row => console.log(`   ✓ ${row.column_name} (${row.data_type})`));
        
        // Add missing columns
        const columnsToAdd = [
            { name: 'designation', type: 'VARCHAR(100)' },
            { name: 'gender', type: 'VARCHAR(20)' },
            { name: 'date_of_joining', type: 'DATE' },
            { name: 'experience', type: 'INTEGER' },
            { name: 'qualification', type: 'VARCHAR(100)' },
            { name: 'office_hours', type: 'JSONB' },
            { name: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' }
        ];
        
        console.log('\n🔧 Adding missing columns...');
        
        for (const col of columnsToAdd) {
            try {
                await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`);
                console.log(`   ✅ Added: ${col.name}`);
            } catch (err) {
                console.log(`   ℹ️  ${col.name}: ${err.message}`);
            }
        }
        
        // Verify final schema
        console.log('\n📋 Final teachers table schema:');
        const finalResult = await pool.query(`
            SELECT column_name, data_type FROM information_schema.columns 
            WHERE table_name = 'teachers'
            ORDER BY ordinal_position
        `);
        
        finalResult.rows.forEach(row => console.log(`   ✓ ${row.column_name}`));
        
        // Test insert with all fields
        console.log('\n🧪 Testing insert with all fields...');
        const testInsert = await pool.query(
            `INSERT INTO teachers (
                name, email, phone, subject, department, 
                designation, gender, date_of_joining, qualification, 
                experience, employee_id, photo_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [
                'Test Teacher', 'test@example.com', '1234567890', 
                'Computer Science', 'Information Science',
                'Senior Lecturer', 'Male', '2024-01-01', 'B.E',
                5, 'TEST_FINAL_001', null
            ]
        );
        
        console.log('✅ Test insert successful!');
        console.log('   ID:', testInsert.rows[0].id);
        console.log('   Name:', testInsert.rows[0].name);
        console.log('   Department:', testInsert.rows[0].department);
        console.log('   Designation:', testInsert.rows[0].designation);
        console.log('   Gender:', testInsert.rows[0].gender);
        
        // Clean up
        await pool.query('DELETE FROM teachers WHERE employee_id = $1', ['TEST_FINAL_001']);
        
        console.log('\n✅✅✅ DATABASE IS PERFECT! READY TO GO! ✅✅✅');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifyAndFixDatabase();
