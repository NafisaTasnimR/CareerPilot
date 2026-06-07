'use client'

import { useState, useEffect } from 'react'
import { getAuthHeaders } from '@/lib/backend'

const COLUMNS = [
  { id: 'Applied', color: 'bg-blue-500/20 border-blue-500/30' },
  { id: 'Interviewing', color: 'bg-yellow-500/20 border-yellow-500/30' },
  { id: 'Offer', color: 'bg-green-500/20 border-green-500/30' },
  { id: 'Rejected', color: 'bg-red-500/20 border-red-500/30' },
]

export default function KanbanBoard({ api }: { api: string }) {
  const [apps, setApps] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) return <p className="text-gray-400">Loading applications...</p>

  return (
    <div>
      {/* Add button */}
      <button
        onClick={() => setShowForm(v => !v)}
        className="mb-6 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
      >
        + Add Application
      </button>

      {/* Add form */}
      {showForm && (
        <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-xl flex gap-3">
          <input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="Company name..."
            className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
          <input
            value={role}
            onChange={e => setRole(e.target.value)}
            placeholder="Role / position..."
            className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
          <button onClick={addApplication}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-500 transition-colors">
            Save
          </button>
          <button onClick={() => setShowForm(false)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors">
            Cancel
          </button>
        </div>
      )}

      {/* Columns */}
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map(col => (
          <div
            key={col.id}
            onDragOver={e => e.preventDefault()}
            onDrop={() => dragging && moveCard(dragging, col.id)}
            className={`border rounded-xl p-4 min-h-64 ${col.color}`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-white">{col.id}</h3>
              <span className="text-xs bg-gray-800 text-gray-400 rounded-full px-2 py-0.5">
                {apps.filter(a => a.status === col.id).length}
              </span>
            </div>

            {apps.filter(a => a.status === col.id).map(app => (
              <div
                key={app.id}
                draggable
                onDragStart={() => setDragging(app.id)}
                onDragEnd={() => setDragging(null)}
                className="bg-gray-900 border border-gray-700 rounded-lg p-3 mb-3 cursor-grab hover:border-gray-500 transition-colors"
              >
                <div className="text-sm font-medium text-white">{app.role}</div>
                <div className="text-xs text-gray-400 mt-1">{app.company}</div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {COLUMNS.filter(c => c.id !== col.id).map(c => (
                    <button key={c.id} onClick={() => moveCard(app.id, c.id)}
                      className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors">
                      → {c.id}
                    </button>
                  ))}
                  <button onClick={() => deleteApp(app.id)}
                    className="text-xs px-2 py-0.5 bg-red-900/50 text-red-400 rounded hover:bg-red-900 transition-colors">
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {apps.filter(a => a.status === col.id).length === 0 && (
              <p className="text-xs text-gray-600 text-center mt-8">Drop here</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}