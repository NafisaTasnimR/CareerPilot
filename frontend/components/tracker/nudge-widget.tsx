'use client'

import { useEffect, useState, useCallback } from 'react'
import { auth } from '@/lib/firebase'

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
  api?: string
}

// ── auth helper ───────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe()
      const token = await user?.getIdToken()
      resolve({
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      })
    })
  })
}

// ── event-type display config ─────────────────────────────────────────────────

const EVENT_META: Record<string, { label: string; accent: string }> = {
  deadline_today:      { label: 'Due Today',       accent: '#e07575' },
  deadline_soon:       { label: 'Deadline Soon',   accent: '#e09a5a' },
  goal_overdue:        { label: 'Goal Overdue',    accent: '#d4a853' },
  applications_behind: { label: 'Behind on Apps',  accent: '#6eb5f5' },
  long_inactive:       { label: 'Time to Return',  accent: '#a78bfa' },
  first_application:   { label: 'Get Started',     accent: '#4dd6a0' },
  tasks_overdue:       { label: 'Tasks Overdue',   accent: '#e09a5a' },
  milestone_close:     { label: 'Almost There!',   accent: '#d4a853' },
  light_inactive:      { label: 'Keep Going',      accent: '#6eb5f5' },
  general_momentum:    { label: 'Daily Boost',     accent: '#d4a853' },
}
const DEFAULT_META = { label: 'AI Nudge', accent: '#d4a853' }

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function SparkIcon({ size = 20, color = '#d4a853' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z"
        fill={color}
        opacity="0.95"
      />
      <path
        d="M19 16L19.9 18.1L22 19L19.9 19.9L19 22L18.1 19.9L16 19L18.1 18.1L19 16Z"
        fill={color}
        opacity="0.6"
      />
      <path
        d="M5 3L5.7 4.8L7.5 5.5L5.7 6.2L5 8L4.3 6.2L2.5 5.5L4.3 4.8L5 3Z"
        fill={color}
        opacity="0.45"
      />
    </svg>
  )
}

