# 🔄 ОБНОВЛЕНИЕ GEMINI API

## ✅ **ИСПРАВЛЕНИЯ ПРИМЕНЕНЫ:**

### **1. Обновлен импорт:**
- ❌ `@google/generative-ai` (старый)
- ✅ `@google/genai` (новый)

### **2. Обновлена инициализация:**
- ❌ `new GoogleGenerativeAI(apiKey)`
- ✅ `new GoogleGenAI({ apiKey })`

### **3. Обновлены вызовы API:**
- ❌ `model.generateContent([image, prompt])`
- ✅ `genAI.models.generateContent({ model, contents })`

### **4. Обновлена модель:**
- ❌ `gemini-1.5-flash` (старая)
- ✅ `gemini-2.5-flash` (новая)

## 🚀 **ЧТО ИЗМЕНИЛОСЬ:**

### **OCR обработка:**
```javascript
// Старый код
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" })
const result = await model.generateContent([image, prompt])

// Новый код
const result = await genAI.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [image, { text: prompt }]
})
```

### **AI Chat:**
```javascript
// Старый код
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
const result = await model.generateContent(prompt)

// Новый код
const result = await genAI.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt
})
```

## 📦 **ОБНОВЛЕНИЕ ЗАВИСИМОСТЕЙ:**

### **package.json:**
```json
{
  "dependencies": {
    "@google/genai": "^0.2.1"
  }
}
```

## 🔍 **ПРОВЕРКА:**

### **После деплоя логи должны показать:**
```
Starting OCR processing for photo [ID] with Gemini 2.5 Flash
OCR completed successfully
```

### **Без ошибок:**
- ❌ `models/gemini-2.5-flash-lite is not found`
- ❌ `invalid input syntax for type uuid: "undefined"`

## 🎯 **РЕЗУЛЬТАТ:**

После обновления:
- ✅ **OCR обработка** с Gemini 2.5 Flash
- ✅ **ИИ-чат** с новой моделью
- ✅ **Кнопка "Доп. файлы"** будет видна
- ✅ **UUID ошибки** исправлены

## ⏳ **СЛЕДУЮЩИЕ ШАГИ:**

1. **Дождитесь деплоя** (автоматически)
2. **Проверьте OCR** - загрузите фото
3. **Проверьте ИИ-чат** - отправьте сообщение
4. **Проверьте кнопку "Доп. файлы"** - должна быть видна

**Обновления применены! Дождитесь деплоя.** 🚀
