require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migratePhotoStorage() {
    try {
        console.log('📋 Checking current teachers table schema...\n');
        
        // Check current schema
        const schemaResult = await pool.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'teachers'
            ORDER BY ordinal_position
        `);
        
        console.log('Current columns:');
        schemaResult.rows.forEach(col => {
            const type = col.character_maximum_length 
                ? `${col.data_type}(${col.character_maximum_length})` 
                : col.data_type;
            console.log(`  - ${col.column_name}: ${type}, nullable: ${col.is_nullable}`);
        });
        
        // Check if photo_url exists
        const photoCol = schemaResult.rows.find(c => c.column_name === 'photo_url');
        
        if (!photoCol) {
            console.log('\n❌ photo_url column MISSING! Adding it...');
            await pool.query(`
                ALTER TABLE teachers
                ADD COLUMN photo_url TEXT
            `);
            console.log('✅ photo_url column added');
        } else {
            console.log(`\n✅ photo_url column exists: ${photoCol.data_type}`);
            if (photoCol.data_type !== 'text') {
                console.log('⚠️  Column type is not TEXT. Consider converting...');
                console.log('   Current type:', photoCol.data_type);
            }
        }
        
        // TEST: Insert a test photo
        console.log('\n🧪 Testing photo insertion...');
        const testPhoto = 'data:image/jpeg;base64,' + 'A'.repeat(10000); // 10KB test
        
        try {
            const result = await pool.query(`
                INSERT INTO teachers (name, employee_id, photo_url)
                VALUES ($1, $2, $3)
                RETURNING id, photo_url
            `, ['Test Teacher', 'TEST_MIGRATION_' + Date.now(), testPhoto]);
            
            if (result.rows.length > 0) {
                const saved = result.rows[0];
                console.log('✅ Test insert successful');
                console.log('   ID:', saved.id);
                console.log('   Photo saved:', saved.photo_url ? 'YES (' + saved.photo_url.length + ' bytes)' : 'NO');
                
                if (saved.photo_url) {
                    console.log('   ✅ Photo storage is working!');
                } else {
                    console.log('   ❌ Photo NOT stored! This is the problem.');
                }
            }
        } catch (err) {
            console.error('❌ Test insert failed:', err.message);
        }
        
        console.log('\n✅ Migration check complete');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

migratePhotoStorage();
