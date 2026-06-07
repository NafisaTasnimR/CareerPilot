'use client'

import { useState, useEffect } from 'react'
import { getAuthHeaders } from '@/lib/backend'

const USER_ID = 'test-user-123'
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const COLUMNS = [
  { id: 'Applied',      bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)',  dot: '#3b82f6'  },
  { id: 'Interviewing', bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.25)',   dot: '#eab308'  },
  { id: 'Offer',        bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   dot: '#22c55e'  },
  { id: 'Rejected',     bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   dot: '#ef4444'  },
]

export default function KanbanBoard({ api }: { api: string }) {
  const [apps, setApps] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)

  // Add form
  const [showForm, setShowForm] = useState(false)
  const [fCompany, setFCompany]   = useState('')
  const [fRole, setFRole]         = useState('')
  const [fNotes, setFNotes]       = useState('')
  const [fDeadline, setFDeadline] = useState('')
  const [fUrl, setFUrl]           = useState('')

  // Detail modal
  const [detailApp, setDetailApp] = useState<App | null>(null)

  // Cover letter modal
  const [clApp, setClApp]         = useState<App | null>(null)
  const [clText, setClText]       = useState('')
  const [clLoading, setClLoading] = useState(false)

  useEffect(() => {
    const loadApplications = async () => {
      try {
        const authHeaders = await getAuthHeaders()
        const res = await fetch(`${api}/kanban/`, { headers: authHeaders })

        // Handle HTTP errors
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.detail || `HTTP ${res.status}`)
        }

        const data = await res.json()

        // Ensure data is an array before setting state
        if (Array.isArray(data)) {
          setApps(data)
        } else {
          console.error('Expected array from /kanban, got:', data)
          setApps([])
        }
      } catch (error) {
        console.error('Failed to load applications:', error)
        setApps([]) // fallback to empty array
      } finally {
        setLoading(false)
      }
    }
    loadApplications()
  }, [api])
  const addApplication = async () => {
    if (!company.trim() || !role.trim()) return
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`${api}/kanban/`, {
        method: 'POST',
        headers: { ...authHeaders },
        body: JSON.stringify({ company, role, status: 'Applied' }),
      })
      const created = await res.json()
      setApps(prev => [...prev, created])
      setCompany(''); setRole(''); setShowForm(false)
    } catch (error) {
      console.error('Failed to add application:', error)
    }
  }

  const moveCard = async (appId: string, newStatus: string) => {
    try {
      const authHeaders = await getAuthHeaders()
      await fetch(`${api}/kanban/${appId}`, {
        method: 'PATCH',
        headers: { ...authHeaders },
        body: JSON.stringify({ status: newStatus }),
      })
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a))
    } catch (error) {
      console.error('Failed to update application:', error)
    }
  }

  const deleteApp = async (appId: string) => {
    try {
      const authHeaders = await getAuthHeaders()
      await fetch(`${api}/kanban/${appId}`, {
        method: 'DELETE',
        headers: { ...authHeaders },
      })
      setApps(prev => prev.filter(a => a.id !== appId))
    } catch (error) {
      console.error('Failed to delete application:', error)
    }
  }

  if (loading) return <p style={{ color: '#6b7280', padding: 16 }}>Loading applications...</p>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
          {apps.length} total · {apps.filter(a => a.source !== 'manual').length} from Job Hunter · {apps.filter(a => a.source === 'manual').length} manual
        </p>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ padding: '8px 16px', background: 'white', color: 'black', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + Add manually
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ marginBottom: 20, padding: 16, background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 12 }}>
          <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 0' }}>New Application</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input value={fCompany} onChange={e => setFCompany(e.target.value)} placeholder="Company name *"
              style={{ background: '#111', color: 'white', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
            <input value={fRole} onChange={e => setFRole(e.target.value)} placeholder="Role / position *"
              style={{ background: '#111', color: 'white', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
            <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Notes (optional)"
              style={{ background: '#111', color: 'white', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
            <input value={fUrl} onChange={e => setFUrl(e.target.value)} placeholder="Job URL (optional)"
              style={{ background: '#111', color: 'white', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>Application deadline:</label>
            <input type="date" value={fDeadline} onChange={e => setFDeadline(e.target.value)}
              style={{ background: '#111', color: 'white', border: '1px solid #333', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', colorScheme: 'dark' }} />
            <div style={{ flex: 1 }} />
            <button onClick={addApplication}
              style={{ padding: '8px 18px', background: 'rgba(34,197,94,0.2)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              Save
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '8px 14px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {COLUMNS.map(col => (
          <div
            key={col.id}
            onDragOver={e => e.preventDefault()}
            onDrop={() => dragging && moveCard(dragging, col.id)}
            style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 14, padding: 12, minHeight: 200 }}
          >
            {/* Column header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: col.dot }} />
                <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{col.id}</span>
              </div>
              <span style={{ background: '#1a1a1a', color: '#6b7280', fontSize: 11, borderRadius: 999, padding: '1px 7px' }}>
                {apps.filter(a => a.status === col.id).length}
              </span>
            </div>

            {/* Cards */}
            {apps.filter(a => a.status === col.id).map(app => (
              <div
                key={app.id}
                draggable
                onDragStart={() => setDragging(app.id)}
                onDragEnd={() => setDragging(null)}
                onClick={() => setDetailApp(app)}
                style={{ background: '#161616', border: '1px solid #252525', borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#252525')}
              >
                {app.source !== 'manual' && (
                  <div style={{ display: 'inline-block', background: 'rgba(249,115,22,0.1)', color: 'rgb(249,115,22)', fontSize: 10, borderRadius: 4, padding: '1px 6px', marginBottom: 6, border: '1px solid rgba(249,115,22,0.2)' }}>
                    Job Hunter
                  </div>
                )}
                <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{app.role}</div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>{app.company}</div>

                {app.fit_score != null && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 3, background: '#2a2a2a', borderRadius: 2 }}>
                      <div style={{ width: `${app.fit_score}%`, height: '100%', borderRadius: 2, background: app.fit_score >= 70 ? '#4ade80' : app.fit_score >= 40 ? '#facc15' : '#f87171' }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#6b7280' }}>{app.fit_score}%</span>
                  </div>
                )}

                {app.deadline && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#f87171' }}>⏰ {app.deadline}</div>
                )}

                <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                  <button
                    onClick={e => { e.stopPropagation(); generateCoverLetter(app) }}
                    style={{ fontSize: 10, padding: '3px 7px', background: 'rgba(168,85,247,0.15)', color: 'rgb(196,181,253)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 5, cursor: 'pointer' }}
                  >
                    ✦ Cover letter
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteApp(app.id) }}
                    style={{ fontSize: 10, padding: '3px 7px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {apps.filter(a => a.status === col.id).length === 0 && (
              <p style={{ color: '#374151', fontSize: 12, textAlign: 'center', marginTop: 24 }}>Drop here</p>
            )}
          </div>
        ))}
      </div>

      {/* ── DETAIL MODAL ── */}
      {detailApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, width: '100%', maxWidth: 480 }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>{detailApp.role}</h3>
                <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>{detailApp.company}</p>
              </div>
              <button onClick={() => setDetailApp(null)}
                style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Status */}
              <div>
                <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>Move to</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COLUMNS.map(col => (
                    <button
                      key={col.id}
                      onClick={() => moveCard(detailApp.id, col.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: detailApp.status === col.id ? col.dot : 'transparent',
                        color: detailApp.status === col.id ? 'black' : col.dot,
                        border: `1px solid ${col.dot}`,
                        opacity: detailApp.status === col.id ? 1 : 0.7,
                      }}
                    >
                      {col.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detailApp.deadline && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                    <span style={{ color: '#f87171', fontSize: 12 }}>⏰ Deadline:</span>
                    <span style={{ color: 'white', fontSize: 12 }}>{detailApp.deadline}</span>
                  </div>
                )}
                {detailApp.applied_date && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: '#1f1f1f', borderRadius: 8 }}>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>Applied:</span>
                    <span style={{ color: 'white', fontSize: 12 }}>{detailApp.applied_date}</span>
                  </div>
                )}
                {detailApp.fit_score != null && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: '#1f1f1f', borderRadius: 8 }}>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>Fit score:</span>
                    <div style={{ flex: 1, height: 4, background: '#2a2a2a', borderRadius: 2 }}>
                      <div style={{ width: `${detailApp.fit_score}%`, height: '100%', borderRadius: 2, background: detailApp.fit_score >= 70 ? '#4ade80' : detailApp.fit_score >= 40 ? '#facc15' : '#f87171' }} />
                    </div>
                    <span style={{ color: 'white', fontSize: 12 }}>{detailApp.fit_score}%</span>
                  </div>
                )}
                {detailApp.notes && (
                  <div style={{ padding: '8px 12px', background: '#1f1f1f', borderRadius: 8 }}>
                    <span style={{ color: '#6b7280', fontSize: 11, display: 'block', marginBottom: 4 }}>Notes</span>
                    <p style={{ color: '#e5e7eb', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{detailApp.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detailApp.redirect_url && (
                  <a href={detailApp.redirect_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.15)', color: 'rgb(147,197,253)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 12, textDecoration: 'none' }}>
                    ↗ View job
                  </a>
                )}
                <button
                  onClick={() => { setDetailApp(null); generateCoverLetter(detailApp) }}
                  style={{ padding: '8px 14px', background: 'rgba(168,85,247,0.15)', color: 'rgb(196,181,253)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                  ✦ Cover letter
                </button>
                <button
                  onClick={() => deleteApp(detailApp.id)}
                  style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COVER LETTER MODAL ── */}
      {clApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: 'white', fontSize: 16, fontWeight: 600, margin: 0 }}>Cover Letter</h3>
                <p style={{ color: '#6b7280', fontSize: 12, margin: '4px 0 0 0' }}>{clApp.role} at {clApp.company}</p>
              </div>
              <button onClick={() => setClApp(null)}
                style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {clLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 13 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #4b5563', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Generating personalized cover letter...
                </div>
              ) : (
                <textarea
                  value={clText}
                  onChange={e => setClText(e.target.value)}
                  style={{ width: '100%', minHeight: 300, background: '#111', color: '#e5e7eb', border: '1px solid #2a2a2a', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.7, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
             <button
  onClick={() => generateCoverLetter(clApp, true)}
  disabled={clLoading}
  style={{ padding: '8px 14px', background: 'transparent', color: '#9ca3af', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
  ↻ Regenerate
</button>
              <button
                onClick={() => navigator.clipboard.writeText(clText)}
                style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.15)', color: 'rgb(147,197,253)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                Copy
              </button>
              <button
                onClick={() => openGmailCompose(clApp, clText)}
                disabled={clLoading || !clText}
                style={{ padding: '8px 16px', background: 'white', color: 'black', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                ✉ Open in Gmail →
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}