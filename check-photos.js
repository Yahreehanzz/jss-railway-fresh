require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkPhotos() {
    try {
        console.log('\n📊 CHECKING TEACHER PHOTOS IN DATABASE\n');
        
        // Get all teachers
        const result = await pool.query(`
            SELECT 
                id, 
                name, 
                employee_id, 
                photo_url,
                CASE WHEN photo_url IS NOT NULL THEN LENGTH(photo_url::text) ELSE 0 END as photo_size,
                created_at
            FROM teachers
            ORDER BY id DESC
            LIMIT 20
        `);
        
        console.log(`Found ${result.rows.length} teachers\n`);
        
        result.rows.forEach((t, idx) => {
            console.log(`${idx + 1}. ID: ${t.id} | Name: ${t.name} | Emp ID: ${t.employee_id}`);
            console.log(`   Photo: ${t.photo_url ? 'YES (' + t.photo_size + ' bytes)' : 'NO'}`);
            if (t.photo_url) {
                console.log(`   Preview: ${t.photo_url.substring(0, 50)}...`);
            }
            console.log('');
        });
        
        // Summary
        const withPhotos = result.rows.filter(t => t.photo_url && t.photo_size > 0).length;
        const totalSize = result.rows.reduce((sum, t) => sum + (t.photo_size || 0), 0);
        
        console.log(`\n📈 SUMMARY:`);
        console.log(`  Total teachers: ${result.rows.length}`);
        console.log(`  Teachers with photos: ${withPhotos}`);
        console.log(`  Total photo data: ${totalSize} bytes (${Math.round(totalSize / 1024 / 1024 * 100) / 100} MB)`);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

checkPhotos();
