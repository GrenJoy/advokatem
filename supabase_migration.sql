-- Supabase Migration for Legal Practice Management System
-- This file can be used to set up the database in Supabase

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    description TEXT,
    case_type VARCHAR(100),
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    status VARCHAR(20) CHECK (status IN ('active', 'paused', 'completed', 'archived')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    transcription_status VARCHAR(20) CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    transcription TEXT,
    transcription_error TEXT,
    extracted_dates TEXT[],
    extracted_numbers TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cases_client_name ON cases(client_name);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_documents_case_id ON case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_status ON case_documents(transcription_status);
CREATE INDEX IF NOT EXISTS idx_case_documents_created_at ON case_documents(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
DROP TRIGGER IF EXISTS update_cases_updated_at ON cases;
CREATE TRIGGER update_cases_updated_at 
    BEFORE UPDATE ON cases 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_case_documents_updated_at ON case_documents;
CREATE TRIGGER update_case_documents_updated_at 
    BEFORE UPDATE ON case_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for Supabase
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust based on your auth requirements)
CREATE POLICY "Enable read access for all users" ON cases FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON cases FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON cases FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON case_documents FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON case_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON case_documents FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON case_documents FOR DELETE USING (true);

-- Insert sample data
INSERT INTO cases (case_number, title, client_name, description, case_type, priority, status) VALUES
('CASE-1704067200000', 'Дело о расторжении брака', 'Петров Петр Петрович', 'Расторжение брака с разделом имущества', 'Семейное право', 'high', 'active'),
('CASE-1704067200001', 'Трудовой спор', 'Сидорова Анна Ивановна', 'Восстановление на работе после незаконного увольнения', 'Трудовое право', 'medium', 'active'),
('CASE-1704067200002', 'Уголовное дело', 'Козлов Игорь Сергеевич', 'Защита по обвинению в мошенничестве', 'Уголовное право', 'urgent', 'active')
ON CONFLICT (case_number) DO NOTHING;
