# 📎 Настройка дополнительных файлов

## ✅ **ЧТО ДОБАВЛЕНО:**

### **1. Новая таблица в базе данных:**
```sql
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
```

### **2. API Endpoints:**
- `POST /api/optimized/additional-files/upload` - загрузка файла
- `GET /api/optimized/cases/{id}/additional-files` - получение файлов дела
- `DELETE /api/optimized/additional-files/{id}` - удаление файла

### **3. Frontend функции:**
- Панель "Дополнительные файлы" 
- Загрузка файлов с описанием
- Отметка важных файлов
- Удаление файлов

## 🗄️ **НАСТРОЙКА БАЗЫ ДАННЫХ:**

### **Шаг 1: Удалите старую базу (если нужно)**
В Supabase SQL Editor выполните:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

### **Шаг 2: Создайте новую базу**
Выполните весь код из файла `optimized_schema.sql` в Supabase SQL Editor.

### **Шаг 3: Проверьте создание таблиц**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Должны быть таблицы:
- cases
- case_photos
- photo_ocr_results
- photo_comments
- ai_chat_sessions
- ai_chat_messages
- case_context_cache
- **case_additional_files** ← новая таблица

## 🎯 **КАК ИСПОЛЬЗОВАТЬ:**

### **1. Загрузка дополнительных файлов:**
1. Выберите дело
2. Нажмите кнопку "Файлы" в заголовке
3. Нажмите "Добавить"
4. Выберите файл (Word, PDF, Excel, текстовые файлы)
5. Добавьте описание (необязательно)
6. Отметьте как важный (необязательно)
7. Нажмите "Загрузить"

### **2. Просмотр файлов:**
- Все файлы отображаются в панели "Дополнительные файлы"
- Показывается название, дата загрузки, размер
- Важные файлы помечены красным бейджем
- Можно удалить файл кнопкой корзины

### **3. Типы файлов:**
- **Word документы** (.doc, .docx)
- **PDF файлы** (.pdf)
- **Excel таблицы** (.xls, .xlsx)
- **Текстовые файлы** (.txt, .rtf)

## 🔧 **ТЕХНИЧЕСКИЕ ДЕТАЛИ:**

### **Хранение файлов:**
- Файлы сохраняются в базе данных как BLOB
- Путь: `/uploads/additional/{fileId}-{originalName}`
- Максимальный размер: 10MB (настраивается)

### **Метаданные:**
- `original_name` - оригинальное имя файла
- `file_type` - MIME тип файла
- `file_size` - размер в байтах
- `description` - описание файла
- `is_important` - флаг важности

### **Безопасность:**
- Файлы привязаны к конкретному делу
- При удалении дела удаляются все файлы
- Валидация типов файлов на frontend

## 🎉 **ГОТОВО!**

Теперь вы можете:
- ✅ Загружать Word документы, PDF, Excel файлы
- ✅ Добавлять описания к файлам
- ✅ Отмечать важные файлы
- ✅ Просматривать все файлы дела
- ✅ Удалять ненужные файлы
- ✅ Файлы НЕ идут в OCR (только фотографии)

**Система готова к использованию!** 🚀
