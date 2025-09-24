# 🔍 ПОЛНЫЙ АНАЛИЗ БАЗЫ ДАННЫХ

## 📊 **СТРУКТУРА БАЗЫ ДАННЫХ:**

### **Основная таблица `cases`:**
```sql
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
```

### **Связанные таблицы с CASCADE DELETE:**
```sql
-- 1. Фотографии (case_photos)
case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE

-- 2. OCR результаты (photo_ocr_results)  
photo_id UUID NOT NULL REFERENCES case_photos(id) ON DELETE CASCADE
case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE

-- 3. Комментарии к фото (photo_comments)
photo_id UUID NOT NULL REFERENCES case_photos(id) ON DELETE CASCADE
case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE

-- 4. ИИ чат сессии (ai_chat_sessions)
case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE

-- 5. ИИ чат сообщения (ai_chat_messages)
session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE
case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE

-- 6. Кэш контекста (case_context_cache)
case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE

-- 7. Дополнительные файлы (case_additional_files)
case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE
```

## 🔄 **ОПЕРАЦИИ С БАЗОЙ ДАННЫХ:**

### **1. ЗАГРУЗКА ФОТО:**
```javascript
// 1. Сохраняем фото в case_photos
INSERT INTO case_photos (id, case_id, file_name, original_name, file_type, file_size, file_path, display_order)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)

// 2. Создаем запись OCR в photo_ocr_results
INSERT INTO photo_ocr_results (id, photo_id, case_id, processing_status)
VALUES ($1, $2, $3, 'processing')

// 3. Очищаем кэш контекста
DELETE FROM case_context_cache WHERE case_id = $1
```

### **2. OCR ОБРАБОТКА:**
```javascript
// Обновляем результаты OCR
UPDATE photo_ocr_results 
SET raw_text = $1, extracted_dates = $2, extracted_numbers = $3, 
    extracted_names = $4, extracted_amounts = $5, confidence_score = $6,
    processing_status = 'completed', updated_at = $7
WHERE photo_id = $8
```

### **3. ИИ ЧАТ:**
```javascript
// 1. Получаем или создаем сессию
SELECT get_or_create_active_session($1) as session_id

// 2. Сохраняем сообщения
INSERT INTO ai_chat_messages (session_id, case_id, message_type, message_text, context_used)
VALUES ($1, $2, $3, $4, $5)

// 3. Загружаем историю
SELECT message_type, message_text, created_at
FROM ai_chat_messages 
WHERE session_id = $1 
ORDER BY created_at DESC 
LIMIT 10
```

### **4. РЕДАКТИРОВАНИЕ ДЕЛА:**
```javascript
// Обновляем информацию о деле
UPDATE cases 
SET title = $1, client_name = $2, description = $3, case_type = $4, 
    priority = $5, status = $6, updated_at = $7
WHERE id = $8

// Очищаем кэш
DELETE FROM case_context_cache WHERE case_id = $1
```

### **5. АРХИВИРОВАНИЕ ДЕЛА:**
```javascript
// Меняем статус на 'archived'
UPDATE cases 
SET status = 'archived', updated_at = $1
WHERE id = $2

// ВСЕ ДАННЫЕ СОХРАНЯЮТСЯ:
✅ case_photos (фотографии)
✅ photo_ocr_results (OCR результаты)
✅ photo_comments (комментарии)
✅ ai_chat_sessions (сессии чата)
✅ ai_chat_messages (сообщения чата)
✅ case_context_cache (кэш контекста)
✅ case_additional_files (дополнительные файлы)
```

### **6. УДАЛЕНИЕ ДЕЛА:**
```javascript
// Удаляем дело (CASCADE удаляет все связанные данные)
DELETE FROM cases WHERE id = $1

// УДАЛЯЕТСЯ ВСЕ:
❌ case_photos (фотографии)
❌ photo_ocr_results (OCR результаты)
❌ photo_comments (комментарии)
❌ ai_chat_sessions (сессии чата)
❌ ai_chat_messages (сообщения чата)
❌ case_context_cache (кэш контекста)
❌ case_additional_files (дополнительные файлы)
```

## 🗂️ **ФИЛЬТРАЦИЯ ПО СТАТУСУ:**

### **Активные дела:**
```sql
SELECT * FROM cases 
WHERE status != 'archived' 
ORDER BY created_at DESC
```

### **Архивные дела:**
```sql
SELECT * FROM cases 
WHERE status = 'archived' 
ORDER BY created_at DESC
```

### **Восстановление из архива:**
```sql
UPDATE cases 
SET status = 'active', updated_at = $1
WHERE id = $2 AND status = 'archived'
```

## 🔧 **ИСПРАВЛЕНИЯ АРХИВА:**

### **1. API эндпоинты:**
- ✅ `GET /cases` - только активные дела
- ✅ `GET /cases/archived` - только архивные дела
- ✅ `POST /cases/{id}/archive` - архивирование
- ✅ `POST /cases/{id}/restore` - восстановление

### **2. Фронтенд функции:**
- ✅ `loadArchivedCases()` - загрузка архива
- ✅ `restoreCase()` - восстановление дела
- ✅ Панель архива с кнопкой "Восстановить"

### **3. UI компоненты:**
- ✅ Желтая панель архива
- ✅ Список архивированных дел
- ✅ Кнопка восстановления
- ✅ Индикатор статуса "Архив"

## 🎯 **РЕЗУЛЬТАТ:**

### **Архивирование работает правильно:**
- ✅ **Дела скрываются** из основного списка
- ✅ **Все данные сохраняются** - фото, файлы, чат
- ✅ **Архив отображается** в отдельной панели
- ✅ **Восстановление работает** - дело возвращается в активные

### **База данных стабильна:**
- ✅ **CASCADE DELETE** - при удалении все связанные данные удаляются
- ✅ **Архивирование безопасно** - данные не теряются
- ✅ **Кэш обновляется** - при изменениях контекст перестраивается
- ✅ **Сессии сохраняются** - история чата не теряется

**Архив теперь работает полностью!** 🎉
