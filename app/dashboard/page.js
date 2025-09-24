"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"

export default function DashboardPage() {
  const [cases, setCases] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadCases() {
      try {
        setIsLoading(true)
        const res = await fetch("/api/optimized/cases", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load cases")
        const data = await res.json()
        if (isMounted) setCases(Array.isArray(data) ? data : [])
      } catch (err) {
        if (isMounted) setError(err.message)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadCases()
    return () => {
      isMounted = false
    }
  }, [])

  const stats = useMemo(() => {
    const totalActive = cases.filter(c => c.status !== "archived" && c.status !== "completed").length
    const inReview = cases.filter(c => c.status === "paused").length
    const completed = cases.filter(c => c.status === "completed").length
    const urgent = cases.filter(c => (c.priority || "").toLowerCase() === "urgent").length
    return { totalActive, inReview, completed, urgent }
  }, [cases])

  const recentCases = useMemo(() => {
    return [...cases]
      .sort((a, b) => new Date(b.created_at).valueOf() - new Date(a.created_at).valueOf())
      .slice(0, 6)
  }, [cases])

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Дашборд</h1>
          <p className="text-sm text-muted-foreground">Обзор вашей юридической практики</p>
        </div>
        <Link href="/" className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-white text-sm font-medium hover:opacity-90">
          На главную
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Активные дела" value={isLoading ? "…" : stats.totalActive} subtitle={""} icon={"📈"} />
        <StatCard title="На рассмотрении" value={isLoading ? "…" : stats.inReview} subtitle={"в очереди"} icon={"⏳"} />
        <StatCard title="Завершенные" value={isLoading ? "…" : stats.completed} subtitle={"за все время"} icon={"✅"} />
        <StatCard title="Срочные" value={isLoading ? "…" : stats.urgent} subtitle={"требуют внимания"} icon={"⚠️"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent cases */}
        <div className="col-span-1 lg:col-span-2">
          <Section title="Последние дела">
            {error && (
              <div className="text-sm text-red-600">Ошибка загрузки: {error}</div>
            )}
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Загрузка…</div>
            ) : recentCases.length === 0 ? (
              <div className="text-sm text-muted-foreground">Дел пока нет</div>
            ) : (
              <ul className="space-y-3">
                {recentCases.map(item => (
                  <li key={item.id} className="rounded-lg border p-4 bg-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{item.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.client_name} · {new Date(item.created_at).toLocaleDateString("ru-RU")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={priorityTone(item.priority)}>{(item.priority || "medium").toUpperCase()}</Badge>
                        <Badge>{(item.status || "active").toUpperCase()}</Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Upcoming events placeholder */}
        <div className="col-span-1">
          <Section title="Ближайшие события">
            <ul className="space-y-3">
              {placeholderEvents.map((ev) => (
                <li key={ev.id} className="rounded-lg border p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{ev.title}</div>
                      <div className="text-sm text-muted-foreground">{ev.subtitle}</div>
                    </div>
                    <div className="text-sm text-gray-600">{ev.date}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      {/* Minimal calendar placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2">
          <Section title="Календарь (минимальный)">
            <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">
              Календарь будет добавлен позже. Здесь появятся заседания, встречи и сроки.
            </div>
          </Section>
        </div>
        <div className="col-span-1">
          <Section title="Заметки">
            <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">
              Добавьте заметки или напоминания по делам.
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
        <span className="text-lg" role="img" aria-label="icon">{icon}</span>
        {title}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {subtitle ? <div className="text-xs text-muted-foreground mt-1">{subtitle}</div> : null}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Badge({ children, tone }) {
  const base = "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
  const map = {
    gray: "bg-gray-100 text-gray-700 border border-gray-200",
    red: "bg-red-100 text-red-700 border border-red-200",
    yellow: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    green: "bg-green-100 text-green-700 border border-green-200",
    blue: "bg-blue-100 text-blue-700 border border-blue-200"
  }
  return <span className={`${base} ${map[tone || "gray"]}`}>{children}</span>
}

function priorityTone(priority) {
  const p = (priority || "medium").toLowerCase()
  if (p === "urgent") return "red"
  if (p === "high") return "yellow"
  if (p === "medium") return "blue"
  return "gray"
}

const placeholderEvents = [
  { id: "1", title: "Судебное заседание", subtitle: "Дело №0001", date: "15 янв, 10:00" },
  { id: "2", title: "Встреча с клиентом", subtitle: "Консультация", date: "16 янв, 14:30" },
  { id: "3", title: "Подача документов", subtitle: "Дело №0002", date: "18 янв, 09:00" },
]
