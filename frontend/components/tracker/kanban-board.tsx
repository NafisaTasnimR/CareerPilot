'use client'

import { useState, useEffect, useCallback } from 'react'
import { auth } from '@/lib/firebase'

const COLUMNS = [
  { id: 'Applied', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', dot: '#3b82f6' },
  { id: 'Interviewing', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.25)', dot: '#eab308' },
  { id: 'Offer', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', dot: '#22c55e' },
  { id: 'Rejected', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', dot: '#ef4444' },
]

interface App {
  id: string
  company: string
  role: string
  status: string
  notes?: string
  applied_date?: string
  redirect_url?: string
  fit_score?: number
  deadline?: string
  cover_letter?: string
  source?: string
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe()
      const token = await user?.getIdToken()
      resolve({
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      })
    })
  })
}

export default function KanbanBoard({ userId = '', api = 'http://localhost:8000' }: { userId?: string; api?: string }) {
  const baseApi = api

  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [fCompany, setFCompany] = useState('')
  const [fRole, setFRole] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [fDeadline, setFDeadline] = useState('')
  const [fUrl, setFUrl] = useState('')

  const [detailApp, setDetailApp] = useState<App | null>(null)
  const [clApp, setClApp] = useState<App | null>(null)
  const [clText, setClText] = useState('')
  const [clLoading, setClLoading] = useState(false)

  const loadApps = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${baseApi}/kanban/`, { headers })
      const data = await res.json()
      setApps(Array.isArray(data) ? data : [])
    } catch { }
    setLoading(false)
  }, [baseApi])

  useEffect(() => { loadApps() }, [loadApps])

  const addApplication = async () => {
    if (!fCompany.trim() || !fRole.trim()) return
    const headers = await getAuthHeaders()
    const res = await fetch(`${baseApi}/kanban/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        company: fCompany, role: fRole,
        notes: fNotes || null,
        deadline: fDeadline || null,
        redirect_url: fUrl || null,
        status: 'Applied', source: 'manual',
      }),
    })
    const created = await res.json()
    setApps(prev => [created, ...prev])
    setFCompany(''); setFRole(''); setFNotes(''); setFDeadline(''); setFUrl('')
    setShowForm(false)
  }

  const moveCard = async (appId: string, newStatus: string) => {
    const patch: any = { status: newStatus }
    if (newStatus === 'Applied' && !apps.find(a => a.id === appId)?.applied_date) {
      patch.applied_date = new Date().toISOString().split('T')[0]
    }
    const headers = await getAuthHeaders()
    await fetch(`${baseApi}/kanban/${appId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    })
    setApps(prev => prev.map(a => a.id === appId ? { ...a, ...patch } : a))
    if (detailApp?.id === appId) setDetailApp(prev => prev ? { ...prev, ...patch } : null)
  }

  const deleteApp = async (appId: string) => {
    const headers = await getAuthHeaders()
    await fetch(`${baseApi}/kanban/${appId}`, { method: 'DELETE', headers })
    setApps(prev => prev.filter(a => a.id !== appId))
    if (detailApp?.id === appId) setDetailApp(null)
  }

  const generateCoverLetter = async (app: App, force = false) => {
    setClApp(app)
    if (app.cover_letter && !force) {
      setClText(app.cover_letter)
      return
    }
    setClLoading(true)
    setClText('')
    try {
      const headers = await getAuthHeaders()
      // Pass Firebase UID as user_id for backend lookup
      const res = await fetch(`${baseApi}/kanban/cover-letter`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          company: app.company,
          role: app.role,
          user_id: userId,
          notes: app.notes,
        }),
      })
      const data = await res.json()
      setClText(data.cover_letter)
      setApps(prev => prev.map(a => a.id === app.id ? { ...a, cover_letter: data.cover_letter } : a))
    } catch {
      setClText('Failed to generate. Please try again.')
    }
    setClLoading(false)
  }

  const openGmailCompose = (app: App | null, coverLetter: string) => {
    if (!app) return
    const subject = encodeURIComponent(`Application for ${app.role} at ${app.company}`)
    const body = encodeURIComponent(coverLetter)
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank')
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
            <input type="date" value={fDeadline} onChange={e => setFDeadline(e.target.value)}
              style={{ background: '#111', color: 'white', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '8px 14px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={addApplication}
              style={{ padding: '8px 16px', background: 'white', color: 'black', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Add Application
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
            style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 12, padding: 12, minHeight: 200 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot }} />
              <p style={{ color: 'white', fontSize: 12, fontWeight: 600, margin: 0 }}>{col.id}</p>
              <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 11 }}>
                {apps.filter(a => a.status === col.id).length}
              </span>
            </div>

            {apps.filter(a => a.status === col.id).map(app => (
              <div
                key={app.id}
                draggable
                onDragStart={() => setDragging(app.id)}
                onDragEnd={() => setDragging(null)}
                onClick={() => setDetailApp(app)}
                style={{
                  background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10,
                  padding: 12, marginBottom: 8, cursor: 'pointer',
                  opacity: dragging === app.id ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <p style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: '0 0 4px 0' }}>{app.role}</p>
                <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>{app.company}</p>
                {app.fit_score != null && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 3, background: '#2a2a2a', borderRadius: 2 }}>
                      <div style={{ width: `${app.fit_score}%`, height: '100%', borderRadius: 2, background: app.fit_score >= 70 ? '#4ade80' : app.fit_score >= 40 ? '#facc15' : '#f87171' }} />
                    </div>
                    <span style={{ color: '#6b7280', fontSize: 10 }}>{app.fit_score}%</span>
                  </div>
                )}
                {app.deadline && (
                  <p style={{ color: '#f87171', fontSize: 10, margin: '6px 0 0 0' }}>Due {app.deadline}</p>
                )}
              </div>
            ))}

            {apps.filter(a => a.status === col.id).length === 0 && (
              <p style={{ color: '#374151', fontSize: 12, textAlign: 'center', marginTop: 24 }}>Drop here</p>
            )}
          </div>
        ))}
      </div>

      {/* DETAIL MODAL */}
      {detailApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, width: '100%', maxWidth: 480 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>{detailApp.role}</h3>
                <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>{detailApp.company}</p>
              </div>
              <button onClick={() => setDetailApp(null)}
                style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>Move to</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COLUMNS.map(col => (
                    <button key={col.id} onClick={() => moveCard(detailApp.id, col.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: detailApp.status === col.id ? col.dot : 'transparent',
                        color: detailApp.status === col.id ? 'black' : col.dot,
                        border: `1px solid ${col.dot}`,
                        opacity: detailApp.status === col.id ? 1 : 0.7,
                      }}>
                      {col.id}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detailApp.deadline && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                    <span style={{ color: '#f87171', fontSize: 12 }}>Deadline:</span>
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

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {detailApp.redirect_url && (
                  <a href={detailApp.redirect_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.15)', color: 'rgb(147,197,253)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    View job
                  </a>
                )}
                <button onClick={() => { setDetailApp(null); generateCoverLetter(detailApp) }}
                  style={{ padding: '8px 14px', background: 'rgba(168,85,247,0.15)', color: 'rgb(196,181,253)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                  Cover letter
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={() => deleteApp(detailApp.id)}
                  title="Delete application"
                  style={{ padding: '8px', background: 'transparent', color: '#6b7280', border: '1px solid transparent', borderRadius: 8, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COVER LETTER MODAL */}
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
                  Generating cover letter...
                </div>
              ) : (
                <textarea value={clText} onChange={e => setClText(e.target.value)}
                  style={{ width: '100%', minHeight: 300, background: '#111', color: '#e5e7eb', border: '1px solid #2a2a2a', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.7, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => generateCoverLetter(clApp, true)} disabled={clLoading}
                style={{ padding: '8px 14px', background: 'transparent', color: '#9ca3af', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2H3v16h5v4l4-4h5l4-4V2z" /><path d="M12 8v4M12 16h.01" /></svg>
                Regenerate
              </button>
              <button onClick={() => navigator.clipboard.writeText(clText)}
                style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.15)', color: 'rgb(147,197,253)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                Copy
              </button>
              <button onClick={() => clApp && openGmailCompose(clApp, clText)} disabled={clLoading || !clText}
                style={{ padding: '8px 16px', background: 'white', color: 'black', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.641l8.073-6.148C21.69 2.28 24 3.434 24 5.457z" /></svg>
                Open in Gmail
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}