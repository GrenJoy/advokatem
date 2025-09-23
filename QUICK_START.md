# 🚀 Быстрый старт - Развертывание на Render

## ⚡ Быстрый запуск (5 минут)

### 1. Подготовка базы данных

**Вариант A: MongoDB Atlas (рекомендуется)**
1. Зайдите на [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Создайте бесплатный кластер
3. Получите строку подключения
4. Добавьте IP `0.0.0.0/0` в Network Access

**Вариант B: Supabase (PostgreSQL)**
1. Зайдите на [Supabase](https://supabase.com)
2. Создайте новый проект
3. Выполните SQL из файла `supabase_migration.sql`
4. Получите URL и ключи

### 2. Настройка Google Vision API
1. [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте проект
3. Включите Vision API
4. Создайте API ключ

### 3. Развертывание на Render
1. Зайдите на [Render](https://render.com)
2. Нажмите "New +" → "Web Service"
3. Подключите GitHub репозиторий
4. Настройте:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: `Node`

### 4. Переменные окружения в Render
```env
NODE_ENV=production
PORT=3000
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=legal_practice
GOOGLE_VISION_API_KEY=your_api_key_here
CORS_ORIGINS=https://your-app-name.onrender.com
```

### 5. Готово! 🎉
Ваше приложение будет доступно по адресу:
`https://your-app-name.onrender.com`

## 📊 Структура базы данных

### MongoDB Collections:
- **cases** - дела клиентов
- **case_documents** - документы с OCR

### PostgreSQL Tables (если используете Supabase):
- **cases** - дела клиентов  
- **case_documents** - документы с OCR

## 🔧 Локальный запуск

```bash
# Клонирование
git clone <your-repo>
cd advokatem-main

# Установка зависимостей
npm install

# Создание .env файла
cp env.example .env
# Отредактируйте .env с вашими данными

# Запуск
npm run dev
```

## 🧪 Тестирование

```bash
# Тест API
python backend_test.py
```

## 📁 Созданные файлы

- `render.yaml` - конфигурация Render
- `database_schema.sql` - схема PostgreSQL
- `supabase_migration.sql` - миграция Supabase
- `env.example` - пример переменных окружения
- `DEPLOYMENT_GUIDE.md` - подробное руководство
- `Dockerfile.postgres` - Docker для PostgreSQL

## 🆘 Если что-то не работает

1. **Проверьте логи** в Render Dashboard
2. **Убедитесь**, что все переменные окружения установлены
3. **Проверьте подключение** к базе данных
4. **Убедитесь**, что Google Vision API работает

## 🎯 Что дальше?

После успешного развертывания:
- Настройте домен (опционально)
- Добавьте SSL сертификат
- Настройте резервное копирование
- Добавьте мониторинг
