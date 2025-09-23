import './globals.css'
import { Toaster } from "@/components/ui/sonner"

export const metadata = {
  title: 'Адвокатская Практика - Управление Делами',
  description: 'Система управления адвокатской практикой с OCR и ИИ-ассистентом',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen bg-gray-50 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}