// ============================================================
// Student Management System  Railway PostgreSQL API Server
// Matches actual DB schema (students, teachers, fees,
// attendance, internal_assessments, timetables, user_profiles)
// ============================================================
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('\n🔧 [STARTUP] Initializing Express app...');
console.log(`🔧 [STARTUP] PORT = ${PORT}`);
console.log(`🔧 [STARTUP] NODE_ENV = ${process.env.NODE_ENV || 'not set'}`);

// ⚠️ CRITICAL: Catch ALL requests at the very beginning
app.use((req, res, next) => {
    console.log(`📨 [${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ⚠️ IMPORTANT: Log all API requests BEFORE static middleware
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        console.log(`📍 [API] ${req.method} ${req.path} - routing to API handler`);
    }
    next();
});

//  Database Pool - MUST BE BEFORE API ROUTES
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

let dbReady = true;

// Test connection and ensure tables
pool.query('SELECT NOW()', (err) => {
    if (err) { 
        console.error('❌ DB connection failed:', err.message); 
        dbReady = false;
    } else { 
        console.log('✅ Connected to Railway PostgreSQL');
        ensureTeachersTable();
    }
});

// ══════════════════════════════════════════════════════════════
//  ALL API ROUTES - BEFORE STATIC FILES
// ══════════════════════════════════════════════════════════════

// Ensure teachers table has all required columns
function ensureTeachersTable() {
    // First CREATE the table with all columns if it doesn't exist
    const createSQL = `
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
    `;
    
    pool.query(createSQL, (err) => {
        if (err) {
            console.error('❌ Error creating teachers table:', err.message);
        } else {
            console.log('✅ Teachers table ensured to exist');
        }
    });
    
    // Then add any missing columns as fallback (in case table exists with old schema)
    const queries = [
        `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;`,
        `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS photo_url TEXT;`,
    ];
    
    queries.forEach(query => {
        pool.query(query, (err) => {
            if (err && !err.message.includes('already exists')) {
                console.log('🔧 Column add result:', err.message);
            }
        });
    });
    
    dbReady = true;
    console.log('✅ Teachers table initialization complete');
}

// ══════════════════════════════════════════════════════════════
// API ENDPOINTS
// ══════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Database diagnostic endpoint
app.get('/api/db-check', (req, res) => {
    pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name='teachers'
        ORDER BY ordinal_position;
    `, (err, result) => {
        if (err) {
            return res.json({ success: false, error: err.message });
        }
        const columns = result.rows.map(r => ({
            name: r.column_name,
            type: r.data_type,
            nullable: r.is_nullable
        }));
        const hasEmployeeId = columns.some(c => c.name === 'employee_id');
        const hasPhotoUrl = columns.some(c => c.name === 'photo_url');
        res.json({ 
            success: true, 
            database_ready: hasEmployeeId && hasPhotoUrl,
            columns: columns,
            message: hasEmployeeId && hasPhotoUrl ? '✅ Database ready for teachers' : '⏳ Waiting for migrations to complete'
        });
    });
});

// QUICK TEST ENDPOINT
console.log('🔧 [STARTUP] Registering POST /api/teachers-test...');
app.post('/api/teachers-test', (req, res) => {
    console.log('✅ TEST endpoint hit! Body:', req.body);
    res.json({ success: true, message: 'Test endpoint works', body: req.body });
});
console.log('✅ [STARTUP] POST /api/teachers-test registered');

// 
// STUDENTS  table: students
//   id, usn, name, email, phone, dob, gender, branch,
//   semester, batch_year, photo_url, auth(jsonb),
//   marks(jsonb), attendance(jsonb)
// 

