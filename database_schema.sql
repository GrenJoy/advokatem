-- PostgreSQL Schema for Legal Practice Management System
-- Based on MongoDB collections structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cases table (equivalent to 'cases' collection)
CREATE TABLE cases (
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

-- Case documents table (equivalent to 'case_documents' collection)
CREATE TABLE case_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    transcription_status VARCHAR(20) CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    transcription TEXT,
    transcription_error TEXT,
    extracted_dates TEXT[], -- Array of extracted dates
    extracted_numbers TEXT[], -- Array of extracted numbers
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_cases_client_name ON cases(client_name);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_priority ON cases(priority);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX idx_case_documents_case_id ON case_documents(case_id);
CREATE INDEX idx_case_documents_status ON case_documents(transcription_status);
CREATE INDEX idx_case_documents_created_at ON case_documents(created_at DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_cases_updated_at 
    BEFORE UPDATE ON cases 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_case_documents_updated_at 
    BEFORE UPDATE ON case_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing
INSERT INTO cases (case_number, title, client_name, description, case_type, priority, status) VALUES
('CASE-1704067200000', 'Дело о расторжении брака', 'Петров Петр Петрович', 'Расторжение брака с разделом имущества', 'Семейное право', 'high', 'active'),
('CASE-1704067200001', 'Трудовой спор', 'Сидорова Анна Ивановна', 'Восстановление на работе после незаконного увольнения', 'Трудовое право', 'medium', 'active'),
('CASE-1704067200002', 'Уголовное дело', 'Козлов Игорь Сергеевич', 'Защита по обвинению в мошенничестве', 'Уголовное право', 'urgent', 'active');

-- Comments for documentation
COMMENT ON TABLE cases IS 'Основная таблица дел адвокатской практики';
COMMENT ON TABLE case_documents IS 'Документы, прикрепленные к делам с OCR обработкой';

COMMENT ON COLUMN cases.case_number IS 'Уникальный номер дела';
COMMENT ON COLUMN cases.title IS 'Название дела';
COMMENT ON COLUMN cases.client_name IS 'ФИО клиента';
COMMENT ON COLUMN cases.description IS 'Описание дела';
COMMENT ON COLUMN cases.case_type IS 'Тип дела (гражданское, уголовное, административное и т.д.)';
COMMENT ON COLUMN cases.priority IS 'Приоритет дела';
COMMENT ON COLUMN cases.status IS 'Статус дела';

COMMENT ON COLUMN case_documents.file_name IS 'Имя файла в системе';
COMMENT ON COLUMN case_documents.original_name IS 'Оригинальное имя файла';
COMMENT ON COLUMN case_documents.file_type IS 'MIME тип файла';
COMMENT ON COLUMN case_documents.file_size IS 'Размер файла в байтах';
COMMENT ON COLUMN case_documents.transcription_status IS 'Статус OCR обработки';
COMMENT ON COLUMN case_documents.transcription IS 'Распознанный текст из документа';
COMMENT ON COLUMN case_documents.extracted_dates IS 'Массив извлеченных дат из документа';
COMMENT ON COLUMN case_documents.extracted_numbers IS 'Массив извлеченных номеров из документа';
