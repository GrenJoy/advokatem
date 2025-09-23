# 🚀 Настройка PostgreSQL с Supabase

## ✅ **Что уже сделано:**
- ✅ Создан API route `/api/postgres/`
- ✅ Установлена зависимость `pg`
- ✅ Обновлен `render.yaml`

## 🔧 **Что нужно сделать:**

### 1. Выполните миграцию в Supabase:
1. Зайдите в ваш Supabase проект
2. Перейдите в **SQL Editor**
3. Выполните код из файла `supabase_migration.sql`

### 2. Получите пароль базы данных:
1. В Supabase Dashboard → **Settings** → **Database**
2. Нажмите **"Reset database password"**
3. Установите новый пароль
4. Скопируйте строку подключения

### 3. Обновите переменные в Render:
В Render Dashboard → Environment Variables:
```
POSTGRES_URL=postgresql://postgres.fulczneorzmbeajdnrtt:ВАШ_ПАРОЛЬ@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

### 4. Обновите frontend для использования PostgreSQL API:
В файле `app/page.js` замените все `/api/` на `/api/postgres/`:

```javascript
// Было:
const response = await fetch('/api/cases')

// Стало:
const response = await fetch('/api/postgres/cases')
```

### 5. Перезапустите приложение в Render

## 🎯 **Преимущества PostgreSQL:**
- ✅ Реальная PostgreSQL база данных
- ✅ Прямое подключение без API ключей
- ✅ Полный контроль над данными
- ✅ Поддержка сложных запросов
- ✅ Транзакции и ACID

## 🧪 **Тестирование:**
После настройки проверьте:
- `https://your-app.onrender.com/api/postgres/` - должен вернуть "Legal Practice API Active (PostgreSQL)"
- Создание дел должно работать
- Загрузка документов должна работать

## 🔄 **Если что-то не работает:**
1. Проверьте логи в Render Dashboard
2. Убедитесь, что миграция выполнена в Supabase
3. Проверьте правильность пароля базы данных
4. Убедитесь, что frontend использует `/api/postgres/` пути

## 📋 **Следующие шаги:**
1. **Выполните миграцию** в Supabase
2. **Установите пароль** базы данных
3. **Обновите переменные** в Render
4. **Обновите frontend** для использования PostgreSQL API
5. **Перезапустите** приложение
