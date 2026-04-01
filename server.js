// ============================================================
// MINIMAL TEST SERVER - Pure Express with proper routing
// ============================================================
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('\n🚀 [START] Minimal server starting...');

// ============================================================
// MIDDLEWARE - Before everything
// ============================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// DATABASE POOL - Must be early
// ============================================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

console.log('📦 [DB] Connecting to database...');
pool.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('❌ [DB] Connection failed:', err.message);
    } else {
        console.log('✅ [DB] Connected successfully');
        ensureTeachersTable();
    }
});

// Ensure teachers table exists
function ensureTeachersTable() {
    const sql = `
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
    
    pool.query(sql, (err) => {
        if (err) {
            console.error('❌ [DB] Failed to create table:', err.message);
        } else {
            console.log('✅ [DB] Teachers table ready');
        }
    });
}

// ============================================================
// HEALTH ENDPOINT
// ============================================================
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// ============================================================
// API: TEACHERS - GET ALL
// ============================================================
app.get('/api/teachers', async (req, res) => {
    console.log('📨 GET /api/teachers');
    try {
        const result = await pool.query('SELECT * FROM teachers ORDER BY name ASC');
        res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('❌ GET /api/teachers error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// API: TEACHERS - CREATE
// ============================================================
app.post('/api/teachers', async (req, res) => {
    console.log('📨 POST /api/teachers');
    console.log('   Body:', JSON.stringify(req.body).substring(0, 150));
    
    try {
        const { name, email, phone, subject, department, employee_id, photo_url } = req.body;
        
        if (!name || !employee_id) {
            console.log('❌ Missing required fields');
            return res.status(400).json({ success: false, error: 'Name and employee_id required' });
        }
        
        const result = await pool.query(
            `INSERT INTO teachers (name, email, phone, subject, department, employee_id, photo_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, email || null, phone || null, subject || null, department || null, employee_id, photo_url || null]
        );
        
        console.log('✅ Teacher created with ID:', result.rows[0].id);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('❌ POST /api/teachers error:', error.message, error.code);
        if (error.code === '23505') {
            return res.status(409).json({ success: false, error: 'Employee ID already exists' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// API: TEACHERS - UPDATE
// ============================================================
app.put('/api/teachers/:id', async (req, res) => {
    console.log('📨 PUT /api/teachers/:id');
    try {
        const { id } = req.params;
        const { name, email, phone, subject, department, employee_id, photo_url } = req.body;
        
        const result = await pool.query(
            `UPDATE teachers SET name=$1, email=$2, phone=$3, subject=$4, department=$5, employee_id=$6, photo_url=$7, updated_at=NOW()
             WHERE id=$8 RETURNING *`,
            [name, email || null, phone || null, subject || null, department || null, employee_id, photo_url || null, id]
        );
        
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Teacher not found' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('❌ PUT /api/teachers/:id error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// API: TEACHERS - DELETE
// ============================================================
app.delete('/api/teachers/:id', async (req, res) => {
    console.log('📨 DELETE /api/teachers/:id');
    try {
        await pool.query('DELETE FROM teachers WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ DELETE /api/teachers/:id error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// STATIC FILES (AFTER ALL API ROUTES!)
// ============================================================
app.use(express.static(path.join(__dirname), {
    maxAge: '1h',
    etag: false
}));

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// SPA FALLBACK (MUST BE LAST)
// ============================================================
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err.message);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log('\n═══════════════════════════════════════════');
    console.log('✅ SERVER READY - FRESH DEPLOYMENT');
    console.log(`📍 Port: ${PORT}`);
    console.log('🔗 Routes:');
    console.log('   GET  /health');
    console.log('   GET  /api/teachers');
    console.log('   POST /api/teachers');
    console.log('   PUT  /api/teachers/:id');
    console.log('   DELETE /api/teachers/:id');
    console.log('═══════════════════════════════════════════\n');
});
