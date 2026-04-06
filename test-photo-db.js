require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    try {
        console.log('\n========================================');
        console.log('🔍 DATABASE DIAGNOSTIC TEST');
        console.log('========================================\n');
        
        // Test 1: Check if photo_url column exists
        console.log('1️⃣ Checking if photo_url column exists...');
        const schema = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'teachers' AND column_name = 'photo_url'
        `);
        
        if (schema.rows.length > 0) {
            console.log('   ✅ photo_url column EXISTS');
            console.log('   Type:', schema.rows[0].data_type);
            console.log('   Nullable:', schema.rows[0].is_nullable);
        } else {
            console.log('   ❌ photo_url column NOT FOUND!');
            console.log('   👉 This is the problem! Column does not exist.');
        }
        
        // Test 2: List all columns
        console.log('\n2️⃣ All columns in teachers table:');
        const allCols = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'teachers'
            ORDER BY ordinal_position
        `);
        allCols.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type}`);
        });
        
        // Test 3: Try inserting a test photo
        console.log('\n3️⃣ Testing photo INSERT...');
        const testPhoto = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
        const testId = 'TEST-' + Date.now();
        
        try {
            const result = await pool.query(
                'INSERT INTO teachers (name, employee_id, photo_url) VALUES ($1, $2, $3) RETURNING id, photo_url',
                ['TEST_TEACHER', testId, testPhoto]
            );
            
            console.log('   ✅ INSERT executed without error');
            console.log('   Returned ID:', result.rows[0].id);
            
            if (result.rows[0].photo_url) {
                console.log('   ✅ Photo STORED in database');
                console.log('   Photo size:', result.rows[0].photo_url.length, 'bytes');
            } else {
                console.log('   ❌ Photo returned as NULL from database');
                console.log('   👉 Insert succeeded but photo_url is NULL');
            }
        } catch (e) {
            console.log('   ❌ INSERT failed with error:');
            console.log('   Error:', e.message);
            console.log('   Code:', e.code);
        }
        
        // Test 4: Check what's actually in the database
        console.log('\n4️⃣ Teachers with photos:');
        const withPhotos = await pool.query(
            'SELECT id, name, photo_url IS NOT NULL as has_photo FROM teachers LIMIT 5'
        );
        withPhotos.rows.forEach(t => {
            console.log(`   - ID ${t.id}: ${t.name} - Photo: ${t.has_photo ? '✅ YES' : '❌ NO'}`);
        });
        
        console.log('\n========================================');
        console.log('✅ Test completed\n');
        process.exit(0);
        
    } catch (e) {
        console.error('\n❌ Critical Error:', e.message);
        console.error('Stack:', e.stack);
        process.exit(1);
    }
}

test();
