'use client'

import { useState, useEffect } from 'react'

const USER_ID = 'test-user'

export default function NudgePanel({ userId = USER_ID, api }: { userId?: string; api: string }) {
  const [nudges, setNudges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${api}/nudges?user_id=${userId}`)
      .then(r => r.json())
      .then(data => { setNudges(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const markSeen = async (id: string) => {
    await fetch(`${api}/nudges/${id}/seen`, { method: 'PATCH' })
    setNudges(prev => prev.map(n => n.id === id ? { ...n, seen: true } : n))
  }

  const deleteNudge = async (id: string) => {
    await fetch(`${api}/nudges/${id}`, { method: 'DELETE' })
    setNudges(prev => prev.filter(n => n.id !== id))
  }

  const generateNudge = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`${api}/nudges/generate?user_id=${userId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      const created = await res.json()
      setNudges(prev => [created, ...prev])
    } catch {
      setError('Could not generate nudge. Please try again.')
    }
    setGenerating(false)
  }

  const markAllSeen = async () => {
    const unseen = nudges.filter(n => !n.seen)
    await Promise.all(unseen.map(n => fetch(`${api}/nudges/${n.id}/seen`, { method: 'PATCH' })))
    setNudges(prev => prev.map(n => ({ ...n, seen: true })))
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Just now'
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    } catch { return 'Just now' }
  }

  const unseenCount = nudges.filter(n => !n.seen).length

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Header */}
      <div style={{ background: '#1a1a1a', border: '1px solid #272727', borderRadius: '16px 16px 0 0', padding: '24px 28px', borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(249,115,22)', boxShadow: '0 0 8px rgba(249,115,22,0.6)' }} />
              <h2 style={{ color: 'white', fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>AI Nudges</h2>
              {unseenCount > 0 && (
                <span style={{ background: 'rgba(249,115,22,0.15)', color: 'rgb(249,115,22)', fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '2px 8px', border: '1px solid rgba(249,115,22,0.3)' }}>
                  {unseenCount} unread
                </span>
              )}
            </div>
            <p style={{ color: '#4b5563', fontSize: 13, margin: 0 }}>
              Personalized reminders generated from your career activity
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {unseenCount > 0 && (
              <button onClick={markAllSeen}
                style={{ padding: '7px 14px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
            <button
              onClick={generateNudge}
              disabled={generating}
              style={{
                padding: '7px 16px',
                background: generating ? '#1f1f1f' : 'white',
                color: generating ? '#4b5563' : 'black',
                border: generating ? '1px solid #2a2a2a' : 'none',
                borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: generating ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {generating ? (
                <>
                  <span style={{ display: 'inline-block', width: 12, height: 12, border: '1.5px solid #4b5563', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Generating
                </>
              ) : 'Generate nudge'}
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 20, borderTop: '1px solid #222' }}>
          {[
            { label: 'Checks activity', sub: 'Applications & goals' },
            { label: 'AI-personalized', sub: 'Based on your data' },
            { label: 'Auto — hourly', sub: 'Runs in background' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: '#e5e7eb', fontSize: 12, fontWeight: 500 }}>{item.label}</span>
              <span style={{ color: '#4b5563', fontSize: 11 }}>{item.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderTop: 'none', padding: '10px 28px' }}>
          <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Nudges */}
      <div style={{ border: '1px solid #272727', borderTop: error ? 'none' : '1px solid #272727', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>Loading...</div>
        ) : nudges.length === 0 ? (
          <div style={{ padding: '48px 28px', textAlign: 'center', background: '#161616' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#1f1f1f', border: '1px solid #2a2a2a', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 16, height: 2, background: '#374151', borderRadius: 2 }} />
            </div>
            <p style={{ color: '#6b7280', fontSize: 14, fontWeight: 500, margin: '0 0 6px 0' }}>No nudges yet</p>
            <p style={{ color: '#374151', fontSize: 12, margin: 0 }}>Generate your first nudge to get started</p>
          </div>
        ) : (
          nudges.map((nudge, index) => (
            <div
              key={nudge.id}
              style={{
                display: 'flex', gap: 16, padding: '18px 28px',
                background: nudge.seen ? '#141414' : '#1a1a1a',
                borderBottom: index < nudges.length - 1 ? '1px solid #1e1e1e' : 'none',
                borderLeft: nudge.seen ? 'none' : '2px solid rgb(249,115,22)',
                transition: 'all 0.2s',
              }}
            >
              {/* Left indicator */}
              <div style={{ paddingTop: 3, flexShrink: 0 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: nudge.seen ? '#374151' : 'rgb(249,115,22)',
                  marginTop: 2,
                }} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: nudge.seen ? '#6b7280' : '#e5e7eb',
                  fontSize: 14, lineHeight: 1.65,
                  margin: '0 0 8px 0',
                  fontStyle: nudge.seen ? 'normal' : 'normal',
                }}>
                  {nudge.message || 'No message'}
                </p>
                <span style={{ color: '#374151', fontSize: 11 }}>{formatDate(nudge.created_at)}</span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0, paddingTop: 2 }}>
                {!nudge.seen && (
                  <button onClick={() => markSeen(nudge.id)}
                    style={{ padding: '4px 10px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                    Read
                  </button>
                )}
                <button
                  onClick={() => deleteNudge(nudge.id)}
                  style={{ width: 26, height: 26, background: 'transparent', border: '1px solid #1f1f1f', borderRadius: 6, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.borderColor = '#1f1f1f' }}
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}