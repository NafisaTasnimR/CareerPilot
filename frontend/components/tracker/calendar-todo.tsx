'use client'

import { useState, useEffect } from 'react'

const USER_ID = 'test-user-123'
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const GOLD   = 'rgb(212,170,90)'
const GOLD50 = 'rgba(212,170,90,0.5)'
const GOLD25 = 'rgba(212,170,90,0.25)'
const GOLD18 = 'rgba(212,170,90,0.18)'
const GOLD30 = 'rgba(212,170,90,0.3)'
const GOLD15 = 'rgba(212,170,90,0.15)'
const GOLD_TEXT = 'rgb(245,220,150)'

const TEAL   = 'rgb(20,184,166)'
const TEAL50 = 'rgba(20,184,166,0.5)'
const TEAL25 = 'rgba(20,184,166,0.25)'
const TEAL18 = 'rgba(20,184,166,0.18)'
const TEAL30 = 'rgba(20,184,166,0.3)'
const TEAL15 = 'rgba(20,184,166,0.15)'
const TEAL_TEXT = 'rgb(153,246,228)'

const PURPLE   = 'rgb(168,85,247)'
const PURPLE50 = 'rgba(168,85,247,0.5)'
const PURPLE18 = 'rgba(168,85,247,0.18)'
const PURPLE30 = 'rgba(168,85,247,0.3)'

interface Goal {
  id: string
  title: string
  deadline: string | null
  completed: boolean
}

interface Task {
  id: string
  title: string
  due_date: string | null
  completed: boolean
  goal_id: string | null
}

interface ConfirmDialog {
  type: 'goal' | 'task'
  id: string
  title: string
}

