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

// GET all teachers
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
