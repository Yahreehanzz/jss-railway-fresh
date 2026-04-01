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

// INIT DATABASE
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
    );
`).catch(err => console.error('DB Error:', err));

// Add missing columns
pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS designation VARCHAR(100);`).catch(err => {});
pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS gender VARCHAR(20);`).catch(err => {});
pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS date_of_joining DATE;`).catch(err => {});
pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS qualification VARCHAR(100);`).catch(err => {});
pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS experience INTEGER;`).catch(err => {});
pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS office_hours JSONB;`).catch(err => {});
pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`).catch(err => {});

// ============================================================
// API ENDPOINTS - THESE ARE THE ONLY ROUTES BEFORE FILES
// ============================================================

app.get('/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/api/teachers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM teachers ORDER BY name');
        res.json({ success: true, data: result.rows });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/teachers', async (req, res) => {
    try {
        const { name, email, phone, subject, department, employee_id, photo_url } = req.body;
        
        if (!name || !employee_id) {
            return res.json({ success: false, error: 'Name and employee_id required' });
        }
        
        const result = await pool.query(
            'INSERT INTO teachers (name, email, phone, subject, department, employee_id, photo_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [name, email||null, phone||null, subject||null, department||null, employee_id, photo_url||null]
        );
        
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.put('/api/teachers/:id', async (req, res) => {
    try {
        const { name, email, phone, subject, department, employee_id, photo_url } = req.body;
        const result = await pool.query(
            'UPDATE teachers SET name=$1, email=$2, phone=$3, subject=$4, department=$5, employee_id=$6, photo_url=$7, created_at=NOW() WHERE id=$8 RETURNING *',
            [name||null, email||null, phone||null, subject||null, department||null, employee_id||null, photo_url||null, req.params.id]
        );
        res.json({ success: true, data: result.rows[0] || null });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.delete('/api/teachers/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM teachers WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ============================================================
// STATIC FILES & SPA  
// ============================================================

app.use(express.static(__dirname, { maxAge: '1h' }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// START
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
