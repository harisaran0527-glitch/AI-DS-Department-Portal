-- ============================================================================
-- Migration: 001_add_subject_abbreviation.sql
-- Description: Add subject_abbreviation column to subjects table safely
-- Compatibility: Safe for both PostgreSQL and SQLite, idempotent (IF NOT EXISTS)
-- Data Integrity: Preserves all existing rows, constraints, and relationships
-- ============================================================================

-- PostgreSQL: Add subject_abbreviation column if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'subjects'
        AND column_name = 'subject_abbreviation'
    ) THEN
        ALTER TABLE subjects ADD COLUMN subject_abbreviation TEXT;
    END IF;
END $$;

-- Ensure performance index on subjects table
CREATE INDEX IF NOT EXISTS idx_subjects_code_ctx ON subjects(subject_code, year, semester, section);
CREATE INDEX IF NOT EXISTS idx_subjects_year_sem ON subjects(year, semester, section);