app.get('/api/students', async (req, res) => {
    try {
        const { branch, semester, batch_year, stream, college, year } = req.query;
        let q = 'SELECT * FROM students WHERE 1=1';
        const p = [];
        if (branch)     { p.push(branch);     q += ` AND branch = $${p.length}`; }
        if (semester)   { p.push(semester);   q += ` AND semester = $${p.length}`; }
        if (batch_year) { p.push(batch_year); q += ` AND batch_year = $${p.length}`; }
        if (year)       { p.push(year);       q += ` AND year = $${p.length}`; }
        if (stream)     { p.push(stream);     q += ` AND stream = $${p.length}`; }
        if (college)    { p.push(college);    q += ` AND college = $${p.length}`; }
        q += ' ORDER BY name ASC';
        const r = await pool.query(q, p);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/students/:usn', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM students WHERE usn = $1', [req.params.usn]);
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/students', async (req, res) => {
    try {
        const { usn, name, email, phone, dob, gender, branch, semester,
                batch_year, year, stream, college, photo_url, auth, marks, attendance } = req.body;
        const r = await pool.query(
            `INSERT INTO students (usn, name, email, phone, dob, gender, branch,
             semester, batch_year, year, stream, college, photo_url, auth, marks, attendance)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
            [usn, name, email||null, phone||null, dob||null, gender||null,
             branch||null, semester||null, batch_year||null, year||null,
             stream||null, college||null, photo_url||null,
             JSON.stringify(auth||{}), JSON.stringify(marks||{}),
             JSON.stringify(attendance||{})]
        );
        res.json({ success: true, data: r.rows[0] });
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ success: false, error: 'USN already exists' });
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/api/students/:usn', async (req, res) => {
    try {
        const allowed = ['name','email','phone','dob','gender','branch',
                         'semester','batch_year','year','stream','college','photo_url','auth','marks','attendance'];
        const body = req.body;
        const jsonFields = ['auth','marks','attendance'];
        jsonFields.forEach(f => { if (body[f] !== undefined) body[f] = JSON.stringify(body[f]); });
        const keys = Object.keys(body).filter(k => allowed.includes(k));
        if (!keys.length) return res.status(400).json({ success: false, error: 'No valid fields' });
        const setClause = keys.map((k, i) => `${k} = $${i+1}`).join(', ');
        const vals = [...keys.map(k => body[k]), req.params.usn];
        const r = await pool.query(
            `UPDATE students SET ${setClause}, updated_at = NOW() WHERE usn = $${vals.length} RETURNING *`, vals
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// IMPORTANT: /all and /bulk-delete must be registered BEFORE /:usn (otherwise Express matches 'all' as a USN)
app.delete('/api/students/all', async (req, res) => {
    try {
        const { branch } = req.query;
        if (branch) {
            await pool.query('DELETE FROM students WHERE branch = $1', [branch]);
        } else {
            await pool.query('DELETE FROM students');
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/students/bulk-delete', async (req, res) => {
    const { usns } = req.body;
    if (!Array.isArray(usns) || !usns.length) return res.status(400).json({ success: false, error: 'Expected usns array' });
    try {
        await pool.query('DELETE FROM students WHERE usn = ANY($1::text[])', [usns]);
        res.json({ success: true, deleted: usns.length });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Single delete — MUST come after /all and /bulk-delete
app.delete('/api/students/:usn', async (req, res) => {
    try {
        await pool.query('DELETE FROM students WHERE usn = $1', [req.params.usn]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Bulk save (upsert)
app.post('/api/students/bulk', async (req, res) => {
    const { students } = req.body;
    if (!Array.isArray(students)) return res.status(400).json({ success: false, error: 'Expected array' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let saved = 0;
        for (const s of students) {
            const { usn, name, email, phone, dob, gender, branch, semester,
                    batch_year, year, stream, college, photo_url, auth, marks, attendance } = s;
            await client.query(
                `INSERT INTO students (usn, name, email, phone, dob, gender, branch,
                 semester, batch_year, year, stream, college, photo_url, auth, marks, attendance)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                 ON CONFLICT (usn) DO UPDATE SET
                   name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone,
                   dob=EXCLUDED.dob, gender=EXCLUDED.gender, branch=EXCLUDED.branch,
                   semester=EXCLUDED.semester, batch_year=EXCLUDED.batch_year,
                   year=EXCLUDED.year, stream=EXCLUDED.stream, college=EXCLUDED.college,
                   photo_url=EXCLUDED.photo_url, auth=EXCLUDED.auth,
                   marks=EXCLUDED.marks, attendance=EXCLUDED.attendance,
                   updated_at=NOW()`,
                [usn, name, email||null, phone||null, dob||null, gender||null,
                 branch||null, semester||null, batch_year||null, year||null,
                 stream||null, college||null, photo_url||null,
                 JSON.stringify(auth||{}), JSON.stringify(marks||{}),
                 JSON.stringify(attendance||{})]
            );
            saved++;
        }
        await client.query('COMMIT');
        res.json({ success: true, saved });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: e.message });
    } finally { client.release(); }
});

// 
// TEACHERS  table: teachers
//   id, name, email, phone, subject, department, employee_id, photo_url
// 

console.log('🔧 [STARTUP] Registering GET /api/teachers...');
app.get('/api/teachers', async (req, res) => {
    try {
        const { department } = req.query;
        let q = 'SELECT * FROM teachers WHERE 1=1';
        const p = [];
        if (department) { p.push(department); q += ` AND department = $${p.length}`; }
        q += ' ORDER BY name ASC';
        const r = await pool.query(q, p);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
console.log('✅ [STARTUP] GET /api/teachers registered');

app.post('/api/teachers', async (req, res) => {
    console.log('\n✅ [TEACHERS POST] Request received');
    console.log('   Full URL:', req.originalUrl);
    console.log('   Method:', req.method);
    console.log('   Body keys:', Object.keys(req.body).join(', '));
    
    try {
        const { name, email, phone, subject, department, employee_id, photo_url } = req.body;
        
        console.log('   Extracted: name=[' + name + '], employee_id=[' + employee_id + ']');
        
        // Validate
        if (!name || !employee_id) {
            console.log('   ❌ VALIDATION FAILED');
            return res.status(400).json({ success: false, error: 'Name and employee_id required' });
        }
        
        console.log('   ✓ Validation passed, inserting to DB...');
        
        const result = await pool.query(
            `INSERT INTO teachers (name, email, phone, subject, department, employee_id, photo_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [name, email||null, phone||null, subject||null, department||null, employee_id, photo_url||null]
        );
        
        console.log('   ✅ INSERT SUCCESS, ID:', result.rows[0].id);
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('   ❌ ERROR:', error.message, error.code);
        if (error.code === '23505') {
            return res.status(409).json({ success: false, error: 'Employee ID already exists' });
        }
        return res.status(500).json({ success: false, error: error.message });
    }
});
console.log('✅ [STARTUP] POST /api/teachers registered');

app.put('/api/teachers/:id', async (req, res) => {
    try {
        const allowed = ['name','email','phone','subject','department','employee_id','photo_url'];
        const keys = Object.keys(req.body).filter(k => allowed.includes(k));
        if (!keys.length) return res.status(400).json({ success: false, error: 'No valid fields' });
        const setClause = keys.map((k, i) => `${k} = $${i+1}`).join(', ');
        const vals = [...keys.map(k => req.body[k]), req.params.id];
        const r = await pool.query(
            `UPDATE teachers SET ${setClause}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/teachers/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM teachers WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 
// FEES  table: fees
//   id, student_id, amount, due_date, paid_date, status,
//   payment_method, semester
// 

app.get('/api/fees', async (req, res) => {
    try {
        const { student_id, semester, status } = req.query;
        let q = `SELECT f.*, s.usn, s.name as student_name
                 FROM fees f LEFT JOIN students s ON s.id = f.student_id WHERE 1=1`;
        const p = [];
        if (student_id) { p.push(student_id); q += ` AND f.student_id = $${p.length}`; }
        if (semester)   { p.push(semester);   q += ` AND f.semester = $${p.length}`; }
        if (status)     { p.push(status);     q += ` AND f.status = $${p.length}`; }
        q += ' ORDER BY f.due_date DESC';
        const r = await pool.query(q, p);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/fees', async (req, res) => {
    try {
        const { student_id, amount, due_date, paid_date, status, payment_method, semester } = req.body;
        const r = await pool.query(
            `INSERT INTO fees (student_id, amount, due_date, paid_date, status, payment_method, semester)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [student_id, amount, due_date||null, paid_date||null, status||'pending', payment_method||null, semester||null]
        );
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/api/fees/:id', async (req, res) => {
    try {
        const allowed = ['amount','due_date','paid_date','status','payment_method','semester'];
        const keys = Object.keys(req.body).filter(k => allowed.includes(k));
        if (!keys.length) return res.status(400).json({ success: false, error: 'No valid fields' });
        const setClause = keys.map((k, i) => `${k} = $${i+1}`).join(', ');
        const vals = [...keys.map(k => req.body[k]), req.params.id];
        const r = await pool.query(
            `UPDATE fees SET ${setClause}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 
// ATTENDANCE  table: attendance
//   id, student_id, date, status, subject
// 

app.get('/api/attendance', async (req, res) => {
    try {
        const { student_id, subject, date } = req.query;
        let q = `SELECT a.*, s.usn, s.name as student_name
                 FROM attendance a LEFT JOIN students s ON s.id = a.student_id WHERE 1=1`;
        const p = [];
        if (student_id) { p.push(student_id); q += ` AND a.student_id = $${p.length}`; }
        if (subject)    { p.push(subject);    q += ` AND a.subject = $${p.length}`; }
        if (date)       { p.push(date);       q += ` AND a.date = $${p.length}`; }
        q += ' ORDER BY a.date DESC';
        const r = await pool.query(q, p);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/attendance', async (req, res) => {
    try {
        const { student_id, date, status, subject } = req.body;
        const r = await pool.query(
            `INSERT INTO attendance (student_id, date, status, subject)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [student_id, date, status||'present', subject||null]
        );
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 
// INTERNAL ASSESSMENTS  table: internal_assessments
//   id, student_id, subject, marks, max_marks, semester, academic_year
// 

app.get('/api/ia', async (req, res) => {
    try {
        const { student_id, semester, subject } = req.query;
        let q = `SELECT ia.*, s.usn, s.name as student_name
                 FROM internal_assessments ia LEFT JOIN students s ON s.id = ia.student_id WHERE 1=1`;
        const p = [];
        if (student_id) { p.push(student_id); q += ` AND ia.student_id = $${p.length}`; }
        if (semester)   { p.push(semester);   q += ` AND ia.semester = $${p.length}`; }
        if (subject)    { p.push(subject);    q += ` AND ia.subject = $${p.length}`; }
        q += ' ORDER BY ia.created_at DESC';
        const r = await pool.query(q, p);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/ia', async (req, res) => {
    try {
        const { student_id, subject, marks, max_marks, semester, academic_year } = req.body;
        const r = await pool.query(
            `INSERT INTO internal_assessments (student_id, subject, marks, max_marks, semester, academic_year)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [student_id, subject, marks, max_marks||100, semester||null, academic_year||null]
        );
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/api/ia/:id', async (req, res) => {
    try {
        const allowed = ['subject','marks','max_marks','semester','academic_year'];
        const keys = Object.keys(req.body).filter(k => allowed.includes(k));
        if (!keys.length) return res.status(400).json({ success: false, error: 'No valid fields' });
        const setClause = keys.map((k, i) => `${k} = $${i+1}`).join(', ');
        const vals = [...keys.map(k => req.body[k]), req.params.id];
        const r = await pool.query(
            `UPDATE internal_assessments SET ${setClause}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 
// TIMETABLES  table: timetables
//   id, branch, semester, subject, teacher_id, day_of_week,
//   start_time, end_time, classroom
// 

app.get('/api/timetables', async (req, res) => {
    try {
        const { branch, semester } = req.query;
        let q = `SELECT t.*, te.name as teacher_name FROM timetables t
                 LEFT JOIN teachers te ON te.id = t.teacher_id WHERE 1=1`;
        const p = [];
        if (branch)   { p.push(branch);   q += ` AND t.branch = $${p.length}`; }
        if (semester) { p.push(semester); q += ` AND t.semester = $${p.length}`; }
        q += ' ORDER BY t.day_of_week, t.start_time';
        const r = await pool.query(q, p);
        res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/timetables', async (req, res) => {
    try {
        const { branch, semester, subject, teacher_id, day_of_week, start_time, end_time, classroom } = req.body;
        const r = await pool.query(
            `INSERT INTO timetables (branch, semester, subject, teacher_id, day_of_week, start_time, end_time, classroom)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [branch, semester||null, subject, teacher_id||null, day_of_week||null, start_time||null, end_time||null, classroom||null]
        );
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/timetables/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM timetables WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 
// NOTIFICATIONS  stored in app_settings as JSONB list
//   (no dedicated table in DB, uses a flexible key/value store)
// 

async function ensureSettingsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
            key VARCHAR(100) PRIMARY KEY,
            value JSONB,
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);
    
    // Ensure teacher attendance and leave keys exist
    const keysToInit = [
        { key: 'teacher_attendance', value: { records: [] } },
        { key: 'teacher_leave', value: { records: [] } }
    ];
    
    for (const item of keysToInit) {
        try {
            await pool.query(
                `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
                 ON CONFLICT (key) DO NOTHING`,
                [item.key, item.value]
            );
        } catch (e) {
            console.log(`Info: Key ${item.key} already exists or DB not ready`);
        }
    }
}
ensureSettingsTable().catch(() => {});

app.get('/api/notifications', async (req, res) => {
    try {
        const r = await pool.query(`SELECT value FROM app_settings WHERE key = 'notifications'`);
        const data = r.rows.length ? r.rows[0].value : [];
        res.json({ success: true, data: Array.isArray(data) ? data : [] });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/notifications', async (req, res) => {
    try {
        const r = await pool.query(`SELECT value FROM app_settings WHERE key = 'notifications'`);
        const existing = (r.rows.length && Array.isArray(r.rows[0].value)) ? r.rows[0].value : [];
        const newNotif = { id: Date.now(), ...req.body, created_at: new Date().toISOString() };
        const updated = [newNotif, ...existing].slice(0, 200);
        await pool.query(
            `INSERT INTO app_settings (key, value, updated_at) VALUES ('notifications', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [JSON.stringify(updated)]
        );
        res.json({ success: true, data: newNotif });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/notifications/:id', async (req, res) => {
    try {
        const r = await pool.query(`SELECT value FROM app_settings WHERE key = 'notifications'`);
        const existing = (r.rows.length && Array.isArray(r.rows[0].value)) ? r.rows[0].value : [];
        const updated = existing.filter(n => String(n.id) !== String(req.params.id));
        await pool.query(
            `INSERT INTO app_settings (key, value, updated_at) VALUES ('notifications', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [JSON.stringify(updated)]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 
// APP SETTINGS  generic key/value store
// 

app.get('/api/settings/:key', async (req, res) => {
    try {
        const r = await pool.query(`SELECT value FROM app_settings WHERE key = $1`, [req.params.key]);
        res.json({ success: true, data: r.rows.length ? r.rows[0].value : null });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/api/settings/:key', async (req, res) => {
    try {
        await pool.query(
            `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [req.params.key, req.body.value]
        );
        res.json({ success: true, data: req.body.value });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 
// STUDENT DOCUMENTS  table: student_documents
//   id (serial), usn, file_name, file_type, file_size, file_data (text/base64), uploaded_at
// 

// Auto-create table on first request (and migrate if usn column is missing)
async function ensureDocumentsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS student_documents (
            id           SERIAL PRIMARY KEY,
            usn          TEXT NOT NULL,
            file_name    TEXT NOT NULL,
            file_type    TEXT,
            file_size    BIGINT,
            file_data    TEXT NOT NULL,
            uploaded_at  TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    // Migration: add usn column if the table existed without it
    await pool.query(`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='student_documents' AND column_name='usn'
            ) THEN
                ALTER TABLE student_documents ADD COLUMN usn TEXT NOT NULL DEFAULT '';
            END IF;
        END $$;
    `);
}

// GET  /api/documents?usn=xxx  → list (no file_data)
app.get('/api/documents', async (req, res) => {
    try {
        await ensureDocumentsTable();
        const { usn } = req.query;
        if (!usn) return res.status(400).json({ error: 'usn required' });
        const r = await pool.query(
            'SELECT id, usn, file_name, file_type, file_size, uploaded_at FROM student_documents WHERE usn=$1 ORDER BY uploaded_at DESC',
            [usn]
        );
        res.json({ documents: r.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET  /api/documents/:id/data  → returns full record including base64 file_data
app.get('/api/documents/:id/data', async (req, res) => {
    try {
        await ensureDocumentsTable();
        const r = await pool.query('SELECT * FROM student_documents WHERE id=$1', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/documents  → upload (body: {usn, file_name, file_type, file_size, file_data})
app.post('/api/documents', async (req, res) => {
    try {
        await ensureDocumentsTable();
        const { usn, file_name, file_type, file_size, file_data } = req.body;
        if (!usn || !file_name || !file_data) return res.status(400).json({ error: 'usn, file_name, file_data required' });
        const r = await pool.query(
            'INSERT INTO student_documents (usn, file_name, file_type, file_size, file_data) VALUES ($1,$2,$3,$4,$5) RETURNING id, usn, file_name, file_type, file_size, uploaded_at',
            [usn, file_name, file_type || '', file_size || 0, file_data]
        );
        res.json({ success: true, document: r.rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/documents/:id
app.delete('/api/documents/:id', async (req, res) => {
    try {
        await ensureDocumentsTable();
        await pool.query('DELETE FROM student_documents WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════
// QR ATTENDANCE  tables: qr_sessions + qr_checkins
// ════════════════════════════════════════════════════════

async function ensureQRTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS qr_sessions (
            id           TEXT PRIMARY KEY,
            title        TEXT NOT NULL,
            branch       TEXT NOT NULL,
            year         TEXT,
            created_at   TIMESTAMPTZ DEFAULT NOW(),
            expires_at   TIMESTAMPTZ NOT NULL,
            geofence     JSONB,
            created_by   TEXT
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS qr_checkins (
            id           SERIAL PRIMARY KEY,
            session_id   TEXT NOT NULL REFERENCES qr_sessions(id) ON DELETE CASCADE,
            usn          TEXT NOT NULL,
            checked_in_at TIMESTAMPTZ DEFAULT NOW(),
            lat          DOUBLE PRECISION,
            lon          DOUBLE PRECISION,
            UNIQUE(session_id, usn)
        )
    `);
}

// POST /api/qr-sessions  – create a new session
app.post('/api/qr-sessions', async (req, res) => {
    try {
        await ensureQRTables();
        const { id, title, branch, year, expires_at, geofence, created_by } = req.body;
        if (!id || !title || !branch || !expires_at) {
            return res.status(400).json({ error: 'id, title, branch, expires_at required' });
        }
        const r = await pool.query(
            `INSERT INTO qr_sessions (id, title, branch, year, expires_at, geofence, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [id, title, branch, year || null,
             new Date(expires_at).toISOString(),
             geofence ? JSON.stringify(geofence) : null,
             created_by || null]
        );
        res.json({ success: true, session: r.rows[0] });
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'Session ID already exists' });
        res.status(500).json({ error: e.message });
    }
});

// GET /api/qr-sessions?branch=xxx  – list sessions
app.get('/api/qr-sessions', async (req, res) => {
    try {
        await ensureQRTables();
        const { branch } = req.query;
        if (!branch) return res.status(400).json({ error: 'branch required' });
        const r = await pool.query(
            `SELECT s.*, COUNT(c.id)::int AS checkin_count
             FROM qr_sessions s
             LEFT JOIN qr_checkins c ON c.session_id = s.id
             WHERE s.branch = $1
             GROUP BY s.id
             ORDER BY s.created_at DESC
             LIMIT 50`,
            [branch]
        );
        res.json({ success: true, sessions: r.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/qr-sessions/:id  – fetch single session info (for student check-in page)
app.get('/api/qr-sessions/:id', async (req, res) => {
    try {
        await ensureQRTables();
        const r = await pool.query('SELECT * FROM qr_sessions WHERE id=$1', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Session not found' });
        const s = r.rows[0];
        const expired = new Date(s.expires_at).getTime() < Date.now();
        res.json({ success: true, session: { ...s, expired } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/qr-sessions/:id
app.delete('/api/qr-sessions/:id', async (req, res) => {
    try {
        await ensureQRTables();
        await pool.query('DELETE FROM qr_sessions WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/qr-checkins  – student checks in
app.post('/api/qr-checkins', async (req, res) => {
    try {
        await ensureQRTables();
        const { session_id, usn, lat, lon } = req.body;
        // Accept either 'usn' or 'name' field from client
        const attendee = (usn || req.body.name || '').trim();
        if (!session_id || !attendee) return res.status(400).json({ error: 'session_id and name required' });

        // Validate session exists + not expired
        const sr = await pool.query('SELECT * FROM qr_sessions WHERE id=$1', [session_id]);
        if (!sr.rows.length) return res.status(404).json({ error: 'Session not found' });
        const session = sr.rows[0];
        if (new Date() > new Date(session.expires_at)) {
            return res.status(410).json({ error: 'Session has expired' });
        }

        // Geofence check (server-side)
        if (session.geofence && lat != null && lon != null) {
            const gf = session.geofence;
            const R = 6371000;
            const toRad = d => d * Math.PI / 180;
            const dLat = toRad(lat - gf.lat);
            const dLon = toRad(lon - gf.lon);
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(gf.lat))*Math.cos(toRad(lat))*Math.sin(dLon/2)**2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            if (dist > gf.radius) {
                return res.status(403).json({ error: `Outside geofence (${Math.round(dist)}m away, limit ${gf.radius}m)` });
            }
        }

        // No USN validation — accept any name the student enters
        // Try to look up a matching student name for display purposes (optional)
        let displayName = attendee;
        try {
            const sLookup = await pool.query(
                `SELECT name FROM students WHERE LOWER(usn)=LOWER($1) OR LOWER(name)=LOWER($1) LIMIT 1`,
                [attendee]
            );
            if (sLookup.rows.length) displayName = sLookup.rows[0].name;
        } catch (_) {}

        // Insert (UNIQUE constraint on session_id+usn handles duplicates)
        try {
            const r = await pool.query(
                `INSERT INTO qr_checkins (session_id, usn, lat, lon)
                 VALUES ($1,$2,$3,$4) RETURNING *`,
                [session_id, attendee, lat || null, lon || null]
            );
            res.json({ success: true, checkin: r.rows[0], student_name: displayName });
        } catch (dupErr) {
            if (dupErr.code === '23505') {
                return res.status(409).json({ error: 'You have already checked in for this session' });
            }
            throw dupErr;
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/qr-checkins/:sessionId  – all check-ins for a session
app.get('/api/qr-checkins/:sessionId', async (req, res) => {
    try {
        await ensureQRTables();
        const r = await pool.query(
            `SELECT c.*, s.name AS student_name
             FROM qr_checkins c
             LEFT JOIN students s ON s.usn = c.usn
             WHERE c.session_id = $1
             ORDER BY c.checked_in_at ASC`,
            [req.params.sessionId]
        );
        res.json({ success: true, checkins: r.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/server-ip  – returns this machine's LAN IPs so QR codes work on mobile
app.get('/api/server-ip', (req, res) => {
    const nets = os.networkInterfaces();
    const allIPs = [];
    const virtualNamePatterns = /virtualbox|vmware|hyper-v|vethernet|loopback|pseudo|bluetooth|vbox|vpn|tailscale|vmnet/i;
    // Known virtual/host-only IP ranges
    const virtualIPPrefixes = ['192.168.56.', '192.168.92.', '192.168.241.'];
    const wifiPatterns = /wi-fi|wifi|wireless|wlan/i;

    for (const [name, addrs] of Object.entries(nets)) {
        for (const net of addrs) {
            if (net.family === 'IPv4' && !net.internal) {
                const isVirtualName = virtualNamePatterns.test(name);
                const isVirtualIP = virtualIPPrefixes.some(p => net.address.startsWith(p));
                const isWifi = wifiPatterns.test(name);
                // Score: Wi-Fi=0, Ethernet=1, VirtualBox/VMware=2
                const score = (isVirtualName || isVirtualIP) ? 2 : (isWifi ? 0 : 1);
                allIPs.push({
                    ip: net.address,
                    name,
                    port: PORT,
                    virtual: (isVirtualName || isVirtualIP),
                    score
                });
            }
        }
    }
    // Sort: best candidates first
    allIPs.sort((a, b) => a.score - b.score);
    res.json({ ips: allIPs, port: PORT, primary: allIPs[0] || null });
});

// ════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════

app.get('/api/health', async (req, res) => {
    try {
        const r = await pool.query('SELECT NOW() as time, current_database() as db');
        res.json({ success: true, db: r.rows[0].db, time: r.rows[0].time, status: 'ok' });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// STATIC FILES - AFTER ALL API ROUTES
// ══════════════════════════════════════════════════════════════

// Serve all static files (images, css, js, etc.)
app.use(express.static(path.join(__dirname), { 
    maxAge: '1h',
    etag: false 
}));

// Explicitly serve index.html for root
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    res.sendFile(indexPath);
});

// Fallback: serve index.html for any unknown routes (SPA support)
// [MUST BE LAST - after all API routes]
app.use((req, res) => {
    // Don't serve HTML for API requests or actual files
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    
    const indexPath = path.join(__dirname, 'index.html');
    console.log(`[SPA] Fallback routing to index.html for path: ${req.path}`);
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('[ERROR] Failed to serve index.html:', err.code);
            res.status(500).send('Server error');
        }
    });
});

// Global error handler - ensure JSON errors
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err.message);
    res.status(err.status || 500).json({ 
        success: false, 
        error: err.message || 'Internal server error'
    });
});

//  Start Server
app.listen(PORT, () => {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 RAILWAY SERVER STARTED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log('✅ API routes registered:');
    console.log('   - GET  /api/health');
    console.log('   - GET  /api/db-check');
    console.log('   - POST /api/teachers-test');
    console.log('   - GET  /api/teachers');
    console.log('   - POST /api/teachers');
    console.log('═══════════════════════════════════════════════════════\n');
});