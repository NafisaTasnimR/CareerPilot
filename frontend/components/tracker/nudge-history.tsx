'use client'

import { useEffect, useState } from 'react'

interface Nudge {
  id: string
  message: string
  event_type?: string
  context_summary?: string
  seen: boolean
  created_at: string
}

interface NudgeHistoryProps {
  userId: string
  api: string
}

const EVENT_META: Record<string, { label: string; emoji: string }> = {
  deadline_today:      { label: 'Due Today',      emoji: '🔥' },
  deadline_soon:       { label: 'Deadline Soon',  emoji: '⏰' },
  goal_overdue:        { label: 'Goal Overdue',   emoji: '⚠️' },
  applications_behind: { label: 'Behind on Apps', emoji: '📋' },
  long_inactive:       { label: 'Time to Return', emoji: '💤' },
  first_application:   { label: 'Get Started',    emoji: '🚀' },
  tasks_overdue:       { label: 'Tasks Overdue',  emoji: '📌' },
  milestone_close:     { label: 'Almost There!',  emoji: '🏆' },
  light_inactive:      { label: 'Keep Going',     emoji: '⚡' },
  general_momentum:    { label: 'Daily Boost',    emoji: '✨' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function NudgeHistory({ userId, api }: NudgeHistoryProps) {
  const [nudges, setNudges]   = useState<Nudge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${api}/nudges/?user_id=${userId}&limit=10`)
      .then(r => r.json())
      .then((data: Nudge[]) => setNudges(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [api, userId])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <p className="text-sm text-gray-500 animate-pulse">Loading nudge history…</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <span>💡</span> AI Nudge History
      </h3>

      {nudges.length === 0 ? (
        <p className="text-sm text-gray-500">No nudges yet. Check back soon!</p>
      ) : (
        <div className="flex flex-col gap-3">
          {nudges.map(n => {
            const meta = n.event_type ? (EVENT_META[n.event_type] ?? { label: 'Nudge', emoji: '💡' }) : { label: 'Nudge', emoji: '💡' }
            return (
              <div
                key={n.id}
                className={`rounded-lg p-4 border transition-all
                  ${n.seen
                    ? 'border-gray-800 bg-gray-800/30'
                    : 'border-indigo-500/30 bg-indigo-500/5'
                  }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{meta.emoji}</span>
                    <span className="text-xs font-medium text-gray-400">{meta.label}</span>
                    {!n.seen && (
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full">
                        New
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 shrink-0">{formatDate(n.created_at)}</span>
                </div>

                <p className="text-sm text-gray-200 leading-relaxed">{n.message}</p>

                {n.context_summary && (
                  <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                    <span>📊</span>{n.context_summary}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}