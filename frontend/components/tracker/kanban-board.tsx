'use client'

import { useState, useEffect } from 'react'

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
  created_at?: string
}

interface EmailModalData {
  app: App
  coverLetter: string
}

export default function KanbanBoard({ userId, api }: { userId: string; api: string }) {
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)

  // Manual add form
  const [showForm, setShowForm] = useState(false)
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [notes, setNotes] = useState('')
  const [deadline, setDeadline] = useState('')

  // Cover letter modal
  const [coverLetterApp, setCoverLetterApp] = useState<App | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [generatingCL, setGeneratingCL] = useState(false)

  // Email modal
  const [emailData, setEmailData] = useState<EmailModalData | null>(null)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [hrEmail, setHrEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${api}/kanban?user_id=${userId}`)
      .then(r => r.json())
      .then(data => { setApps(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const addApplication = async () => {
    if (!company.trim() || !role.trim()) return
    const res = await fetch(`${api}/kanban?user_id=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, role, notes, deadline: deadline || null, status: 'Applied', source: 'manual' }),
    })
    const created = await res.json()
    setApps(prev => [created, ...prev])
    setCompany(''); setRole(''); setNotes(''); setDeadline(''); setShowForm(false)
  }

  const moveCard = async (appId: string, newStatus: string) => {
    const updateData: any = { status: newStatus }
    if (newStatus === 'Applied') {
      updateData.applied_date = new Date().toISOString().split('T')[0]
    }
    await fetch(`${api}/kanban/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    })
    setApps(prev => prev.map(a => a.id === appId ? { ...a, ...updateData } : a))
  }

  const deleteApp = async (appId: string) => {
    await fetch(`${api}/kanban/${appId}`, { method: 'DELETE' })
    setApps(prev => prev.filter(a => a.id !== appId))
  }

  const generateCoverLetter = async (app: App) => {
    setCoverLetterApp(app)
    setCoverLetter(app.cover_letter || '')
    if (app.cover_letter) return // already generated
    setGeneratingCL(true)
    try {
      const res = await fetch(`${api}/kanban/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: app.company, role: app.role, user_id: userId, notes: app.notes }),
      })
      const data = await res.json()
      setCoverLetter(data.cover_letter)
      setApps(prev => prev.map(a => a.id === app.id ? { ...a, cover_letter: data.cover_letter } : a))
    } catch { setCoverLetter('Failed to generate. Please try again.') }
    setGeneratingCL(false)
  }

  const openEmailModal = (app: App, cl: string) => {
    setEmailData({ app, coverLetter: cl })
    setCoverLetterApp(null)
  }

  const sendEmail = async () => {
    if (!emailData || !userEmail || !userPassword || !hrEmail || !userName) return
    setSending(true)
    setEmailStatus(null)
    try {
      const res = await fetch(`${api}/kanban/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: emailData.app.id,
          user_id: userId,
          user_name: userName,
          user_email: userEmail,
          user_password: userPassword,
          hr_email: hrEmail,
          cover_letter: emailData.coverLetter,
          company: emailData.app.company,
          role: emailData.app.role,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setEmailStatus('✓ Email sent successfully!')
      setApps(prev => prev.map(a => a.id === emailData.app.id ? { ...a, status: 'Applied', applied_date: new Date().toISOString().split('T')[0] } : a))
      setTimeout(() => { setEmailData(null); setEmailStatus(null) }, 2000)
    } catch (e: any) {
      setEmailStatus(`✕ ${e.message}`)
    }
    setSending(false)
  }

  if (loading) return <p style={{ color: '#6b7280', padding: 16 }}>Loading applications...</p>

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
            {apps.length} total · {apps.filter(a => a.source !== 'manual').length} from Job Hunter · {apps.filter(a => a.source === 'manual').length} manual
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ padding: '8px 16px', background: 'white', color: 'black', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + Add manually
        </button>
      </div>

      {/* Manual add form */}
      {showForm && (
        <div style={{ marginBottom: 20, padding: 16, background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name"
            style={{ flex: 1, minWidth: 140, background: '#111', color: 'white', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          <input value={role} onChange={e => setRole(e.target.value)} placeholder="Role / position"
            style={{ flex: 1, minWidth: 140, background: '#111', color: 'white', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
            style={{ flex: 2, minWidth: 180, background: '#111', color: 'white', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
            style={{ background: '#111', color: 'white', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', colorScheme: 'dark' }} />
          <button onClick={addApplication}
            style={{ padding: '8px 16px', background: 'rgba(34,197,94,0.2)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Save
          </button>
          <button onClick={() => setShowForm(false)}
            style={{ padding: '8px 16px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
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
                style={{ background: '#161616', border: '1px solid #252525', borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'grab' }}
              >
                {/* Source badge */}
                {app.source !== 'manual' && (
                  <div style={{ display: 'inline-block', background: 'rgba(249,115,22,0.1)', color: 'rgb(249,115,22)', fontSize: 10, borderRadius: 4, padding: '1px 6px', marginBottom: 6, border: '1px solid rgba(249,115,22,0.2)' }}>
                    From Job Hunter
                  </div>
                )}

                <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{app.role}</div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>{app.company}</div>

                {/* Fit score */}
                {app.fit_score && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ flex: 1, height: 3, background: '#2a2a2a', borderRadius: 2 }}>
                      <div style={{ width: `${app.fit_score}%`, height: '100%', borderRadius: 2, background: app.fit_score >= 70 ? '#4ade80' : app.fit_score >= 40 ? '#facc15' : '#f87171' }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#6b7280' }}>{app.fit_score}%</span>
                  </div>
                )}

                {/* Deadline */}
                {app.deadline && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#f87171' }}>⏰ {app.deadline}</div>
                )}

                {/* Applied date */}
                {app.applied_date && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>Applied: {app.applied_date}</div>
                )}

                {/* Action buttons */}
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {/* Cover letter */}
                  <button
                    onClick={() => generateCoverLetter(app)}
                    style={{ fontSize: 10, padding: '3px 7px', background: 'rgba(168,85,247,0.15)', color: 'rgb(196,181,253)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 5, cursor: 'pointer' }}
                  >
                    ✦ Cover letter
                  </button>

                  {/* Job link */}
                  {app.redirect_url && (
                    <a href={app.redirect_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, padding: '3px 7px', background: 'rgba(59,130,246,0.15)', color: 'rgb(147,197,253)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 5, textDecoration: 'none' }}>
                      ↗ View job
                    </a>
                  )}

                  {/* Move buttons */}
                  {COLUMNS.filter(c => c.id !== col.id).map(c => (
                    <button key={c.id} onClick={() => moveCard(app.id, c.id)}
                      style={{ fontSize: 10, padding: '3px 7px', background: '#1f1f1f', color: '#9ca3af', border: '1px solid #2a2a2a', borderRadius: 5, cursor: 'pointer' }}>
                      → {c.id}
                    </button>
                  ))}

                  {/* Delete */}
                  <button onClick={() => deleteApp(app.id)}
                    style={{ fontSize: 10, padding: '3px 7px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, cursor: 'pointer' }}>
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

      {/* ── Cover Letter Modal ── */}
      {coverLetterApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: 'white', fontSize: 16, fontWeight: 600, margin: 0 }}>Cover Letter</h3>
                <p style={{ color: '#6b7280', fontSize: 12, margin: '4px 0 0 0' }}>{coverLetterApp.role} at {coverLetterApp.company}</p>
              </div>
              <button onClick={() => setCoverLetterApp(null)}
                style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {/* Cover letter content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {generatingCL ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 13 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #4b5563', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Generating personalized cover letter...
                </div>
              ) : (
                <textarea
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  style={{ width: '100%', minHeight: 300, background: '#111', color: '#e5e7eb', border: '1px solid #2a2a2a', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.7, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => generateCoverLetter(coverLetterApp)}
                disabled={generatingCL}
                style={{ padding: '8px 14px', background: 'transparent', color: '#9ca3af', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
              >
                ↻ Regenerate
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(coverLetter)}
                style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.15)', color: 'rgb(147,197,253)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
              >
                Copy
              </button>
              <button
                onClick={() => openEmailModal(coverLetterApp, coverLetter)}
                disabled={generatingCL || !coverLetter}
                style={{ padding: '8px 16px', background: 'white', color: 'black', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Send via email →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Email Modal ── */}
      {emailData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, width: '100%', maxWidth: 480 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: 'white', fontSize: 16, fontWeight: 600, margin: 0 }}>Send Application</h3>
                <p style={{ color: '#6b7280', fontSize: 12, margin: '4px 0 0 0' }}>
                  {emailData.app.role} at {emailData.app.company}
                </p>
              </div>
              <button onClick={() => setEmailData(null)}
                style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ color: 'rgb(253,224,71)', fontSize: 11, margin: 0 }}>
                  ⚠ Use a Gmail App Password, not your regular password. Generate one at myaccount.google.com/apppasswords
                </p>
              </div>

              {[
                { label: 'Your full name', value: userName, set: setUserName, placeholder: 'e.g. John Doe', type: 'text' },
                { label: 'Your Gmail address', value: userEmail, set: setUserEmail, placeholder: 'yourname@gmail.com', type: 'email' },
                { label: 'Gmail App Password', value: userPassword, set: setUserPassword, placeholder: '16-character app password', type: 'password' },
                { label: "HR's email address", value: hrEmail, set: setHrEmail, placeholder: 'hr@company.com', type: 'email' },
              ].map(field => (
                <div key={field.label}>
                  <label style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={e => field.set(e.target.value)}
                    placeholder={field.placeholder}
                    style={{ width: '100%', background: '#111', color: 'white', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              {emailStatus && (
                <div style={{ padding: '10px 14px', background: emailStatus.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${emailStatus.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8 }}>
                  <p style={{ color: emailStatus.startsWith('✓') ? '#4ade80' : '#f87171', fontSize: 12, margin: 0 }}>{emailStatus}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setEmailData(null)}
                  style={{ flex: 1, padding: '10px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={sendEmail}
                  disabled={sending || !userEmail || !userPassword || !hrEmail || !userName}
                  style={{ flex: 2, padding: '10px', background: sending ? '#1f1f1f' : 'white', color: sending ? '#4b5563' : 'black', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {sending ? (
                    <>
                      <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #4b5563', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Sending...
                    </>
                  ) : 'Send & mark as Applied'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}