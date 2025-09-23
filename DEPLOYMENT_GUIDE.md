# 🏛️ Руководство по развертыванию системы управления адвокатской практикой

## 📋 Обзор проекта

Это система управления адвокатской практикой с функциями:
- ✅ Управление делами и клиентами
- ✅ Загрузка и OCR обработка документов
- ✅ Автоматическое извлечение дат и номеров
- ✅ Современный интерфейс на Next.js + Tailwind CSS

## 🚀 Развертывание на Render

### Вариант 1: MongoDB (текущая реализация)

#### 1. Подготовка проекта
```bash
# Клонируйте репозиторий
git clone <your-repo-url>
cd advokatem-main

# Установите зависимости
npm install
```

#### 2. Настройка переменных окружения
Создайте файл `.env` на основе `env.example`:

```env
# MongoDB Configuration
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=legal_practice

# Google Vision API Configuration
GOOGLE_VISION_API_KEY=your_google_vision_api_key_here
GOOGLE_CLOUD_KEY_PATH=path_to_service_account_key.json

# CORS Configuration
CORS_ORIGINS=https://your-app-name.onrender.com

# Next.js Configuration
NODE_ENV=production
PORT=3000
```

#### 3. Настройка MongoDB Atlas
1. Создайте аккаунт на [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Создайте новый кластер
3. Создайте пользователя базы данных
4. Получите строку подключения
5. Добавьте IP адрес Render в whitelist

#### 4. Настройка Google Vision API
1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите Vision API
4. Создайте Service Account
5. Скачайте JSON ключ
6. Получите API ключ

#### 5. Развертывание на Render
1. Зайдите на [Render](https://render.com)
2. Подключите ваш GitHub репозиторий
3. Выберите "Web Service"
4. Настройте:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: `Node`
   - **Plan**: `Starter` (бесплатно)

5. Добавьте переменные окружения в Render Dashboard

### Вариант 2: PostgreSQL + Supabase

#### 1. Настройка Supabase
1. Создайте проект на [Supabase](https://supabase.com)
2. Перейдите в SQL Editor
3. Выполните миграцию из файла `supabase_migration.sql`

#### 2. Модификация кода для PostgreSQL
Замените MongoDB код на PostgreSQL:

```javascript
// Установите pg и @supabase/supabase-js
npm install pg @supabase/supabase-js

// Пример подключения к Supabase
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)
```

## 🗄️ Структура базы данных

### MongoDB Collections
- **cases** - дела
- **case_documents** - документы с OCR

### PostgreSQL Tables (альтернатива)
- **cases** - дела
- **case_documents** - документы с OCR

## 📁 Файлы конфигурации

- `render.yaml` - конфигурация для автоматического развертывания
- `database_schema.sql` - схема PostgreSQL
- `supabase_migration.sql` - миграция для Supabase
- `env.example` - пример переменных окружения

## 🔧 Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Сборка для продакшена
npm run build
npm start
```

## 🧪 Тестирование

```bash
# Запуск тестов API
python backend_test.py
```

## 📊 Мониторинг

После развертывания проверьте:
- ✅ API доступен по адресу `https://your-app.onrender.com/api`
- ✅ База данных подключена
- ✅ OCR обработка работает
- ✅ Загрузка файлов функционирует

## 🚨 Устранение неполадок

### Проблемы с MongoDB
- Проверьте строку подключения
- Убедитесь, что IP адрес добавлен в whitelist
- Проверьте права пользователя

### Проблемы с Google Vision API
- Убедитесь, что API включен
- Проверьте квоты и лимиты
- Проверьте правильность API ключа

### Проблемы с Render
- Проверьте логи в Render Dashboard
- Убедитесь, что все переменные окружения установлены
- Проверьте, что приложение слушает правильный порт

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи в Render Dashboard
2. Убедитесь, что все переменные окружения настроены
3. Проверьте подключение к базе данных
4. Убедитесь, что Google Vision API работает

## 🎯 Следующие шаги

После успешного развертывания:
1. Настройте домен (опционально)
2. Настройте SSL сертификат
3. Настройте резервное копирование базы данных
4. Добавьте мониторинг и алерты