export default function CalendarTodo({ userId, api }: { userId?: string; api?: string }) {
  // Always use hardcoded values — same pattern as tracker page
  const uid     = USER_ID
  const baseApi = API

  const [goals, setGoals] = useState<Goal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newGoal, setNewGoal] = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [newTaskTexts, setNewTaskTexts] = useState<Record<string, string>>({})
  const [newTaskDates, setNewTaskDates] = useState<Record<string, string>>({})
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)

  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear]   = useState(today.getFullYear())

  // ── fetch on mount (uid and baseApi are stable constants so this is safe) ──
  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`${baseApi}/calendar/goals?user_id=${uid}`)
        .then(r => { if (!r.ok) throw new Error(`goals ${r.status}`); return r.json() }),
      fetch(`${baseApi}/calendar/tasks?user_id=${uid}`)
        .then(r => { if (!r.ok) throw new Error(`tasks ${r.status}`); return r.json() }),
    ])
      .then(([goalsData, tasksData]) => {
        setGoals(Array.isArray(goalsData) ? goalsData : [])
        setTasks(Array.isArray(tasksData) ? tasksData : [])
      })
      .catch(err => {
        console.error('Calendar fetch failed:', err)
        setError(err.message)
        setGoals([])
        setTasks([])
      })
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // uid and baseApi are module-level constants — safe to omit

  const addGoal = async () => {
    if (!newGoal.trim()) return
    try {
      const res = await fetch(`${baseApi}/calendar/goals?user_id=${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newGoal, deadline: goalDeadline || null }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const created = await res.json()
      setGoals(prev => [...prev, created])
      setNewGoal('')
      setGoalDeadline('')
    } catch (err) {
      console.error('Add goal failed:', err)
    }
  }

  const addTask = async (goalId: string) => {
    const text = newTaskTexts[goalId]
    if (!text?.trim()) return
    try {
      const res = await fetch(`${baseApi}/calendar/tasks?user_id=${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: text, goal_id: goalId, due_date: newTaskDates[goalId] || null }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const created = await res.json()
      setTasks(prev => [...prev, created])
      setNewTaskTexts(prev => ({ ...prev, [goalId]: '' }))
      setNewTaskDates(prev => ({ ...prev, [goalId]: '' }))
    } catch (err) {
      console.error('Add task failed:', err)
    }
  }

  const toggleGoal = async (id: string, completed: boolean) => {
    try {
      await fetch(`${baseApi}/calendar/goals/${id}?completed=${!completed}`, { method: 'PATCH' })
      setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !completed } : g))
    } catch (err) { console.error('Toggle goal failed:', err) }
  }

  const toggleTask = async (id: string, completed: boolean) => {
    try {
      await fetch(`${baseApi}/calendar/tasks/${id}/complete?completed=${!completed}`, { method: 'PATCH' })
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t))
    } catch (err) { console.error('Toggle task failed:', err) }
  }

  const confirmDelete = (type: 'goal' | 'task', id: string, title: string) => {
    setConfirmDialog({ type, id, title })
  }

  const handleConfirmDelete = async () => {
    if (!confirmDialog) return
    try {
      if (confirmDialog.type === 'goal') {
        await fetch(`${baseApi}/calendar/goals/${confirmDialog.id}`, { method: 'DELETE' })
        setGoals(prev => prev.filter(g => g.id !== confirmDialog.id))
        setTasks(prev => prev.filter(t => t.goal_id !== confirmDialog.id))
      } else {
        await fetch(`${baseApi}/calendar/tasks/${confirmDialog.id}`, { method: 'DELETE' })
        setTasks(prev => prev.filter(t => t.id !== confirmDialog.id))
      }
    } catch (err) { console.error('Delete failed:', err) }
    setConfirmDialog(null)
  }

  const getDaysInMonth    = (m: number, y: number) => new Date(y, m + 1, 0).getDate()
  const getFirstDayOfMonth = (m: number, y: number) => new Date(y, m, 1).getDay()
  const getDateString     = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const getDeadlinesForDate = (dateStr: string) => ({
    goalDeadlines: goals.filter(g => g.deadline === dateStr),
    taskDeadlines: tasks.filter(t => t.due_date === dateStr),
  })

  const daysInMonth = getDaysInMonth(calMonth, calYear)
  const firstDay    = getFirstDayOfMonth(calMonth, calYear)
  const todayStr    = getDateString(today.getFullYear(), today.getMonth(), today.getDate())

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── ERROR BANNER ── */}
      {error && (
        <div style={{ background: '#1f1215', border: '1px solid #3f1820', borderRadius: 8, padding: '10px 16px' }}>
          <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>
            ⚠️ Could not reach backend ({error}). Check that FastAPI is running on {baseApi}.
          </p>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {confirmDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#1a1a1a', border: '1px solid #333', borderRadius: 16,
            padding: 28, width: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M9 11V7M9 13.5V14M3.5 17h11a1.5 1.5 0 001.3-2.25L10.3 3.75a1.5 1.5 0 00-2.6 0L2.2 14.75A1.5 1.5 0 003.5 17z"
                  stroke="rgb(239,68,68)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: '0 0 8px 0' }}>
              Delete {confirmDialog.type === 'goal' ? 'Goal' : 'Task'}?
            </p>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 6px 0' }}>Are you sure you want to delete:</p>
            <p style={{
              fontSize: 13, fontWeight: 600,
              color: confirmDialog.type === 'goal' ? GOLD_TEXT : TEAL_TEXT,
              background: confirmDialog.type === 'goal' ? GOLD15 : TEAL15,
              border: `1px solid ${confirmDialog.type === 'goal' ? GOLD30 : TEAL30}`,
              borderRadius: 8, padding: '8px 12px', margin: '0 0 20px 0',
            }}>
              "{confirmDialog.title}"
            </p>
            {confirmDialog.type === 'goal' && (
              <p style={{ fontSize: 12, color: 'rgba(239,68,68,0.8)', margin: '0 0 20px 0' }}>
                ⚠️ This will also delete all tasks under this goal.
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: '#2a2a2a', border: '1px solid #3a3a3a', color: '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={handleConfirmDelete}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: 'rgb(252,165,165)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CALENDAR ── */}
      <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: 10, background: '#2a2a2a', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: 10, background: '#2a2a2a', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
          <h2 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: 0 }}>{MONTHS[calMonth]} {calYear}</h2>
          <div style={{ display: 'flex', gap: 16 }}>
            {[['Goal deadline', GOLD50, GOLD], ['Task due', TEAL50, TEAL], ['Both', PURPLE50, PURPLE]].map(([label, bg, border]) => (
              <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: bg as string, border: `1px solid ${border as string}` }} />
                <span style={{ color: '#9ca3af', fontSize: 12 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #222' }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} style={{ height: 90, borderRight: '1px solid #1f1f1f', borderBottom: '1px solid #1f1f1f' }} />
          ))}

          {loading
            ? Array.from({ length: daysInMonth }).map((_, i) => (
                <div key={i} style={{ height: 90, borderRight: (firstDay + i) % 7 === 6 ? 'none' : '1px solid #1f1f1f', borderBottom: '1px solid #1f1f1f', padding: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 13 }}>{i + 1}</div>
                </div>
              ))
            : Array.from({ length: daysInMonth }).map((_, i) => {
                const day     = i + 1
                const dateStr = getDateString(calYear, calMonth, day)
                const { goalDeadlines, taskDeadlines } = getDeadlinesForDate(dateStr)
                const isToday = dateStr === todayStr
                const hasGoal = goalDeadlines.length > 0
                const hasTask = taskDeadlines.length > 0
                const col     = (firstDay + i) % 7

                const cellBg = hasGoal && hasTask ? PURPLE18 : hasGoal ? GOLD18 : hasTask ? TEAL18 : 'transparent'

                return (
                  <div
                    key={day}
                    onMouseEnter={() => (hasGoal || hasTask) && setHoveredDate(dateStr)}
                    onMouseLeave={() => setHoveredDate(null)}
                    style={{
                      height: 90, padding: 8,
                      borderRight: col === 6 ? 'none' : '1px solid #1f1f1f',
                      borderBottom: '1px solid #1f1f1f',
                      background: cellBg,
                      position: 'relative', cursor: 'default', transition: 'background 0.15s',
                    }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: isToday ? 'white' : 'transparent',
                      color: isToday ? 'black' : '#9ca3af',
                      fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{day}</div>

                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {goalDeadlines.slice(0, 1).map(g => (
                        <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: GOLD25, border: `1px solid ${GOLD50}`, borderRadius: 4, padding: '2px 6px' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: GOLD_TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
                        </div>
                      ))}
                      {taskDeadlines.slice(0, 1).map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: TEAL25, border: `1px solid ${TEAL50}`, borderRadius: 4, padding: '2px 6px' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: TEAL, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: TEAL_TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                        </div>
                      ))}
                      {(goalDeadlines.length + taskDeadlines.length) > 2 && (
                        <span style={{ fontSize: 10, color: '#6b7280', paddingLeft: 4 }}>+{goalDeadlines.length + taskDeadlines.length - 2} more</span>
                      )}
                    </div>

                    {hoveredDate === dateStr && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: '#0f0f0f', border: '1px solid #333', borderRadius: 12, padding: 12, width: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', marginTop: 4 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#d1d5db', paddingBottom: 8, borderBottom: '1px solid #222', margin: '0 0 8px 0' }}>{dateStr}</p>
                        {goalDeadlines.map(g => (
                          <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD, marginTop: 3, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: g.completed ? '#4b5563' : 'white', textDecoration: g.completed ? 'line-through' : 'none' }}>{g.title}</span>
                          </div>
                        ))}
                        {taskDeadlines.map(t => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: TEAL, marginTop: 3, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: t.completed ? '#4b5563' : 'white', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
          }
        </div>
      </div>

      {/* ── BOTTOM: Add Goal + Goals List ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Add Goal */}
        <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 16, padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 16px 0' }}>Add New Goal</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              value={newGoal}
              onChange={e => setNewGoal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGoal()}
              placeholder='e.g. "Apply to 5 jobs this week"'
              style={{ width: '100%', background: '#111', color: 'white', border: '1px solid #333', borderRadius: 10, padding: '10px 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="date"
                value={goalDeadline}
                onChange={e => setGoalDeadline(e.target.value)}
                style={{ flex: 1, background: '#111', color: 'white', border: '1px solid #333', borderRadius: 10, padding: '10px 14px', fontSize: 13, outline: 'none', colorScheme: 'dark' }}
              />
              <button
                onClick={addGoal}
                style={{ padding: '10px 20px', background: GOLD, color: '#111', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Add Goal</button>
            </div>
          </div>
        </div>

        {/* Goals List */}
        <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 16, padding: 20, maxHeight: 300, overflowY: 'auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 16px 0' }}>Your Goals</p>

          {loading ? (
            <p style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Loading goals...</p>
          ) : goals.length === 0 ? (
            <p style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No goals yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {goals.map(goal => (
                <div key={goal.id} style={{ background: GOLD15, border: `1px solid ${GOLD30}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                    <button
                      onClick={() => toggleGoal(goal.id, goal.completed)}
                      style={{
                        width: 22, height: 22, borderRadius: '50%',
                        border: `2px solid ${GOLD}`,
                        background: goal.completed ? GOLD : 'rgba(212,170,90,0.12)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      {goal.completed
                        ? <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.2 5.5L8 1" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <div style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD, opacity: 0.5 }} />
                      }
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: goal.completed ? '#6b7280' : GOLD_TEXT, textDecoration: goal.completed ? 'line-through' : 'none', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {goal.title}
                      </p>
                      {goal.deadline && (
                        <p style={{ fontSize: 11, color: GOLD, margin: '2px 0 0 0' }}>⏰ {goal.deadline}</p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#6b7280', background: '#111', borderRadius: 6, padding: '2px 6px' }}>
                        {tasks.filter(t => t.goal_id === goal.id).length} tasks
                      </span>
                      <button
                        onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                        style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {expandedGoal === goal.id ? '▲' : '▼'}
                      </button>
                      <button
                        onClick={() => confirmDelete('goal', goal.id, goal.title)}
                        style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgb(252,165,165)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >🗑</button>
                    </div>
                  </div>

                  {expandedGoal === goal.id && (
                    <div style={{ borderTop: `1px solid ${GOLD15}`, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                        {tasks.filter(t => t.goal_id === goal.id).length === 0 && (
                          <p style={{ fontSize: 11, color: '#4b5563', fontStyle: 'italic', margin: 0 }}>No tasks yet</p>
                        )}
                        {tasks.filter(t => t.goal_id === goal.id).map(task => (
                          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: TEAL15, border: `1px solid rgba(20,184,166,0.2)`, borderRadius: 8, padding: '6px 10px' }}>
                            <button
                              onClick={() => toggleTask(task.id, task.completed)}
                              style={{
                                width: 18, height: 18, borderRadius: 4,
                                border: `2px solid ${TEAL}`,
                                background: task.completed ? TEAL : 'rgba(20,184,166,0.12)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              }}
                            >
                              {task.completed
                                ? <svg width="7" height="5" viewBox="0 0 7 5" fill="none"><path d="M1 2.5L2.8 4L6 1" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                : <div style={{ width: 6, height: 6, borderRadius: 2, background: TEAL, opacity: 0.5 }} />
                              }
                            </button>
                            <span style={{ flex: 1, fontSize: 12, color: task.completed ? '#4b5563' : TEAL_TEXT, textDecoration: task.completed ? 'line-through' : 'none' }}>
                              {task.title}
                            </span>
                            {task.due_date && (
                              <span style={{ fontSize: 11, color: TEAL }}>📌 {task.due_date}</span>
                            )}
                            <button
                              onClick={() => confirmDelete('task', task.id, task.title)}
                              style={{ width: 22, height: 22, borderRadius: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgb(252,165,165)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            >🗑</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          value={newTaskTexts[goal.id] || ''}
                          onChange={e => setNewTaskTexts(prev => ({ ...prev, [goal.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addTask(goal.id)}
                          placeholder="New task..."
                          style={{ flex: 1, background: '#111', color: 'white', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 10px', fontSize: 12, outline: 'none' }}
                        />
                        <input
                          type="date"
                          value={newTaskDates[goal.id] || ''}
                          onChange={e => setNewTaskDates(prev => ({ ...prev, [goal.id]: e.target.value }))}
                          style={{ background: '#111', color: 'white', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 8px', fontSize: 12, outline: 'none', colorScheme: 'dark' }}
                        />
                        <button
                          onClick={() => addTask(goal.id)}
                          style={{ padding: '6px 12px', background: TEAL15, color: TEAL_TEXT, border: `1px solid ${TEAL30}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >+ Add</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}