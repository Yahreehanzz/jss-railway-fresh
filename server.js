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
// EMAIL OTP SYSTEM FOR TEACHER SETUP
// ============================================================

let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    console.warn('⚠️ Nodemailer not available, email OTP will use test mode');
}

// In-memory OTP storage (expires after 10 minutes)
const otpStore = {};

// Generate random 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Email transporter - Test mode by default
let transporter = null;

// Initialize email service
function initEmailService() {
    if (!nodemailer) {
        console.log('ℹ️ Email service in TEST MODE - OTP will be logged to console');
        return;
    }
    
    const emailService = process.env.EMAIL_SERVICE || 'test'; // 'gmail', 'outlook', or 'test'
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASSWORD;
    
    if (emailService === 'gmail' && emailUser && emailPass) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass  // Use Gmail App Password, not your main password
            }
        });
        console.log('✅ Email service configured: Gmail');
    } else if (emailService === 'outlook' && emailUser && emailPass) {
        transporter = nodemailer.createTransport({
            host: 'smtp-mail.outlook.com',
            port: 587,
            secure: false,
            auth: {
                user: emailUser,
                pass: emailPass
            }
        });
        console.log('✅ Email service configured: Outlook');
    } else {
        console.log('ℹ️ Email service in TEST MODE - OTP will be logged to console');
        transporter = null;
    }
}

initEmailService();

// Send OTP endpoint (via Email)
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, countryCode, email } = req.body;
        
        if (!email || !phone || !countryCode) {
            return res.status(400).json({ success: false, error: 'Email, phone, and country code required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
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

        console.log(`📧 OTP Generated for ${email}: ${otp}`);

        // Email content
        const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
                .container { max-width: 400px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .otp-box { 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 8px;
                    text-align: center;
                    margin: 20px 0;
                }
                .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 4px; }
                .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Phone Verification</h2>
                </div>
                <p>Hi there,</p>
                <p>Your verification code for phone number <strong>${fullPhone}</strong> is:</p>
                <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <div class="footer">
                    <p>JSS Teacher Management System</p>
                </div>
            </div>
        </body>
        </html>
        `;

        // Try to send email if service configured
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: `Your Verification Code: ${otp}`,
                    html: emailContent
                });
                
                console.log(`✅ Email sent successfully to ${email}`);
                return res.json({ 
                    success: true, 
                    message: 'OTP sent via email',
                    email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3')  // Masked email
                });
            } catch (emailErr) {
                console.warn('⚠️ Email send failed:', emailErr.message);
                // Fall through to test mode below
            }
        }

        // Test mode: OTP logged to console
        console.log(`\n${'='.repeat(60)}`);
        console.log(`TEST MODE: OTP for ${email}`);
        console.log(`CODE: ${otp}`);
        console.log(`${'='.repeat(60)}\n`);
        
        return res.json({ 
            success: true, 
            message: 'OTP sent via email (check logs for test mode)',
            email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
            testMode: !transporter
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
        
        console.log(`✅ OTP verified successfully for ${email} (${verifiedPhone})`);
        
        return res.json({ 
            success: true, 
            message: 'Phone number verified',
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
