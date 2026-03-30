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

// Create student
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