function CloseIcon({ size = 14, color = '#888' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function RefreshIcon({ size = 13, color = '#d4a853', spinning = false }: { size?: number; color?: string; spinning?: boolean }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display:'inline-block', animation: spinning ? 'spin 0.8s linear infinite' : 'none' }}
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function NudgeWidget({ api = 'http://localhost:8000' }: NudgeWidgetProps) {
  const [nudge, setNudge]           = useState<Nudge | null>(null)
  const [expanded, setExpanded]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dismissed, setDismissed]   = useState(false)
  const [hasUnread, setHasUnread]   = useState(false)
  const [authed, setAuthed]         = useState(false)
  const [hovered, setHovered]       = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setAuthed(!!user)
      if (!user) setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const generateNudge = useCallback(async (): Promise<Nudge | null> => {
    const headers = await getAuthHeaders()
    const res = await fetch(`${api}/nudges/generate`, { method: 'POST', headers })
    if (!res.ok) throw new Error(`generate failed: ${res.status}`)
    return res.json()
  }, [api])

  const fetchLatest = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${api}/nudges/latest`, { headers })
      if (!res.ok) return
      const data: Nudge | null = await res.json()
      if (data) {
        setNudge(data)
        setHasUnread(!data.seen)
        setDismissed(false)
      } else {
        const generated = await generateNudge()
        if (generated) {
          setNudge(generated)
          setHasUnread(true)
          setDismissed(false)
        }
      }
    } catch (err) {
      console.error('Failed to fetch/generate nudge:', err)
    } finally {
      setLoading(false)
    }
  }, [api, generateNudge])

  useEffect(() => {
    if (authed) fetchLatest()
  }, [authed, fetchLatest])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await generateNudge()
      if (data) {
        setNudge(data)
        setHasUnread(true)
        setDismissed(false)
        setExpanded(true)
      }
    } catch (err) {
      console.error('Refresh nudge failed:', err)
    } finally {
      setRefreshing(false)
    }
  }

  const handleExpand = async () => {
    setExpanded(prev => !prev)
    if (!expanded && nudge && !nudge.seen) {
      setHasUnread(false)
      try {
        const headers = await getAuthHeaders()
        await fetch(`${api}/nudges/${nudge.id}/seen`, { method: 'PATCH', headers })
      } catch (_) {}
    }
  }

  const handleDismiss = () => { setDismissed(true); setExpanded(false) }

  if (!authed) return null

  const meta = nudge?.event_type ? (EVENT_META[nudge.event_type] ?? DEFAULT_META) : DEFAULT_META
  const accent = meta.accent

  // ── collapsed / loading FAB ────────────────────────────────────────────────
  if (dismissed || loading) {
    return (
      <>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <button
          onClick={() => { setDismissed(false); fetchLatest() }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title={loading ? 'Preparing your nudge…' : 'Open AI nudge'}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 50,
            width: 52, height: 52, borderRadius: '50%',
            border: `1.5px solid ${hovered ? '#d4a853bb' : '#d4a85370'}`,
            background: hovered
              ? 'linear-gradient(135deg,#221e10,#2e2614)'
              : 'linear-gradient(135deg,#1a1608,#22190a)',
            boxShadow: hovered
              ? `0 0 0 4px #d4a85322, 0 0 28px #d4a85340, 0 8px 32px #00000099`
              : `0 0 0 3px #d4a85318, 0 0 18px #d4a85328, 0 4px 20px #000000aa`,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'all .22s ease',
            transform: hovered ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          {loading
            ? <RefreshIcon size={16} color="#d4a853" spinning />
            : <SparkIcon size={20} color="#d4a853" />
          }
          {hasUnread && !loading && (
            <span style={{
              position: 'absolute', top: 1, right: 1, width: 11, height: 11,
              borderRadius: '50%', background: '#e07575',
              border: '2px solid #1a1608', boxShadow: '0 0 0 1px #e0757560, 0 0 10px #e07575aa',
              animation: 'nudgePulse 2s ease-in-out infinite',
            }} />
          )}
        </button>
      </>
    )
  }

  // ── full widget ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Cormorant+Garamond:wght@300;400&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes nudgePulse{0%,100%{box-shadow:0 0 0 1px #e0757560,0 0 10px #e07575aa}50%{box-shadow:0 0 0 3px #e0757530,0 0 18px #e07575cc}}
      `}</style>

      <div style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 50,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
        fontFamily: '"DM Mono", monospace',
      }}>

        {/* ── expanded card ── */}
        {expanded && nudge && (
          <div style={{
            width: 300,
            background: 'linear-gradient(160deg,#141109,#0f0e0c)',
            border: `1px solid #2e2a1e`,
            borderRadius: 12,
            boxShadow: `0 0 0 1px #d4a85320, 0 8px 40px #00000099, 0 0 30px #d4a85310`,
            overflow: 'hidden',
            animation: 'slideUp .22s ease',
          }}>

            {/* header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid #2a2520',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SparkIcon size={14} color={accent} />
                <span style={{
                  fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
                  color: accent, fontWeight: 500,
                }}>{meta.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 9, letterSpacing: '.06em', color: '#555' }}>
                  {timeAgo(nudge.created_at)}
                </span>
                <button onClick={handleDismiss} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 2, display: 'flex', alignItems: 'center',
                }}>
                  <CloseIcon size={13} color="#555" />
                </button>
              </div>
            </div>

            {/* message */}
            <div style={{ padding: '16px 16px 12px' }}>
              <p style={{
                margin: 0, fontSize: 12.5, lineHeight: 1.65,
                color: '#ddd', letterSpacing: '.01em',
                fontFamily: '"Cormorant Garamond", serif',
                fontWeight: 400,
              }}>{nudge.message}</p>
            </div>

            {/* context pill */}
            {nudge.context_summary && (
              <div style={{ padding: '0 16px 12px' }}>
                <span style={{
                  fontSize: 9, letterSpacing: '.1em', color: '#665e48',
                  textTransform: 'uppercase',
                }}>
                  ∿ {nudge.context_summary}
                </span>
              </div>
            )}

            {/* divider */}
            <div style={{ height: 1, background: '#1e1c17', margin: '0 0 0 0' }} />

            {/* footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
            }}>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  background: 'none', border: 'none', cursor: refreshing ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase',
                  color: refreshing ? '#554e38' : accent,
                  opacity: refreshing ? 0.6 : 1, padding: 0, transition: 'color .15s',
                }}
              >
                <RefreshIcon size={11} color={refreshing ? '#554e38' : accent} spinning={refreshing} />
                {refreshing ? 'Generating…' : 'New nudge'}
              </button>

              <button onClick={handleDismiss} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase',
                color: '#443e30', padding: 0, transition: 'color .15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = '#443e30')}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── FAB trigger ── */}
        <button
          onClick={handleExpand}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title={expanded ? 'Close' : 'Open AI nudge'}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            border: expanded
              ? `1.5px solid ${accent}99`
              : `1.5px solid ${hovered ? accent + 'bb' : accent + '70'}`,
            background: expanded
              ? `linear-gradient(135deg,#2a2218,#1e1a0e)`
              : hovered
                ? 'linear-gradient(135deg,#221e10,#2e2614)'
                : 'linear-gradient(135deg,#1a1608,#22190a)',
            boxShadow: expanded
              ? `0 0 0 4px ${accent}22, 0 0 32px ${accent}50, 0 8px 32px #000000bb`
              : hovered
                ? `0 0 0 4px ${accent}22, 0 0 28px ${accent}40, 0 8px 32px #00000099`
                : `0 0 0 3px ${accent}18, 0 0 18px ${accent}28, 0 4px 20px #000000aa`,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'all .22s ease',
            transform: hovered && !expanded ? 'scale(1.08)' : expanded ? 'scale(0.96)' : 'scale(1)',
            position: 'relative',
          }}
        >
          {expanded
            ? <CloseIcon size={15} color={accent} />
            : <SparkIcon size={20} color={accent} />
          }
          {hasUnread && !expanded && (
            <span style={{
              position: 'absolute', top: 1, right: 1, width: 11, height: 11,
              borderRadius: '50%', background: '#e07575',
              border: '2px solid #1a1608', boxShadow: '0 0 0 1px #e0757560, 0 0 10px #e07575aa',
              animation: 'nudgePulse 2s ease-in-out infinite',
            }} />
          )}
        </button>
      </div>
    </>
  )
}