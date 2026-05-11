CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_sessions (
    session_token TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_sessions_student
ON student_sessions(student_id);

CREATE TABLE IF NOT EXISTS dictation_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    day_no INTEGER NOT NULL,
    attempt_date TEXT NOT NULL,
    total_count INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    review_count INTEGER NOT NULL,
    accuracy INTEGER NOT NULL,
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, day_no, attempt_date),
    FOREIGN KEY (student_id) REFERENCES students(student_id)
);

CREATE TABLE IF NOT EXISTS dictation_attempt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    day_no INTEGER NOT NULL,
    word TEXT NOT NULL,
    definition TEXT NOT NULL,
    source_day INTEGER NOT NULL,
    is_review INTEGER NOT NULL,
    is_correct INTEGER NOT NULL,
    user_input TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES dictation_attempts(id)
);

CREATE INDEX IF NOT EXISTS idx_attempt_items_student_day
ON dictation_attempt_items(student_id, day_no);

CREATE TABLE IF NOT EXISTS student_wrong_words (
    student_id TEXT NOT NULL,
    word TEXT NOT NULL,
    definition TEXT NOT NULL,
    source_day INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    first_wrong_at TEXT NOT NULL,
    last_wrong_at TEXT NOT NULL,
    last_correct_at TEXT,
    wrong_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (student_id, word),
    FOREIGN KEY (student_id) REFERENCES students(student_id)
);

CREATE INDEX IF NOT EXISTS idx_wrong_words_student
ON student_wrong_words(student_id);
