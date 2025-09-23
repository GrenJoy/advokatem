# 🚀 Быстрое исправление ошибки Supabase

## ❌ **Проблема:**
```
Error: Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL
```

## ✅ **Решение:**

### **Вариант 1: Исправить Supabase (рекомендуется)**

1. **Получите ключи из Supabase:**
   - Зайдите в ваш Supabase проект
   - Settings → API
   - Скопируйте Project URL и anon key

2. **Установите переменные в Render:**
   ```
   SUPABASE_URL=https://fulczneorzmbeajdnrtt.supabase.co
   SUPABASE_ANON_KEY=ваш_anon_ключ_здесь
   ```

3. **Перезапустите сервис в Render**

### **Вариант 2: Временно отключить Supabase**

1. **Supabase API уже отключен** (папка переименована)
2. **Приложение должно запуститься** без ошибок
3. **API будет работать** по адресу `/api/test`

### **Вариант 3: Использовать MongoDB (быстро)**

1. **Создайте MongoDB Atlas:**
   - Зайдите на [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Создайте бесплатный кластер
   - Получите строку подключения

2. **Установите переменные в Render:**
   ```
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/
   DB_NAME=legal_practice
   ```

3. **Удалите Supabase переменные** из Render

## 🧪 **Тестирование:**

После исправления проверьте:
- `https://your-app.onrender.com/api/test` - должен вернуть JSON
- `https://your-app.onrender.com/api/` - должен вернуть "Legal Practice API Active"

## 📋 **Следующие шаги:**

1. **Выберите вариант** (Supabase, MongoDB, или временно отключить)
2. **Установите переменные** в Render Dashboard
3. **Перезапустите** сервис
4. **Проверьте** работу API

## 🔄 **Если что-то не работает:**

1. **Проверьте логи** в Render Dashboard
2. **Убедитесь**, что переменные установлены правильно
3. **Проверьте формат** URL (должен начинаться с https://)
4. **Убедитесь**, что ключи Supabase действительны
