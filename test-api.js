require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Test POST endpoint
app.post('/test', async (req, res) => {
    try {
        const { name, employee_id, department } = req.body;
        const result = await pool.query(
            'INSERT INTO teachers (name, employee_id, department) VALUES ($1, $2, $3) RETURNING *',
            [name, employee_id, department]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// GET test
app.get('/test', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) as count FROM teachers');
        res.json({ success: true, count: result.rows[0].count });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.listen(3001, () => {
    console.log('Test server running on port 3001');
});
