-- Create all necessary tables for Student Management System

-- STUDENTS TABLE
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
);

-- TEACHERS TABLE
CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    subject VARCHAR(100),
    department VARCHAR(50),
    qualification VARCHAR(100),
    experience INTEGER,
    office_hours JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- FEES TABLE
CREATE TABLE IF NOT EXISTS fees (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    usn VARCHAR(20),
    amount DECIMAL(10, 2),
    fee_type VARCHAR(50),
    due_date DATE,
    paid_date DATE,
    status VARCHAR(20),
    payment_method VARCHAR(50),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    usn VARCHAR(20),
    session_id VARCHAR(100),
    date DATE,
    status VARCHAR(20),
    check_in_time TIME,
    check_out_time TIME,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- QR CHECK-INS TABLE
CREATE TABLE IF NOT EXISTS qr_checkins (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    attendee VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    checked_in_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, student_id)
);

-- INTERNAL ASSESSMENTS TABLE
CREATE TABLE IF NOT EXISTS internal_assessments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    usn VARCHAR(20),
    subject VARCHAR(100),
    test_number INTEGER,
    marks_obtained DECIMAL(5, 2),
    total_marks DECIMAL(5, 2),
    date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- TIMETABLES TABLE
CREATE TABLE IF NOT EXISTS timetables (
    id SERIAL PRIMARY KEY,
    branch VARCHAR(50),
    semester INTEGER,
    day_of_week VARCHAR(20),
    subject VARCHAR(100),
    teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    start_time TIME,
    end_time TIME,
    room_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- USER PROFILES TABLE
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role VARCHAR(50),
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_usn ON students(usn);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_fees_usn ON fees(usn);
CREATE INDEX IF NOT EXISTS idx_fees_status ON fees(status);
CREATE INDEX IF NOT EXISTS idx_attendance_usn ON attendance(usn);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_qr_checkins_session ON qr_checkins(session_id);
