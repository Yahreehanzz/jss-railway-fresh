// ============================================================
// Simple Student Management System Server
// Serves index.html for all routes (SPA)
// ============================================================

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname), { maxAge: '1h' }));

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Test DB connection
pool.query('SELECT NOW()', (err) => {
    if (err) { 
        console.error('❌ DB connection failed:', err.message); 
    } else { 
        console.log('✅ Connected to Railway PostgreSQL'); 
    }
});

// Initialize teachers table if not exists
pool.query(`
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
`).then(() => console.log('✅ Teachers table ready')).catch(e => console.error('⚠️ Teachers table error:', e.message));

// Initialize faculty user credentials table if not exists
pool.query(`
    CREATE TABLE IF NOT EXISTS faculty_user_credentials (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        gmail VARCHAR(100),
        is_setup_complete BOOLEAN DEFAULT FALSE,
        otp_code VARCHAR(6),
        otp_sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(teacher_id, username)
    )
`).then(() => console.log('✅ Faculty User Credentials table ready')).catch(e => console.error('⚠️ Faculty credentials table error:', e.message));

// ============================================================
// API Routes
// ============================================================

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const r = await pool.query('SELECT NOW() as time, current_database() as db');
        res.json({ 
            success: true, 
            db: r.rows[0].db, 
            time: r.rows[0].time, 
            status: 'ok' 
        });
    } catch (e) { 
        res.status(500).json({ success: false, error: e.message }); 
    }
});

// Get all students
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
    } catch (e) { 
        res.status(500).json({ success: false, error: e.message }); 
    }
});

// Get single student
app.get('/api/students/:usn', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM students WHERE usn = $1', [req.params.usn]);
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { 
        res.status(500).json({ success: false, error: e.message }); 
    }
});

// ============================================================
// TEACHERS API ENDPOINTS
// ============================================================

