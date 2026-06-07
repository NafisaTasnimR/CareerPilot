'use client'

import { useEffect, useState, useCallback } from 'react'

// ── types ────────────────────────────────────────────────────────────────────

interface Nudge {
  id: string
  message: string
  event_type?: string
  context_summary?: string
  seen: boolean
  created_at: string
}

interface NudgeWidgetProps {
  userId: string
  api: string
}

// ── event-type display config ────────────────────────────────────────────────

const EVENT_META: Record<string, { label: string; emoji: string; color: string }> = {
  deadline_today:      { label: 'Due Today',       emoji: '🔥', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  deadline_soon:       { label: 'Deadline Soon',   emoji: '⏰', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  goal_overdue:        { label: 'Goal Overdue',    emoji: '⚠️', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  applications_behind: { label: 'Behind on Apps',  emoji: '📋', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  long_inactive:       { label: 'Time to Return',  emoji: '💤', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  first_application:   { label: 'Get Started',     emoji: '🚀', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  tasks_overdue:       { label: 'Tasks Overdue',   emoji: '📌', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  milestone_close:     { label: 'Almost There!',   emoji: '🏆', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  light_inactive:      { label: 'Keep Going',      emoji: '⚡', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  general_momentum:    { label: 'Daily Boost',     emoji: '✨', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
}

const DEFAULT_META = { label: 'Nudge', emoji: '💡', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' }

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── main component ───────────────────────────────────────────────────────────

export default function NudgeWidget({ userId, api }: NudgeWidgetProps) {
  const [nudge, setNudge]           = useState<Nudge | null>(null)
  const [expanded, setExpanded]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dismissed, setDismissed]   = useState(false)
  const [hasUnread, setHasUnread]   = useState(false)

  // ── fetch latest nudge on mount ──────────────────────────────────────────

  const fetchLatest = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${api}/nudges/latest?user_id=${userId}`)
      if (!res.ok) return
      const data: Nudge | null = await res.json()
      if (data) {
        setNudge(data)
        setHasUnread(!data.seen)
        setDismissed(false)
      }
    } catch (err) {
      console.error('Failed to fetch nudge:', err)
    } finally {
      setLoading(false)
    }
  }, [api, userId])

  useEffect(() => { fetchLatest() }, [fetchLatest])

  // ── on-demand refresh (calls /generate with force) ───────────────────────

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch(
        `${api}/nudges/generate?user_id=${userId}`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error('generate failed')
      const data: Nudge = await res.json()
      setNudge(data)
      setHasUnread(true)
      setDismissed(false)
      setExpanded(true)
    } catch (err) {
      console.error('Refresh nudge failed:', err)
    } finally {
      setRefreshing(false)
    }
  }

  // ── mark seen when expanded ──────────────────────────────────────────────

  const handleExpand = async () => {
    setExpanded(prev => !prev)
    if (!expanded && nudge && !nudge.seen) {
      setHasUnread(false)
      try {
        await fetch(`${api}/nudges/${nudge.id}/seen`, { method: 'PATCH' })
      } catch (_) {}
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    setExpanded(false)
  }

  // ── render ───────────────────────────────────────────────────────────────

  if (dismissed || loading) {
    return (
      <button
        onClick={() => { setDismissed(false); fetchLatest() }}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500
                   flex items-center justify-center shadow-lg transition-all z-50"
        title="Show AI nudge"
      >
        <span className="text-xl">💡</span>
        {hasUnread && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900" />
        )}
      </button>
    )
  }

  const meta = nudge?.event_type ? (EVENT_META[nudge.event_type] ?? DEFAULT_META) : DEFAULT_META

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">

      {/* ── expanded card ── */}
      {expanded && nudge && (
        <div className="w-80 rounded-2xl border border-gray-700 bg-gray-900/95 backdrop-blur-sm
                        shadow-2xl shadow-black/40 overflow-hidden animate-in slide-in-from-bottom-4">

          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-base">{meta.emoji}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${meta.color}`}>
                {meta.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{timeAgo(nudge.created_at)}</span>
              <button
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
                title="Dismiss"
              >✕</button>
            </div>
          </div>

          {/* message */}
          <div className="px-4 py-4">
            <p className="text-sm text-gray-100 leading-relaxed">{nudge.message}</p>
          </div>

          {/* context reason pill */}
          {nudge.context_summary && (
            <div className="px-4 pb-3">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <span>📊</span>
                <span>{nudge.context_summary}</span>
              </p>
            </div>
          )}

          {/* footer actions */}
          <div className="px-4 pb-4 flex items-center justify-between gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300
                         transition-colors disabled:opacity-50"
            >
              <span className={refreshing ? 'animate-spin' : ''}>↻</span>
              {refreshing ? 'Generating…' : 'New nudge'}
            </button>

            <button
              onClick={handleDismiss}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── floating trigger button ── */}
      <button
        onClick={handleExpand}
        className={`relative w-14 h-14 rounded-full shadow-lg transition-all duration-200
                    flex items-center justify-center
                    ${expanded
                      ? 'bg-indigo-500 scale-95'
                      : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105'
                    }`}
        title={expanded ? 'Close nudge' : 'Open AI nudge'}
      >
        <span className="text-2xl">{expanded ? '✕' : meta.emoji}</span>

        {/* unread badge */}
        {hasUnread && !expanded && (
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full
                           border-2 border-gray-900 animate-pulse" />
        )}
      </button>
    </div>
  )
}