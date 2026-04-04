#!/usr/bin/env node
/**
 * Maintenance Script: Populate Student Years
 * 
 * This script populates missing 'year' fields for students based on their semester or batch_year.
 * Can be run from command line or integrated into deployment process.
 * 
 * Usage: node populate-student-years.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function populateStudentYears() {
    try {
        console.log('🔧 Starting student year population...\n');
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Count students with missing years BEFORE
        const beforeResult = await client.query(`
            SELECT COUNT(*) as count FROM students 
            WHERE year IS NULL OR year = ''
        `);
        console.log(`📊 Students with missing years (BEFORE): ${beforeResult.rows[0].count}\n`);
        
        // Strategy 1: Populate from semester
        console.log('📝 Strategy 1: Populate from semester...');
        const sem = await client.query(`
            UPDATE students 
            SET year = CASE 
                WHEN semester IN (1, 2) OR semester::text IN ('1', '2') THEN '1st Year'
                WHEN semester IN (3, 4) OR semester::text IN ('3', '4') THEN '2nd Year'
                WHEN semester IN (5, 6) OR semester::text IN ('5', '6') THEN '3rd Year'
                ELSE year
            END,
            updated_at = NOW()
            WHERE (year IS NULL OR year = '') AND semester IS NOT NULL
        `);
        console.log(`   ✓ Updated ${sem.rowCount} students based on semester\n`);
        
        // Strategy 2: Populate from batch_year
        console.log('📝 Strategy 2: Populate from batch_year...');
        const batch = await client.query(`
            UPDATE students 
            SET year = CASE 
                WHEN EXTRACT(YEAR FROM CURRENT_DATE) - batch_year::integer <= 1 THEN '1st Year'
                WHEN EXTRACT(YEAR FROM CURRENT_DATE) - batch_year::integer <= 2 THEN '2nd Year'
                WHEN EXTRACT(YEAR FROM CURRENT_DATE) - batch_year::integer <= 3 THEN '3rd Year'
                ELSE '3rd Year'
            END,
            updated_at = NOW()
            WHERE (year IS NULL OR year = '') AND batch_year IS NOT NULL
        `);
        console.log(`   ✓ Updated ${batch.rowCount} students based on batch_year\n`);
        
        // Get final count
        const afterResult = await client.query(`
            SELECT COUNT(*) as count FROM students 
            WHERE year IS NULL OR year = ''
        `);
        console.log(`📊 Students with missing years (AFTER): ${afterResult.rows[0].count}\n`);
        
        // Show year distribution
        console.log('📈 Final Year Distribution:');
        const distribution = await client.query(`
            SELECT year, COUNT(*) as count, branch
            FROM students
            WHERE year IS NOT NULL AND year != ''
            GROUP BY year, branch
            ORDER BY 
                CASE 
                    WHEN year = '1st Year' THEN 1
                    WHEN year = '2nd Year' THEN 2
                    WHEN year = '3rd Year' THEN 3
                    ELSE 4
                END,
                branch
        `);
        
        distribution.rows.forEach(row => {
            console.log(`   ${row.year} (${row.branch || 'N/A'}): ${row.count} students`);
        });
        
        const totalByYear = await client.query(`
            SELECT year, COUNT(*) as count
            FROM students
            WHERE year IS NOT NULL AND year != ''
            GROUP BY year
            ORDER BY 
                CASE 
                    WHEN year = '1st Year' THEN 1
                    WHEN year = '2nd Year' THEN 2
                    WHEN year = '3rd Year' THEN 3
                    ELSE 4
                END
        `);
        
        console.log('\n📊 Total by Year:');
        totalByYear.rows.forEach(row => {
            console.log(`   ${row.year}: ${row.count} students`);
        });
        
        const total = totalByYear.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
        console.log(`\n   TOTAL: ${total} students\n`);
        
        client.release();
        
        console.log('✨ Population completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('   Cannot connect to PostgreSQL - check DATABASE_URL');
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the script
populateStudentYears();
