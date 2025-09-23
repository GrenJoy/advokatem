-- Полная схема базы данных для системы управления адвокатской практикой
-- Включает дела, фотографии, комментарии, OCR результаты и ИИ-чат

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
    file_path TEXT, -- путь к файлу на сервере
    display_order INTEGER DEFAULT 0, -- порядок отображения
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OCR results table (результаты распознавания текста)
CREATE TABLE photo_ocr_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES case_photos(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    raw_text TEXT, -- весь распознанный текст
    extracted_dates TEXT[], -- массив дат
    extracted_numbers TEXT[], -- массив номеров
    extracted_names TEXT[], -- массив имен
    extracted_amounts TEXT[], -- массив сумм
    confidence_score DECIMAL(3,2), -- точность распознавания
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

-- AI chat messages table (ИИ-чат с контекстом дел)
CREATE TABLE ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    message_type VARCHAR(20) CHECK (message_type IN ('user', 'ai')) NOT NULL,
    message_text TEXT NOT NULL,
    context_data JSONB, -- контекст дела, фотографий, OCR результатов
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX idx_ai_chat_messages_case_id ON ai_chat_messages(case_id);
CREATE INDEX idx_ai_chat_messages_created_at ON ai_chat_messages(case_id, created_at DESC);

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
COMMENT ON TABLE ai_chat_messages IS 'Сообщения ИИ-чата с контекстом дел';

COMMENT ON COLUMN cases.case_number IS 'Уникальный номер дела';
COMMENT ON COLUMN cases.title IS 'Название дела';
COMMENT ON COLUMN cases.client_name IS 'ФИО клиента';
COMMENT ON COLUMN cases.description IS 'Описание дела';
COMMENT ON COLUMN cases.case_type IS 'Тип дела (гражданское, уголовное, административное и т.д.)';
COMMENT ON COLUMN cases.priority IS 'Приоритет дела';
COMMENT ON COLUMN cases.status IS 'Статус дела';

COMMENT ON COLUMN case_photos.file_name IS 'Имя файла в системе';
COMMENT ON COLUMN case_photos.original_name IS 'Оригинальное имя файла';
COMMENT ON COLUMN case_photos.display_order IS 'Порядок отображения фотографий';
COMMENT ON COLUMN case_photos.file_path IS 'Путь к файлу на сервере';

COMMENT ON COLUMN photo_ocr_results.raw_text IS 'Весь распознанный текст из фотографии';
COMMENT ON COLUMN photo_ocr_results.extracted_dates IS 'Массив извлеченных дат';
COMMENT ON COLUMN photo_ocr_results.extracted_numbers IS 'Массив извлеченных номеров';
COMMENT ON COLUMN photo_ocr_results.extracted_names IS 'Массив извлеченных имен';
COMMENT ON COLUMN photo_ocr_results.extracted_amounts IS 'Массив извлеченных сумм';
COMMENT ON COLUMN photo_ocr_results.confidence_score IS 'Точность распознавания (0.00-1.00)';

COMMENT ON COLUMN photo_comments.comment_text IS 'Текст комментария к фотографии';
COMMENT ON COLUMN photo_comments.author_name IS 'Автор комментария';

COMMENT ON COLUMN ai_chat_messages.message_type IS 'Тип сообщения (user/ai)';
COMMENT ON COLUMN ai_chat_messages.message_text IS 'Текст сообщения';
COMMENT ON COLUMN ai_chat_messages.context_data IS 'Контекст дела в JSON формате';
