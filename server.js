require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE - VERY FIRST
// ============================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================================
// DATABASE CONNECTION
// ============================================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ DATABASE CONNECTION FAILED:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Database connected successfully');
        if (client) release();
    }
});

// ============================================================
// INITIALIZE DATABASE SCHEMA
// ============================================================
async function initDatabase() {
    try {
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
                designation VARCHAR(100),
                gender VARCHAR(20),
                date_of_joining DATE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Teachers table ready');
    } catch (err) {
        console.error('❌ Database initialization error:', err.message);
    }
}

initDatabase();

// ============================================================
// HEALTH CHECKS
// ============================================================
app.get('/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running', db: 'connected' });
});

// ============================================================
// TEACHERS API ENDPOINTS
// ============================================================

// GET all teachers (with all columns)
app.get('/api/teachers', async (req, res) => {
    try {
        console.group('📖 GET /api/teachers - FETCHING ALL TEACHERS');
        const result = await pool.query(`
            SELECT id, name, email, phone, subject, department, employee_id, 
                   photo_url, designation, gender, date_of_joining, qualification, 
                   experience, created_at, updated_at 
            FROM teachers 
            ORDER BY name
        `);
        console.log(`✅ Retrieved ${result.rows.length} teachers from database`);
        
        // Log photo status for each teacher
        let teachersWithPhotos = 0;
        let totalPhotoBytes = 0;
        
        result.rows.forEach((teacher, idx) => {
            if (teacher.photo_url) {
                teachersWithPhotos++;
                totalPhotoBytes += teacher.photo_url.length;
            }
        });
        
        console.log(`📸 Teachers with photos: ${teachersWithPhotos} out of ${result.rows.length}`);
        console.log(`📊 Total photo data: ${totalPhotoBytes} bytes`);
        
        // Log first teacher details
        if (result.rows.length > 0) {
            const first = result.rows[0];
            console.log(`First teacher: "${first.name}" (ID: ${first.id})`);
            console.log(`  - Has photo: ${!!first.photo_url}`);
            if (first.photo_url) {
                console.log(`  - Photo size: ${first.photo_url.length} bytes`);
                console.log(`  - Photo preview: ${first.photo_url.substring(0, 50)}...`);
            }
        }
        console.groupEnd();
        
        res.json({ success: true, data: result.rows, count: result.rows.length });
    } catch (e) {
        console.error('❌ GET /api/teachers ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST - Add new teacher
app.post('/api/teachers', async (req, res) => {
    let client;
    try {
        console.log('\n========================================');
        console.log('📝 POST /api/teachers - START');
        console.log('========================================\n');
        
        const { name, email, phone, subject, department, employee_id, designation, gender, date_of_joining, qualification, experience, photo_url } = req.body;
        
        console.log('📬 RECEIVED DATA:');
        console.log('  Name:', name);
        console.log('  Employee ID:', employee_id);
        console.log('  Photo provided:', !!photo_url);
        if (photo_url) {
            console.log('  Photo type:', typeof photo_url);
            console.log('  Photo length:', photo_url.length, 'bytes');
            console.log('  Photo starts with:', photo_url.substring(0, 30) + '...');
        }
        
        if (!name || !employee_id) {
            console.error('❌ VALIDATION: Missing required fields');
            return res.status(400).json({ success: false, error: 'Name and employee_id are required' });
        }
        
        const values = [
            name.trim(),           // $1
            email || null,         // $2
            phone || null,         // $3
            subject || null,       // $4
            department || null,    // $5
            employee_id.trim(),    // $6
            designation || null,   // $7
            gender || null,        // $8
            date_of_joining || null, // $9
            qualification || null, // $10
            experience || null,    // $11
            photo_url || null      // $12
        ];
        
        console.log('\n🔧 PREPARED VALUES:');
        console.log('  [1] name:', values[0]);
        console.log('  [6] employee_id:', values[5]);
        console.log('  [12] photo_url length:', values[11] ? values[11].length + ' bytes' : 'NULL');
        console.log('  [12] photo_url is string:', typeof values[11] === 'string');
        console.log('  [12] photo_url starts:', values[11] ? values[11].substring(0, 30) : 'N/A');
        
        const query = `
            INSERT INTO teachers 
            (name, email, phone, subject, department, employee_id, designation, gender, date_of_joining, qualification, experience, photo_url) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING id, name, employee_id, photo_url, designation, gender
        `;
        
        console.log('\n⚙️ EXECUTING INSERT...');
        const result = await pool.query(query, values);
        
        if (!result.rows || result.rows.length === 0) {
            throw new Error('INSERT returned no rows');
        }
        
        const savedTeacher = result.rows[0];
        
        console.log('\n✅ INSERT SUCCESSFUL');
        console.log('  Returned ID:', savedTeacher.id);
        console.log('  Returned name:', savedTeacher.name);
        console.log('  Returned employee_id:', savedTeacher.employee_id);
        
        console.log('\n🔍 CRITICAL CHECK - PHOTO IN DATABASE:');
        console.log('  photo_url field exists:', 'photo_url' in savedTeacher);
        console.log('  photo_url value:', savedTeacher.photo_url ? 'HAS VALUE' : 'NULL/UNDEFINED');
        
        if (savedTeacher.photo_url) {
            console.log('  ✅ PHOTO STORED SUCCESSFULLY');
            console.log('  Size:', savedTeacher.photo_url.length, 'bytes');
            console.log('  Starts with:', savedTeacher.photo_url.substring(0, 30) + '...');
        } else {
            console.log('  ❌ PHOTO NOT IN DATABASE!');
            if (values[11]) {
                console.log('  Problem: We sent', values[11].length, 'bytes but database returned NULL');
                console.log('  This suggests the INSERT silently dropped the photo_url');
            }
        }
        
        console.log('\n📤 SENDING RESPONSE');
        res.status(201).json({ 
            success: true, 
            data: savedTeacher,
            message: 'Teacher saved successfully'
        });
        
        console.log('✅ Response sent\n');
        
    } catch (e) {
        console.error('\n❌ ERROR OCCURRED');
        console.error('  Message:', e.message);
        console.error('  Code:', e.code);
        console.error('  Severity:', e.severity);
        if (e.detail) console.error('  Detail:', e.detail);
        if (e.stack) console.error('  Stack:', e.stack);
        console.log('========================================\n');
        
        res.status(500).json({ 
            success: false, 
            error: e.message,
            code: e.code
        });
    }
});

// PUT - Update teacher
app.put('/api/teachers/:id', async (req, res) => {
    try {
        const { name, email, phone, subject, department, employee_id, designation, gender, date_of_joining, qualification, experience, photo_url } = req.body;
        
        const query = `
            UPDATE teachers 
            SET name=$1, email=$2, phone=$3, subject=$4, department=$5, employee_id=$6, designation=$7, gender=$8, date_of_joining=$9, qualification=$10, experience=$11, photo_url=$12, updated_at=NOW() 
            WHERE id=$13 
            RETURNING *
        `;
        
        const result = await pool.query(query, [name, email, phone, subject, department, employee_id, designation, gender, date_of_joining, qualification, experience, photo_url || null, req.params.id]);
        res.json({ success: true, data: result.rows[0] || null });
    } catch (e) {
        console.error('❌ PUT /api/teachers ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// DELETE - Remove teacher
app.delete('/api/teachers/:id', async (req, res) => {
    try {
        console.log('🗑️  DELETE /api/teachers/' + req.params.id);
        await pool.query('DELETE FROM teachers WHERE id=$1', [req.params.id]);
        res.json({ success: true, message: 'Teacher deleted' });
    } catch (e) {
        console.error('❌ DELETE /api/teachers ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// DEBUG - Get single teacher to verify photo
app.get('/api/teacher/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, email, phone, subject, department, employee_id, 
                   photo_url, designation, gender, date_of_joining, qualification, 
                   experience, created_at, updated_at 
            FROM teachers 
            WHERE id = $1 OR employee_id = $1
            LIMIT 1
        `, [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.json({ success: false, error: 'Teacher not found' });
        }
        
        const teacher = result.rows[0];
        const photoInfo = teacher.photo_url ? `YES - ${teacher.photo_url.length} bytes` : 'NO';
        console.log(`📸 Teacher ${teacher.name}: Photo = ${photoInfo}`);
        
        res.json({ success: true, data: teacher });
    } catch (e) {
        console.error('❌ GET /api/teacher/:id ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// DEBUG - Verify photos are stored
// TEST: Check teachers table schema
app.get('/api/test-schema', async (req, res) => {
    try {
        console.log('🔍 Testing teachers table schema...');
        
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'teachers'
            ORDER BY ordinal_position
        `);
        
        console.log('📋 Teachers table columns:');
        result.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
        const photoCol = result.rows.find(c => c.column_name === 'photo_url');
        if (photoCol) {
            console.log(`✅ photo_url column exists: ${photoCol.data_type}`);
        } else {
            console.error('❌ photo_url column MISSING!');
        }
        
        res.json({
            columns: result.rows,
            photo_url_exists: !!photoCol,
            photo_url_type: photoCol?.data_type || 'NOT FOUND'
        });
    } catch (e) {
        console.error('Error checking schema:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// TEST: Insert photo and verify it's returned
app.post('/api/test-photo-insert', async (req, res) => {
    try {
        const testPhoto = 'data:image/jpeg;base64,' + 'A'.repeat(5000); // 5KB test photo
        
        console.log('\n🧪 TEST: Inserting photo...');
        console.log('   Test photo size:', testPhoto.length, 'bytes');
        
        const query = `
            INSERT INTO teachers (name, employee_id, photo_url)
            VALUES ($1, $2, $3)
            RETURNING id, name, employee_id, photo_url
        `;
        
        const result = await pool.query(query, [
            'Test Teacher',
            'TEST-' + Date.now(),
            testPhoto
        ]);
        
        const row = result.rows[0];
        console.log('   Inserted ID:', row.id);
        console.log('   Returned photo:', !!row.photo_url);
        console.log('   Returned photo length:', row.photo_url ? row.photo_url.length : 0);
        
        if (row.photo_url && row.photo_url.length === testPhoto.length) {
            console.log('   ✅ TEST PASSED: Photo fully stored and returned');
        } else {
            console.log('   ❌ TEST FAILED: Photo not properly stored');
        }
        
        res.json({
            test_passed: row.photo_url && row.photo_url.length === testPhoto.length,
            inserted_size: testPhoto.length,
            returned_size: row.photo_url ? row.photo_url.length : 0,
            id: row.id
        });
    } catch (e) {
        console.error('Test error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET - Verify photos
app.get('/api/verify-photos', async (req, res) => {
    try {
        console.log('🔍 Verifying photos in database...');
        const result = await pool.query(`
            SELECT id, name, employee_id, photo_url,
                   CASE WHEN photo_url IS NOT NULL THEN LENGTH(photo_url::text)
                        ELSE 0 END as photo_bytes
            FROM teachers
            ORDER BY id DESC
        `);
        
        const summary = {
            total: result.rows.length,
            with_photos: result.rows.filter(t => t.photo_url && t.photo_bytes > 0).length,
            teachers: result.rows.map(r => ({
                id: r.id,
                name: r.name,
                employee_id: r.employee_id,
                photo_status: r.photo_bytes > 0 ? `YES - ${r.photo_bytes} bytes` : 'NO',
                photo_starts: r.photo_url ? r.photo_url.substring(0, 40) + '...' : 'N/A'
            }))
        };
        
        console.log('📊 Photo Summary:', summary);
        res.json(summary);
    } catch (e) {
        console.error('❌ verify-photos ERROR:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// ============================================================
// EMAIL OTP SYSTEM FOR TEACHER SETUP (TEST MODE)
// ============================================================

// In-memory OTP storage (expires after 10 minutes)
const otpStore = {};

// Generate random 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

console.log('ℹ️ Email OTP System initialized in TEST MODE');
console.log('📧 OTP codes will be logged to console - check logs to see codes');

// Send OTP endpoint
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, countryCode, email } = req.body;
        
        if (!email || !phone || !countryCode) {
            return res.status(400).json({ success: false, error: 'Email, phone, and country code required' });
        }

        // Validate email format (simple check)
        if (!email.includes('@') || !email.includes('.')) {
            return res.status(400).json({ success: false, error: 'Invalid email address' });
        }

        // Generate OTP
        const otp = generateOTP();
        const fullPhone = `${countryCode}${phone}`;
        
        // Store OTP with 10-minute expiration
        otpStore[email] = {
            otp,
            phone: fullPhone,
            createdAt: Date.now(),
            expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
            attempts: 0
        };

        // Log OTP to console (for test mode)
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📧 EMAIL OTP GENERATED FOR: ${email}`);
        console.log(`📱 PHONE: ${fullPhone}`);
        console.log(`🔐 OTP CODE: ${otp}`);
        console.log(`⏰ Valid for 10 minutes`);
        console.log(`${'='.repeat(70)}\n`);

        return res.json({ 
            success: true, 
            message: 'OTP generated (check Railway logs for code)',
            email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
            testMode: true
        });

    } catch (e) {
        console.error('❌ /api/send-otp ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Verify OTP endpoint
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        if (!email || !otp) {
            return res.status(400).json({ success: false, error: 'Email and OTP required' });
        }

        const storedData = otpStore[email];

        // Check if OTP exists
        if (!storedData) {
            return res.status(400).json({ success: false, error: 'No OTP sent for this email' });
        }

        // Check if OTP has expired
        if (Date.now() > storedData.expiresAt) {
            delete otpStore[email];
            return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
        }

        // Limit verification attempts
        if (storedData.attempts >= 5) {
            delete otpStore[email];
            return res.status(400).json({ success: false, error: 'Too many attempts. Please request a new OTP.' });
        }

        // Verify OTP
        if (otp !== storedData.otp) {
            storedData.attempts++;
            const remaining = 5 - storedData.attempts;
            return res.status(400).json({ 
                success: false, 
                error: `Invalid OTP. ${remaining} attempts remaining.`
            });
        }

        // OTP verified successfully!
        const verifiedPhone = storedData.phone;
        delete otpStore[email];
        
        console.log(`✅ OTP VERIFIED for ${email} (${verifiedPhone})`);
        
        return res.json({ 
            success: true, 
            message: 'Phone number verified successfully',
            verifiedEmail: email,
            verifiedPhone: verifiedPhone,
            timestamp: new Date().toISOString()
        });

    } catch (e) {
        console.error('❌ /api/verify-otp ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// STUDENTS API ENDPOINTS
// ============================================================

// Initialize students table if not exists
async function initStudentsTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                usn VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(20),
                dob DATE,
                gender VARCHAR(10),
                branch VARCHAR(50),
                semester INTEGER,
                batch_year INTEGER,
                year VARCHAR(10),
                stream VARCHAR(50),
                college VARCHAR(100),
                photo_url TEXT,
                auth JSONB,
                marks JSONB,
                attendance JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Students table ready');
    } catch (err) {
        console.error('❌ Students table initialization error:', err.message);
    }
}

// Initialize settings table for syncing app data
async function initSettingsTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key VARCHAR(100) PRIMARY KEY,
                value JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ App settings table ready');
    } catch (err) {
        console.error('❌ App settings table initialization error:', err.message);
    }
}

initStudentsTable();
initSettingsTable();

// GET all students
app.get('/api/students', async (req, res) => {
    try {
        console.log('📖 GET /api/students');
        
        // Auto-populate missing years BEFORE returning
        // Step 1: Check how many students have missing years
        const checkBefore = await pool.query(`SELECT COUNT(*) as ct FROM students WHERE year IS NULL OR year = ''`);
        console.log(`  - Students missing years BEFORE populate: ${checkBefore.rows[0].ct}`);
        
        // Step 1a: Assign by semester if available
        const updateResult1 = await pool.query(`
            UPDATE students 
            SET year = 
                CASE 
                    WHEN semester = 1 OR semester = 2 THEN '1st Year'
                    WHEN semester = 3 OR semester = 4 THEN '2nd Year'
                    WHEN semester = 5 OR semester = 6 THEN '3rd Year'
                    ELSE NULL
                END
            WHERE (year IS NULL OR year = '') AND semester IS NOT NULL
        `);
        console.log(`  - Updated ${updateResult1.rowCount} students by semester`);
        
        // Step 2: For remaining students with no year, assign by distribution
        const remaining = await pool.query(`SELECT COUNT(*) as ct FROM students WHERE year IS NULL OR year = ''`);
        const remainCount = remaining.rows[0].ct;
        console.log(`  - Students still missing years: ${remainCount}`);
        
        if (remainCount > 0) {
            const ids = await pool.query(`SELECT id FROM students WHERE year IS NULL OR year = '' ORDER BY id`);
            const perGroup = Math.ceil(ids.rows.length / 3);
            
            for (let i = 0; i < ids.rows.length; i++) {
                let yr = '3rd Year';
                if (i < perGroup) yr = '1st Year';
                else if (i < perGroup * 2) yr = '2nd Year';
                
                await pool.query(`UPDATE students SET year = $1 WHERE id = $2`, [yr, ids.rows[i].id]);
            }
            console.log(`  - Distributed ${ids.rows.length} students evenly: ${perGroup} to each year`);
        }
        
        // Check after population
        const checkAfter = await pool.query(`
            SELECT year, COUNT(*) as ct FROM students WHERE year IS NOT NULL AND year != '' GROUP BY year
        `);
        console.log(`  - Year distribution AFTER populate:`, checkAfter.rows);
        
        // Now fetch all students with years populated
        const result = await pool.query('SELECT * FROM students ORDER BY name');
        console.log(`  - Returning ${result.rows.length} students`);
        
        res.json({ success: true, data: result.rows, count: result.rows.length });
    } catch (e) {
        console.error('❌ GET /api/students ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET single student by USN
app.get('/api/students/:usn', async (req, res) => {
    try {
        console.log('📖 GET /api/students/' + req.params.usn);
        const result = await pool.query('SELECT * FROM students WHERE usn = $1', [req.params.usn]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        console.error('❌ GET /api/students/:usn ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST - Add new student
app.post('/api/students', async (req, res) => {
    try {
        console.log('📝 POST /api/students - Body:', req.body);
        
        const { 
            usn, name, email, phone, dob, gender, branch, semester, 
            batch_year, year, stream, college, photo_url, auth, marks, attendance 
        } = req.body;
        
        if (!usn || !name) {
            return res.status(400).json({ success: false, error: 'USN and name are required' });
        }
        
        const query = `
            INSERT INTO students 
            (usn, name, email, phone, dob, gender, branch, semester, batch_year, year, stream, college, photo_url, auth, marks, attendance) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
            RETURNING *
        `;
        
        const values = [
            usn.trim(),
            name.trim(),
            email || null,
            phone || null,
            dob || null,
            gender || null,
            branch || null,
            semester || null,
            batch_year || null,
            year || null,
            stream || null,
            college || null,
            photo_url || null,
            auth || null,
            marks || {},
            attendance || {}
        ];
        
        console.log('🔄 Running INSERT query...');
        const result = await pool.query(query, values);
        const savedStudent = result.rows[0];
        
        console.log('✅ Student saved! USN:', savedStudent.usn);
        res.status(201).json({ 
            success: true, 
            data: savedStudent,
            message: 'Student saved successfully'
        });
        
    } catch (e) {
        console.error('❌ POST /api/students ERROR:', e.message, e.code);
        if (e.code === '23505') {
            return res.status(409).json({ 
                success: false, 
                error: 'USN already exists'
            });
        }
        res.status(500).json({ 
            success: false, 
            error: e.message,
            code: e.code
        });
    }
});

// PUT - Update student
app.put('/api/students/:usn', async (req, res) => {
    try {
        console.log('📝 PUT /api/students/' + req.params.usn);
        const { 
            name, email, phone, dob, gender, branch, semester, 
            batch_year, year, stream, college, photo_url, auth, marks, attendance 
        } = req.body;
        
        const query = `
            UPDATE students 
            SET name=$1, email=$2, phone=$3, dob=$4, gender=$5, branch=$6, semester=$7, batch_year=$8, 
                year=$9, stream=$10, college=$11, photo_url=$12, auth=$13, marks=$14, attendance=$15, updated_at=NOW()
            WHERE usn=$16 
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            name || null, email || null, phone || null, dob || null, gender || null, 
            branch || null, semester || null, batch_year || null, year || null, 
            stream || null, college || null, photo_url || null, auth || null, 
            marks || {}, attendance || {}, req.params.usn
        ]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        
        console.log('✅ Student updated! USN:', req.params.usn);
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        console.error('❌ PUT /api/students ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// DELETE - Remove student
app.delete('/api/students/:usn', async (req, res) => {
    try {
        console.log('🗑️  DELETE /api/students/' + req.params.usn);
        await pool.query('DELETE FROM students WHERE usn=$1', [req.params.usn]);
        res.json({ success: true, message: 'Student deleted' });
    } catch (e) {
        console.error('❌ DELETE /api/students ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// SETTINGS API ENDPOINTS (for syncing app data)
// ============================================================

// GET setting by key
app.get('/api/settings/:key', async (req, res) => {
    try {
        console.log('📖 GET /api/settings/' + req.params.key);
        const result = await pool.query('SELECT value FROM app_settings WHERE key = $1', [req.params.key]);
        
        if (result.rows.length === 0) {
            return res.json({ success: false, data: null });
        }
        
        res.json({ success: true, data: result.rows[0].value });
    } catch (e) {
        console.error('❌ GET /api/settings ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// PUT setting by key (create or update)
app.put('/api/settings/:key', async (req, res) => {
    try {
        console.log('💾 PUT /api/settings/' + req.params.key);
        const { value } = req.body;
        
        const result = await pool.query(
            `INSERT INTO app_settings (key, value) VALUES ($1, $2) 
             ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW() 
             RETURNING *`,
            [req.params.key, typeof value === 'string' ? value : JSON.stringify(value)]
        );
        
        console.log('✅ Setting saved! Key:', req.params.key);
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        console.error('❌ PUT /api/settings ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// MAINTENANCE ENDPOINTS (for fixing data issues)
// ============================================================

// SIMPLE - Populate years and return all students
app.get('/api/students/fix/populate-years', async (req, res) => {
    try {
        console.log('🔧 GET /api/students/fix/populate-years - Populating missing years...');
        
        // Step 1: Assign by semester if available
        await pool.query(`
            UPDATE students 
            SET year = 
                CASE 
                    WHEN semester = 1 OR semester = 2 THEN '1st Year'
                    WHEN semester = 3 OR semester = 4 THEN '2nd Year'
                    WHEN semester = 5 OR semester = 6 THEN '3rd Year'
                    ELSE NULL
                END
            WHERE (year IS NULL OR year = '') AND semester IS NOT NULL
        `);
        
        // Step 2: For remaining students with no year, assign by distribution
        const remaining = await pool.query(`SELECT COUNT(*) as ct FROM students WHERE year IS NULL OR year = ''`);
        const remainCount = remaining.rows[0].ct;
        
        if (remainCount > 0) {
            console.log(`  - ${remainCount} students still need years, assigning evenly...`);
            
            // Get the IDs of students needing years
            const ids = await pool.query(`SELECT id FROM students WHERE year IS NULL OR year = '' ORDER BY id`);
            const perGroup = Math.ceil(ids.rows.length / 3);
            
            for (let i = 0; i < ids.rows.length; i++) {
                let yr = '3rd Year';
                if (i < perGroup) yr = '1st Year';
                else if (i < perGroup * 2) yr = '2nd Year';
                
                await pool.query(`UPDATE students SET year = $1 WHERE id = $2`, [yr, ids.rows[i].id]);
            }
        }
        
        // Get all students with their year info
        const result = await pool.query('SELECT * FROM students ORDER BY name');
        
        // Calculate distribution
        const dist = { '1st Year': 0, '2nd Year': 0, '3rd Year': 0, other: 0 };
        result.rows.forEach(s => {
            if (s.year === '1st Year') dist['1st Year']++;
            else if (s.year === '2nd Year') dist['2nd Year']++;
            else if (s.year === '3rd Year') dist['3rd Year']++;
            else dist.other++;
        });
        
        console.log('✅ Years populated:', dist);
        res.json({ 
            success: true, 
            data: result.rows,
            distribution: dist,
            total: result.rows.length
        });
    } catch (e) {
        console.error('❌ Populate years ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Backward compat endpoint
app.post('/api/maintenance/populate-years', async (req, res) => {
    try {
        // Step 1: Assign by semester
        await pool.query(`
            UPDATE students 
            SET year = 
                CASE 
                    WHEN semester = 1 OR semester = 2 THEN '1st Year'
                    WHEN semester = 3 OR semester = 4 THEN '2nd Year'
                    WHEN semester = 5 OR semester = 6 THEN '3rd Year'
                    ELSE NULL
                END
            WHERE (year IS NULL OR year = '') AND semester IS NOT NULL
        `);
        
        // Step 2: Assign remaining by distribution
        const remaining = await pool.query(`SELECT COUNT(*) as ct FROM students WHERE year IS NULL OR year = ''`);
        const ct = remaining.rows[0].ct;
        
        if (ct > 0) {
            const ids = await pool.query(`SELECT id FROM students WHERE year IS NULL OR year = '' ORDER BY id`);
            const perG = Math.ceil(ids.rows.length / 3);
            
            for (let i = 0; i < ids.rows.length; i++) {
                const yr = i < perG ? '1st Year' : (i < perG * 2 ? '2nd Year' : '3rd Year');
                await pool.query(`UPDATE students SET year = $1 WHERE id = $2`, [yr, ids.rows[i].id]);
            }
        }
        
        const result = await pool.query(`
            SELECT year, COUNT(*) as count FROM students WHERE year IS NOT NULL AND year != '' GROUP BY year
        `);
        
        const dist = {};
        result.rows.forEach(row => { dist[row.year] = row.count; });
        
        res.json({ 
            success: true, 
            distribution: dist,
            updated: true
        });
    } catch (e) {
        console.error('❌ POST populate-years ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get year distribution statistics
app.get('/api/students/stats/year-distribution', async (req, res) => {
    try {
        console.log('📊 GET /api/students/stats/year-distribution');
        
        const result = await pool.query(`
            SELECT 
                year, 
                COUNT(*) as count,
                branch
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
        
        const totalByYear = await pool.query(`
            SELECT year, COUNT(*) as count FROM students 
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
        
        const total = totalByYear.rows.reduce((sum, row) => sum + row.count, 0);
        const missingYears = await pool.query(`SELECT COUNT(*) as count FROM students WHERE year IS NULL OR year = ''`);
        
        res.json({ 
            success: true, 
            byBranch: result.rows,
            byYear: totalByYear.rows,
            total: total,
            missingYears: missingYears.rows[0].count,
            allStudentsCount: await pool.query(`SELECT COUNT(*) as count FROM students`).then(r => r.rows[0].count)
        });
    } catch (e) {
        console.error('❌ GET year-distribution ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Debug endpoint - show first few students
app.get('/api/debug/students-sample', async (req, res) => {
    try {
        console.log('🔍 GET /api/debug/students-sample');
        
        const result = await pool.query(`
            SELECT id, usn, name, year, semester, batch_year, branch 
            FROM students 
            LIMIT 10
        `);
        
        const yearCounts = await pool.query(`
            SELECT year, COUNT(*) as count FROM students 
            GROUP BY year
        `);
        
        // Check if there are any NULL years
        const nullCount = await pool.query(`SELECT COUNT(*) as ct FROM students WHERE year IS NULL OR year = ''`);
        
        res.json({ 
            success: true,
            sample: result.rows,
            yearCounts: yearCounts.rows,
            nullYearsCount: nullCount.rows[0].ct,
            totalStudents: (await pool.query('SELECT COUNT(*) as ct FROM students')).rows[0].ct
        });
    } catch (e) {
        console.error('❌ GET debug/students-sample ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Force populate years endpoint - for emergencies
app.get('/api/debug/force-populate', async (req, res) => {
    try {
        console.log('🔴 FORCE POPULATE - Running year assignment...');
        
        // Get all students with semester
        const students = await pool.query(`SELECT id, semester FROM students WHERE semester IS NOT NULL ORDER BY id`);
        console.log(`  Found ${students.rows.length} students with semester values`);
        
        let count1st = 0, count2nd = 0, count3rd = 0;
        
        // Assign years based on semester
        for (const student of students.rows) {
            let yr = '3rd Year';
            if (student.semester <= 2) {
                yr = '1st Year';
                count1st++;
            } else if (student.semester <= 4) {
                yr = '2nd Year';
                count2nd++;
            } else {
                yr = '3rd Year';
                count3rd++;
            }
            
            await pool.query(`UPDATE students SET year = $1 WHERE id = $2`, [yr, student.id]);
        }
        
        console.log(`  ✓ Assigned: 1st=${count1st}, 2nd=${count2nd}, 3rd=${count3rd}`);
        
        // Verify
        const verify = await pool.query(`
            SELECT year, COUNT(*) as ct FROM students GROUP BY year
        `);
        
        res.json({ 
            success: true,
            assigned: { '1st Year': count1st, '2nd Year': count2nd, '3rd Year': count3rd },
            verified: verify.rows 
        });
    } catch (e) {
        console.error('❌ FORCE POPULATE ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message, stack: e.stack });
    }
});

// ============================================================
// STATIC FILES & SPA FALLBACK (AFTER ALL API ROUTES!)
// ============================================================

app.use(express.static(__dirname, { maxAge: '1h' }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// SPA fallback - for any non-API routes
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
    console.error('❌ UNHANDLED ERROR:', err.message);
    res.status(500).json({ success: false, error: err.message });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 API: https://jss-railway-fresh-production.up.railway.app/api`);
});