// Get all teachers
app.get('/api/teachers', async (req, res) => {
    try {
        console.log('📖 GET /api/teachers');
        const result = await pool.query('SELECT * FROM teachers ORDER BY name');
        res.json({ success: true, data: result.rows, count: result.rows.length });
    } catch (e) {
        console.error('❌ GET /api/teachers ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST - Add new teacher
app.post('/api/teachers', async (req, res) => {
    try {
        console.log('📝 POST /api/teachers - Body:', req.body);
        
        const { name, email, phone, subject, department, employee_id, designation, gender, date_of_joining, qualification, experience } = req.body;
        
        if (!name || !employee_id) {
            return res.status(400).json({ success: false, error: 'Name and employee_id are required' });
        }
        
        const query = `
            INSERT INTO teachers 
            (name, email, phone, subject, department, employee_id, designation, gender, date_of_joining, qualification, experience, photo_url) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING *
        `;
        
        const values = [
            name.trim(),
            email || null,
            phone || null,
            subject || null,
            department || null,
            employee_id.trim(),
            designation || null,
            gender || null,
            date_of_joining || null,
            qualification || null,
            experience || null,
            null
        ];
        
        console.log('🔄 Running INSERT query...');
        const result = await pool.query(query, values);
        const savedTeacher = result.rows[0];
        
        console.log('✅ Teacher saved! ID:', savedTeacher.id);
        res.status(201).json({ 
            success: true, 
            data: savedTeacher,
            message: 'Teacher saved successfully'
        });
        
    } catch (e) {
        console.error('❌ POST /api/teachers ERROR:', e.message, e.code);
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
        const { name, email, phone, subject, department, employee_id, designation, gender, date_of_joining, qualification, experience } = req.body;
        
        const query = `
            UPDATE teachers 
            SET name=$1, email=$2, phone=$3, subject=$4, department=$5, employee_id=$6, designation=$7, gender=$8, date_of_joining=$9, qualification=$10, experience=$11, updated_at=NOW() 
            WHERE id=$12 
            RETURNING *
        `;
        
        const result = await pool.query(query, [name, email, phone, subject, department, employee_id, designation, gender, date_of_joining, qualification, experience, req.params.id]);
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

// ============================================================
// FACULTY USER CREDENTIALS API ENDPOINTS (Real-time sync)
// ============================================================

// Get all faculty user credentials for a teacher
app.get('/api/faculty-users/:teacher_id', async (req, res) => {
    try {
        console.log('📖 GET /api/faculty-users/' + req.params.teacher_id);
        const result = await pool.query(
            `SELECT id, teacher_id, username, created_at, updated_at 
             FROM faculty_user_credentials 
             WHERE teacher_id = $1 
             ORDER BY created_at DESC`,
            [req.params.teacher_id]
        );
        res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('❌ GET /api/faculty-users ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get all active faculty users (for user selector)
app.get('/api/faculty-users', async (req, res) => {
    try {
        console.log('📖 GET /api/faculty-users (all active)');
        const result = await pool.query(`
            SELECT 
                fuc.id,
                fuc.teacher_id,
                fuc.username,
                t.name as teacher_name,
                t.designation,
                fuc.created_at,
                fuc.updated_at
            FROM faculty_user_credentials fuc
            JOIN teachers t ON fuc.teacher_id = t.id
            ORDER BY fuc.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('❌ GET /api/faculty-users ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Create new faculty user credential
app.post('/api/faculty-users', async (req, res) => {
    try {
        const { teacher_id, username, password } = req.body;
        
        if (!teacher_id || !username || !password) {
            return res.status(400).json({ success: false, error: 'teacher_id, username, and password are required' });
        }
        
        // Encode password using btoa (same as frontend)
        const password_hash = Buffer.from(password).toString('base64');
        
        console.log('📝 POST /api/faculty-users - Creating user:', username);
        const result = await pool.query(
            `INSERT INTO faculty_user_credentials (teacher_id, username, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, teacher_id, username, created_at`,
            [teacher_id, username, password_hash]
        );
        
        res.status(201).json({ 
            success: true, 
            data: result.rows[0],
            message: 'Faculty user created successfully'
        });
    } catch (e) {
        if (e.code === '23505') {
            return res.status(409).json({ success: false, error: 'Username already exists for this teacher' });
        }
        console.error('❌ POST /api/faculty-users ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Update faculty user password
app.put('/api/faculty-users/:id', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ success: false, error: 'password is required' });
        }
        
        const password_hash = Buffer.from(password).toString('base64');
        
        console.log('🔄 PUT /api/faculty-users/' + req.params.id);
        const result = await pool.query(
            `UPDATE faculty_user_credentials 
             SET password_hash = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, teacher_id, username, updated_at`,
            [password_hash, req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Faculty user not found' });
        }
        
        res.json({ 
            success: true, 
            data: result.rows[0],
            message: 'Password updated successfully'
        });
    } catch (e) {
        console.error('❌ PUT /api/faculty-users ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Delete faculty user
app.delete('/api/faculty-users/:id', async (req, res) => {
    try {
        console.log('🗑️  DELETE /api/faculty-users/' + req.params.id);
        const result = await pool.query(
            `DELETE FROM faculty_user_credentials 
             WHERE id = $1
             RETURNING id, username`,
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Faculty user not found' });
        }
        
        res.json({ 
            success: true, 
            message: 'Faculty user deleted successfully',
            data: result.rows[0]
        });
    } catch (e) {
        console.error('❌ DELETE /api/faculty-users ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// FIRST-TIME SETUP ENDPOINTS
// ============================================================

// Check if user needs first-time setup
app.get('/api/check-first-setup/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            `SELECT id, is_setup_complete FROM faculty_user_credentials WHERE id = $1`,
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.json({ 
            success: true, 
            is_setup_complete: result.rows[0].is_setup_complete || false 
        });
    } catch (e) {
        console.error('❌ GET /api/check-first-setup ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Verify current faculty password
app.post('/api/verify-faculty-password', async (req, res) => {
    try {
        const { userId, password } = req.body;
        
        if (!userId || !password) {
            return res.status(400).json({ success: false, error: 'userId and password required' });
        }
        
        const result = await pool.query(
            `SELECT password_hash FROM faculty_user_credentials WHERE id = $1`,
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        // Simple verification using btoa (same as frontend encoding)
        const encodedPassword = Buffer.from(password).toString('base64');
        const verified = encodedPassword === result.rows[0].password_hash;
        
        res.json({ success: verified, message: verified ? 'Password verified' : 'Invalid password' });
    } catch (e) {
        console.error('❌ POST /api/verify-faculty-password ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Send OTP to Gmail
app.post('/api/send-setup-otp', async (req, res) => {
    try {
        const { userId, email } = req.body;
        
        if (!userId || !email) {
            return res.status(400).json({ success: false, error: 'userId and email required' });
        }
        
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP in database
        await pool.query(
            `UPDATE faculty_user_credentials 
             SET otp_code = $1, otp_sent_at = NOW(), gmail = $2
             WHERE id = $3`,
            [otp, email, userId]
        );
        
        // TODO: Send email via Gmail API/SMTP
        // For now, log the OTP in development
        console.log(`📧 OTP for user ${userId}: ${otp}`);
        
        // In production, integrate with Nodemailer or Gmail API
        // For demo purposes, we'll just confirm OTP was sent
        res.json({ success: true, message: 'OTP sent to Gmail (demo: check server logs)' });
    } catch (e) {
        console.error('❌ POST /api/send-setup-otp ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Verify OTP
app.post('/api/verify-setup-otp', async (req, res) => {
    try {
        const { userId, email, otp } = req.body;
        
        if (!userId || !otp) {
            return res.status(400).json({ success: false, error: 'userId and otp required' });
        }
        
        const result = await pool.query(
            `SELECT otp_code, otp_sent_at FROM faculty_user_credentials WHERE id = $1`,
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const { otp_code, otp_sent_at } = result.rows[0];
        
        // Check if OTP is valid and not expired (10 minutes)
        const otpAge = (Date.now() - new Date(otp_sent_at).getTime()) / 1000 / 60;
        if (otpAge > 10) {
            return res.json({ success: false, message: 'OTP expired' });
        }
        
        if (otp_code !== otp) {
            return res.json({ success: false, message: 'Invalid OTP' });
        }
        
        res.json({ success: true, message: 'OTP verified' });
    } catch (e) {
        console.error('❌ POST /api/verify-setup-otp ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Complete first-time setup
app.post('/api/complete-first-setup', async (req, res) => {
    try {
        const { userId, newPassword, email, is_setup_complete } = req.body;
        
        if (!userId || !newPassword || !email) {
            return res.status(400).json({ success: false, error: 'userId, newPassword, and email required' });
        }
        
        // Encode new password
        const passwordHash = Buffer.from(newPassword).toString('base64');
        
        // Update user with new password, email, and setup complete flag
        const result = await pool.query(
            `UPDATE faculty_user_credentials 
             SET password_hash = $1, gmail = $2, is_setup_complete = true, otp_code = NULL, otp_sent_at = NULL
             WHERE id = $3
             RETURNING id, username, gmail, is_setup_complete`,
            [passwordHash, email, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.json({ 
            success: true, 
            message: 'Setup completed successfully',
            data: result.rows[0]
        });
    } catch (e) {
        console.error('❌ POST /api/complete-first-setup ERROR:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
app.post('/api/students', async (req, res) => {
    try {
        const { usn, name, email, phone, dob, gender, branch, semester, batch_year, year, stream, college, photo_url, auth, marks, attendance } = req.body;
        const r = await pool.query(
            `INSERT INTO students (usn, name, email, phone, dob, gender, branch, semester, batch_year, year, stream, college, photo_url, auth, marks, attendance)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
            [usn, name, email||null, phone||null, dob||null, gender||null, branch||null, semester||null, batch_year||null, year||null, stream||null, college||null, photo_url||null,
             JSON.stringify(auth||{}), JSON.stringify(marks||{}), JSON.stringify(attendance||{})]
        );
        res.json({ success: true, data: r.rows[0] });
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ success: false, error: 'USN already exists' });
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// SPA Fallback - MUST BE LAST
// Serve index.html for all other routes
// ============================================================

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Student Management System Server     ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║   🚀 Running on PORT: ${PORT}`.padEnd(40) + '║');
    console.log(`║   🌐 Open: http://localhost:${PORT}`.padEnd(40) + '║');
    console.log('║   ✅ Ready for connections              ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
});
