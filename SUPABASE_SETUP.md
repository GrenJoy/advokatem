# 🚀 Быстрое переключение на Supabase PostgreSQL

## ✅ **Что уже сделано:**
- ✅ Установлен `@supabase/supabase-js`
- ✅ Создан новый API route `/api/supabase/`
- ✅ Обновлены переменные окружения
- ✅ Обновлен `render.yaml`

## 🔧 **Что нужно сделать:**

### 1. Выполните миграцию в Supabase:
1. Зайдите в ваш Supabase проект
2. Перейдите в **SQL Editor**
3. Выполните код из файла `supabase_migration.sql`

### 2. Получите ключи Supabase:
1. В Supabase Dashboard → **Settings** → **API**
2. Скопируйте:
   - **Project URL** (SUPABASE_URL)
   - **anon public** key (SUPABASE_ANON_KEY)

### 3. Обновите переменные в Render:
В Render Dashboard → Environment Variables:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Обновите frontend для использования нового API:
В файле `app/page.js` замените все `/api/` на `/api/supabase/`:

```javascript
// Было:
const response = await fetch('/api/cases')

// Стало:
const response = await fetch('/api/supabase/cases')
```

### 5. Перезапустите приложение в Render

## 🎯 **Преимущества Supabase:**
- ✅ Реальная PostgreSQL база данных
- ✅ Встроенная аутентификация
- ✅ Real-time подписки
- ✅ Автоматические API
- ✅ Встроенный dashboard
- ✅ Row Level Security

## 🧪 **Тестирование:**
После настройки проверьте:
- `https://your-app.onrender.com/api/supabase/` - должен вернуть "Legal Practice API Active (Supabase)"
- Создание дел должно работать
- Загрузка документов должна работать

## 🔄 **Если что-то не работает:**
1. Проверьте логи в Render Dashboard
2. Убедитесь, что миграция выполнена в Supabase
3. Проверьте правильность ключей Supabase
4. Убедитесь, что frontend использует `/api/supabase/` пути
