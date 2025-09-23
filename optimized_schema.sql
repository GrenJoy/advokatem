-- Оптимизированная схема с сессиями ИИ-чата
-- Добавляем таблицы для управления сессиями и контекстом

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cases table (дела)
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

-- Photos table (фотографии в делах)
CREATE TABLE case_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    file_path TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_name) -- Добавляем уникальный индекс для ON CONFLICT
);

-- OCR results table (результаты распознавания текста)
CREATE TABLE photo_ocr_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES case_photos(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    raw_text TEXT,
    extracted_dates TEXT[],
    extracted_numbers TEXT[],
    extracted_names TEXT[],
    extracted_amounts TEXT[],
    confidence_score DECIMAL(3,2),
    processing_status VARCHAR(20) CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Photo comments table (комментарии к фотографиям)
CREATE TABLE photo_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES case_photos(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    author_name VARCHAR(255) DEFAULT 'Адвокат',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI Chat Sessions table (сессии ИИ-чата)
CREATE TABLE ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    session_name VARCHAR(255) DEFAULT 'Основная сессия',
    context_summary TEXT, -- краткое описание контекста дела
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI Chat Messages table (сообщения в сессиях)
CREATE TABLE ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    message_type VARCHAR(20) CHECK (message_type IN ('user', 'ai', 'system')) NOT NULL,
    message_text TEXT NOT NULL,
    context_used JSONB, -- какие данные использовались для ответа
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case Context Cache table (кэш контекста дела)
CREATE TABLE case_context_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    context_data JSONB NOT NULL, -- полный контекст дела
    photos_summary TEXT, -- краткое описание фотографий
    ocr_summary TEXT, -- краткое описание OCR результатов
    cache_name VARCHAR(255), -- имя кэша в Gemini API
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(case_id) -- Добавляем уникальный индекс для ON CONFLICT
);

-- Indexes for better performance
CREATE INDEX idx_cases_client_name ON cases(client_name);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_priority ON cases(priority);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX idx_case_photos_case_id ON case_photos(case_id);
CREATE INDEX idx_case_photos_display_order ON case_photos(case_id, display_order);
CREATE INDEX idx_photo_ocr_results_photo_id ON photo_ocr_results(photo_id);
CREATE INDEX idx_photo_ocr_results_case_id ON photo_ocr_results(case_id);
CREATE INDEX idx_photo_comments_photo_id ON photo_comments(photo_id);
CREATE INDEX idx_photo_comments_case_id ON photo_comments(case_id);
CREATE INDEX idx_ai_chat_sessions_case_id ON ai_chat_sessions(case_id);
CREATE INDEX idx_ai_chat_sessions_active ON ai_chat_sessions(case_id, is_active);
CREATE INDEX idx_ai_chat_messages_session_id ON ai_chat_messages(session_id);
CREATE INDEX idx_ai_chat_messages_case_id ON ai_chat_messages(case_id);
CREATE INDEX idx_ai_chat_messages_created_at ON ai_chat_messages(session_id, created_at DESC);
CREATE INDEX idx_case_context_cache_case_id ON case_context_cache(case_id);

-- Table for Additional Files (Word, PDF, etc.)
CREATE TABLE case_additional_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    file_path TEXT,
    description TEXT,
    is_important BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for additional files
CREATE INDEX idx_case_additional_files_case_id ON case_additional_files(case_id);

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

CREATE TRIGGER update_case_photos_updated_at 
    BEFORE UPDATE ON case_photos 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_photo_ocr_results_updated_at 
    BEFORE UPDATE ON photo_ocr_results 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_photo_comments_updated_at 
    BEFORE UPDATE ON photo_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_chat_sessions_updated_at 
    BEFORE UPDATE ON ai_chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_case_additional_files_updated_at 
    BEFORE UPDATE ON case_additional_files 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create active session
CREATE OR REPLACE FUNCTION get_or_create_active_session(p_case_id UUID)
RETURNS UUID AS $$
DECLARE
    session_id UUID;
BEGIN
    -- Try to get existing active session
    SELECT id INTO session_id 
    FROM ai_chat_sessions 
    WHERE case_id = p_case_id AND is_active = true 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- If no active session exists, create one
    IF session_id IS NULL THEN
        INSERT INTO ai_chat_sessions (id, case_id, session_name, is_active)
        VALUES (uuid_generate_v4(), p_case_id, 'Основная сессия', true)
        RETURNING id INTO session_id;
    END IF;
    
    RETURN session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get case context summary
CREATE OR REPLACE FUNCTION get_case_context_summary(p_case_id UUID)
RETURNS TEXT AS $$
DECLARE
    context_summary TEXT;
    case_info RECORD;
    photos_count INTEGER;
    ocr_count INTEGER;
BEGIN
    -- Get case basic info
    SELECT title, client_name, description, case_type, priority
    INTO case_info
    FROM cases WHERE id = p_case_id;
    
    -- Count photos and OCR results
    SELECT COUNT(*) INTO photos_count FROM case_photos WHERE case_id = p_case_id;
    SELECT COUNT(*) INTO ocr_count FROM photo_ocr_results WHERE case_id = p_case_id AND processing_status = 'completed';
    
    -- Build context summary
    context_summary := format(
        'Дело: %s | Клиент: %s | Тип: %s | Приоритет: %s | Фото: %s | OCR: %s',
        case_info.title,
        case_info.client_name,
        case_info.case_type,
        case_info.priority,
        photos_count,
        ocr_count
    );
    
    RETURN context_summary;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing
INSERT INTO cases (case_number, title, client_name, description, case_type, priority, status) VALUES
('CASE-1704067200000', 'Дело о расторжении брака', 'Петров Петр Петрович', 'Расторжение брака с разделом имущества', 'Семейное право', 'high', 'active'),
('CASE-1704067200001', 'Трудовой спор', 'Сидорова Анна Ивановна', 'Восстановление на работе после незаконного увольнения', 'Трудовое право', 'medium', 'active'),
('CASE-1704067200002', 'Уголовное дело', 'Козлов Игорь Сергеевич', 'Защита по обвинению в мошенничестве', 'Уголовное право', 'urgent', 'active');

-- Comments for documentation
COMMENT ON TABLE cases IS 'Основная таблица дел адвокатской практики';
COMMENT ON TABLE case_photos IS 'Фотографии, прикрепленные к делам';
COMMENT ON TABLE photo_ocr_results IS 'Результаты OCR обработки фотографий через Gemini';
COMMENT ON TABLE photo_comments IS 'Комментарии к фотографиям';
COMMENT ON TABLE ai_chat_sessions IS 'Сессии ИИ-чата для каждого дела';
COMMENT ON TABLE ai_chat_messages IS 'Сообщения в сессиях ИИ-чата';
COMMENT ON TABLE case_context_cache IS 'Кэш контекста дела для оптимизации';

COMMENT ON FUNCTION get_or_create_active_session(UUID) IS 'Получить или создать активную сессию для дела';
COMMENT ON FUNCTION get_case_context_summary(UUID) IS 'Получить краткое описание контекста дела';
