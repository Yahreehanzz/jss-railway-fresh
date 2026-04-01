require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// DATABASE
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// TEST DATABASE CONNECTION
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ DATABASE CONNECTION FAILED:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Database connected successfully');
        release();
    }
});

// INIT DATABASE SCHEMA
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
            );
        `);
        console.log('✅ Teachers table ready');

        // Add missing columns if needed
        const columns = ['designation', 'gender', 'date_of_joining', 'qualification', 'experience', 'office_hours', 'updated_at'];
        for (let col of columns) {
            try {
                await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS ${col} ${col === 'office_hours' ? 'JSONB' : col === 'experience' ? 'INTEGER' : col === 'date_of_joining' ? 'DATE' : 'VARCHAR(100)'};`);
            } catch (e) {
                // Column might already exist
            }
        }
        console.log('✅ Database schema initialized');
    } catch (err) {
        console.error('❌ Database initialization error:', err.message);
    }
}

initDatabase();

// ============================================================
// GLOBAL ERROR HANDLER FOR UNHANDLED REJECTIONS
// ============================================================
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================================
// API ENDPOINTS - MUST BE BEFORE STATIC FILES
// ============================================================

app.get('/health', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    return res.json({ ok: true });
});

app.get('/api/teachers', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
        const result = await pool.query('SELECT * FROM teachers ORDER BY name');
        return res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('GET /api/teachers error:', e.message);
        return res.json({ success: false, error: e.message });
    }
});

app.post('/api/teachers', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
        const { name, email, phone, subject, department, employee_id, photo_url, designation, gender, date_of_joining, qualification, experience } = req.body;
        
        console.log('POST /api/teachers received:', { name, employee_id, designation, gender, date_of_joining });
        
        if (!name || !employee_id) {
            return res.json({ success: false, error: 'Name and employee_id are required' });
        }
        
        const insertQuery = `
            INSERT INTO teachers 
            (name, email, phone, subject, department, employee_id, photo_url, designation, gender, date_of_joining, qualification, experience) 
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
            photo_url || null,
            designation || null,
            gender || null,
            date_of_joining || null,
            qualification || null,
            experience || null
        ];
        
        const result = await pool.query(insertQuery, values);
        console.log('Teacher saved successfully, ID:', result.rows[0].id);
        return res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        console.error('POST /api/teachers error:', e.message);
        return res.json({ success: false, error: e.message });
    }
});

app.put('/api/teachers/:id', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
        const { name, email, phone, subject, department, employee_id, photo_url, designation, gender, date_of_joining, qualification, experience } = req.body;
        const result = await pool.query(
            `UPDATE teachers SET name=$1, email=$2, phone=$3, subject=$4, department=$5, employee_id=$6, photo_url=$7, designation=$8, gender=$9, date_of_joining=$10, qualification=$11, experience=$12, updated_at=NOW() WHERE id=$13 RETURNING *`,
            [name||null, email||null, phone||null, subject||null, department||null, employee_id||null, photo_url||null, designation||null, gender||null, date_of_joining||null, qualification||null, experience||null, req.params.id]
        );
        return res.json({ success: true, data: result.rows[0] || null });
    } catch (e) {
        console.error('PUT /api/teachers error:', e.message);
        return res.json({ success: false, error: e.message });
    }
});

app.delete('/api/teachers/:id', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
        await pool.query('DELETE FROM teachers WHERE id=$1', [req.params.id]);
        return res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/teachers error:', e.message);
        return res.json({ success: false, error: e.message });
    }
});

// ============================================================
// STATIC FILES & SPA (AFTER ALL API ROUTES)
// ============================================================

app.use(express.static(__dirname, { maxAge: '1h' }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback SPA route
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// GLOBAL ERROR HANDLER (LAST MIDDLEWARE)
// ============================================================
app.use((err, req, res, next) => {
    console.error('Global error handler:', err.message);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ success: false, error: err.message });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 Railway API: https://jss-railway-fresh-production.up.railway.app/api`);
});
