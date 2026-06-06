'use client'

import { useState, useEffect } from 'react'

/* ─── constants ──────────────────────────────────────── */
const USER_ID = 'test-user-123'
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

/* ─── types ──────────────────────────────────────────── */
interface Goal { id: string; title: string; deadline: string | null; completed: boolean }
interface Task { id: string; title: string; due_date: string | null; completed: boolean; goal_id: string | null }
interface ConfirmDialog { type: 'goal' | 'task'; id: string; title: string }

/* ─── helpers ────────────────────────────────────────── */
const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const daysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate()
const firstDayOfMonth = (m: number, y: number) => {
  const d = new Date(y, m, 1).getDay()
  return d === 0 ? 6 : d - 1
}

/* ─── palette ────────────────────────────────────────── */
const P = {
  bg:        '#0E0D0B',
  surface:   '#141310',
  surface2:  '#1A1916',
  surface3:  '#22201D',
  border:    '#2C2A26',
  borderSub: '#201F1C',
  text1:     '#EDE8DF',
  text2:     '#7D796F',
  text3:     '#4A4740',
  gold:      '#C4924A',
  goldDim:   'rgba(196,146,74,0.12)',
  goldBorder:'rgba(196,146,74,0.22)',
  goldText:  '#D4A96A',
  green:     '#3A9E7E',
  greenDim:  'rgba(58,158,126,0.1)',
  greenBorder:'rgba(58,158,126,0.2)',
  greenText: '#5BB89A',
  todayBg:   '#1C1A15',
  red:       '#C04040',
  redDim:    'rgba(192,64,64,0.1)',
  redBorder: 'rgba(192,64,64,0.25)',
  redText:   '#E07070',
}

export default function CalendarTodo() {
  const uid = USER_ID
  const baseApi = API

  const [goals, setGoals]   = useState<Goal[]>([])
  const [tasks, setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const [newGoal, setNewGoal]           = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [newTaskTexts, setNewTaskTexts] = useState<Record<string,string>>({})
  const [newTaskDates, setNewTaskDates] = useState<Record<string,string>>({})
  const [hoveredDate, setHoveredDate]   = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)

  const today = new Date()
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear,  setCalYear]  = useState(today.getFullYear())
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  useEffect(() => {
    setLoading(true); setError(null)
    Promise.all([
      fetch(`${baseApi}/calendar/goals?user_id=${uid}`).then(r => { if (!r.ok) throw new Error(`goals ${r.status}`); return r.json() }),
      fetch(`${baseApi}/calendar/tasks?user_id=${uid}`).then(r => { if (!r.ok) throw new Error(`tasks ${r.status}`); return r.json() }),
      fetch(`${baseApi}/kanban?user_id=${uid}`).then(r => { if (!r.ok) throw new Error(`kanban ${r.status}`); return r.json() }),
    ])
      .then(([goalsData, tasksData, apps]) => {
        setGoals(Array.isArray(goalsData) ? goalsData : [])
        const deadlines = Array.isArray(apps) ? apps.filter((a: any) => a.deadline).map((a: any) => ({
          id: `app-${a.id}`, title: `${a.role} @ ${a.company}`,
          due_date: a.deadline, completed: a.status === 'Offer' || a.status === 'Rejected', goal_id: null,
        })) : []
        setTasks([...(Array.isArray(tasksData) ? tasksData : []), ...deadlines])
      })
      .catch(err => { setError(err.message); setGoals([]); setTasks([]) })
      .finally(() => setLoading(false))
  }, [])

  const addGoal = async () => {
    if (!newGoal.trim()) return
    try {
      const res = await fetch(`${baseApi}/calendar/goals?user_id=${uid}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newGoal, deadline: goalDeadline || null }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setGoals(p => [...p, created]); setNewGoal(''); setGoalDeadline('')
    } catch {}
  }

  const addTask = async (goalId: string) => {
    const text = newTaskTexts[goalId]
    if (!text?.trim()) return
    try {
      const res = await fetch(`${baseApi}/calendar/tasks?user_id=${uid}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: text, goal_id: goalId, due_date: newTaskDates[goalId] || null }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setTasks(p => [...p, created])
      setNewTaskTexts(p => ({ ...p, [goalId]: '' }))
      setNewTaskDates(p => ({ ...p, [goalId]: '' }))
    } catch {}
  }

  const toggleGoal = async (id: string, completed: boolean) => {
    try { await fetch(`${baseApi}/calendar/goals/${id}?completed=${!completed}`, { method: 'PATCH' }) } catch {}
    setGoals(p => p.map(g => g.id === id ? { ...g, completed: !completed } : g))
  }

  const toggleTask = async (id: string, completed: boolean) => {
    try { await fetch(`${baseApi}/calendar/tasks/${id}/complete?completed=${!completed}`, { method: 'PATCH' }) } catch {}
    setTasks(p => p.map(t => t.id === id ? { ...t, completed: !completed } : t))
  }

  const doDelete = async () => {
    if (!confirmDialog) return
    try {
      if (confirmDialog.type === 'goal') {
        await fetch(`${baseApi}/calendar/goals/${confirmDialog.id}`, { method: 'DELETE' })
        setGoals(p => p.filter(g => g.id !== confirmDialog.id))
        setTasks(p => p.filter(t => t.goal_id !== confirmDialog.id))
      } else {
        await fetch(`${baseApi}/calendar/tasks/${confirmDialog.id}`, { method: 'DELETE' })
        setTasks(p => p.filter(t => t.id !== confirmDialog.id))
      }
    } catch {}
    setConfirmDialog(null)
  }

  const prevMonth = () => calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1)
  const nextMonth = () => calMonth === 11 ? (setCalMonth(0), setCalYear(y => y + 1)) : setCalMonth(m => m + 1)

  const total    = daysInMonth(calMonth, calYear)
  const first    = firstDayOfMonth(calMonth, calYear)
  const calCells = [
    ...Array.from({ length: first }, () => null as null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ]

  /* ── shared input style ── */
  const inputBase: React.CSSProperties = {
    width: '100%', background: 'transparent', color: P.text1,
    border: 'none', borderBottom: `1px solid ${P.border}`,
    padding: '8px 0', fontSize: 13, fontFamily: 'inherit',
    fontWeight: 300, outline: 'none', transition: 'border-color 0.2s',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap');

        .ctd * { box-sizing: border-box; margin: 0; padding: 0; }

        .ctd {
          font-family: 'Jost', sans-serif;
          font-weight: 300;
          background: ${P.bg};
          color: ${P.text1};
          min-height: 100vh;
          padding: 48px 56px;
        }

        /* scrollbar */
        .ctd-scroll::-webkit-scrollbar { width: 2px; }
        .ctd-scroll::-webkit-scrollbar-track { background: transparent; }
        .ctd-scroll::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 2px; }

        /* date inputs */
        .ctd-date { color-scheme: dark; }
        .ctd-date::-webkit-calendar-picker-indicator { opacity: 0.3; cursor: pointer; filter: invert(1); }

        /* checkbox — circle for goals */
        .ctd-chk-circle {
          appearance: none; -webkit-appearance: none;
          width: 16px; height: 16px;
          border: 1px solid ${P.text3};
          border-radius: 50%; cursor: pointer; flex-shrink: 0;
          transition: all 0.2s; position: relative; background: transparent;
        }
        .ctd-chk-circle:checked { background: ${P.gold}; border-color: ${P.gold}; }
        .ctd-chk-circle:checked::after {
          content: ''; position: absolute; left: 4px; top: 2px;
          width: 5px; height: 8px;
          border: 1.5px solid ${P.bg};
          border-top: none; border-left: none;
          transform: rotate(42deg);
        }

        /* checkbox — square for tasks */
        .ctd-chk-sq {
          appearance: none; -webkit-appearance: none;
          width: 13px; height: 13px;
          border: 1px solid ${P.text3};
          border-radius: 2px; cursor: pointer; flex-shrink: 0;
          transition: all 0.2s; position: relative; background: transparent;
        }
        .ctd-chk-sq:checked { background: ${P.green}; border-color: ${P.green}; }
        .ctd-chk-sq:checked::after {
          content: ''; position: absolute; left: 2px; top: 0px;
          width: 5px; height: 8px;
          border: 1.5px solid ${P.bg};
          border-top: none; border-left: none;
          transform: rotate(42deg);
        }

        /* focus glow on underline inputs */
        .ctd-uline:focus { border-bottom-color: ${P.gold} !important; }

        /* calendar day hover */
        .ctd-day:hover { background: ${P.surface3} !important; }

        /* goal row hover */
        .ctd-goal-row:hover { background: rgba(196,146,74,0.03); }

        /* icon button hover */
        .ctd-icon-btn:hover { color: ${P.text1} !important; }

        /* nav btn */
        .ctd-nav:hover { border-color: ${P.text2} !important; color: ${P.text1} !important; }

        /* add btn */
        .ctd-add-btn:hover { background: ${P.text1} !important; color: ${P.bg} !important; }

        /* task add btn */
        .ctd-task-add:hover { border-color: ${P.green} !important; color: ${P.greenText} !important; }

        /* delete btn */
        .ctd-del:hover { color: ${P.redText} !important; }

        /* modal confirm */
        .ctd-modal-confirm:hover { background: ${P.redDim} !important; border-color: ${P.redBorder} !important; }

        /* subtle fade-in */
        @keyframes ctdIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .ctd-in   { animation: ctdIn 0.4s ease both; }
        .ctd-in-1 { animation: ctdIn 0.4s 0.07s ease both; }
        .ctd-in-2 { animation: ctdIn 0.4s 0.15s ease both; }
      `}</style>

      <div className="ctd">

        {/* ── MODAL ── */}
        {confirmDialog && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(8,7,6,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div className="ctd-in" style={{
              background: P.surface2, border: `1px solid ${P.border}`,
              width: 380, padding: '36px 32px',
              boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
            }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 300, color: P.text1, marginBottom: 8 }}>
                Delete {confirmDialog.type === 'goal' ? 'Goal' : 'Task'}
              </p>
              <p style={{ fontSize: 12, color: P.text2, marginBottom: 20, lineHeight: 1.7, letterSpacing: '0.02em' }}>
                This cannot be undone.{confirmDialog.type === 'goal' ? ' All associated tasks will also be removed.' : ''}
              </p>
              <div style={{ background: P.surface3, border: `1px solid ${P.border}`, padding: '10px 14px', marginBottom: 28, fontSize: 13, color: P.text1, lineHeight: 1.5 }}>
                "{confirmDialog.title}"
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmDialog(null)}
                  style={{ flex: 1, padding: '11px 0', background: 'transparent', border: `1px solid ${P.border}`, color: P.text2, fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                >Cancel</button>
                <button
                  className="ctd-modal-confirm"
                  onClick={doDelete}
                  style={{ flex: 1, padding: '11px 0', background: 'transparent', border: `1px solid ${P.border}`, color: P.redText, fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                >Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="ctd-in" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 52 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: P.text3, marginBottom: 10 }}>
              Planner
            </p>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 300, lineHeight: 1, letterSpacing: '-0.01em', color: P.text1 }}>
              {MONTHS[calMonth]}
              <em style={{ fontStyle: 'italic', color: P.gold }}> {calYear}</em>
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 }}>
            {error && (
              <p style={{ fontSize: 11, color: P.redText, background: P.redDim, border: `1px solid ${P.redBorder}`, padding: '7px 14px', letterSpacing: '0.03em' }}>
                ⚠ Backend unreachable — {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['‹','›'] as const).map((arrow, i) => (
                <button
                  key={arrow}
                  className="ctd-nav"
                  onClick={i === 0 ? prevMonth : nextMonth}
                  style={{ width: 36, height: 36, background: 'transparent', border: `1px solid ${P.border}`, color: P.text2, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', fontFamily: 'inherit' }}
                >
                  {arrow}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 48, alignItems: 'start' }}>

          {/* ══ CALENDAR ══ */}
          <div className="ctd-in-1">
            {/* Day names */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${P.border}`, marginBottom: 0 }}>
              {DAYS_SHORT.map(d => (
                <div key={d} style={{ padding: '0 0 12px', textAlign: 'center', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: P.text3 }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {calCells.map((day, idx) => {
                const col = idx % 7
                const borderR = col !== 6 ? `1px solid ${P.borderSub}` : 'none'
                const borderB = `1px solid ${P.borderSub}`

                if (day === null) return (
                  <div key={`e-${idx}`} style={{ minHeight: 96, borderRight: borderR, borderBottom: borderB, background: P.surface }} />
                )

                const ds      = toDateStr(calYear, calMonth, day)
                const goalDl  = goals.filter(g => g.deadline === ds)
                const taskDl  = tasks.filter(t => t.due_date === ds)
                const isToday = ds === todayStr
                const hasAny  = goalDl.length > 0 || taskDl.length > 0

                return (
                  <div
                    key={ds}
                    className={hasAny ? 'ctd-day' : ''}
                    onMouseEnter={() => hasAny && setHoveredDate(ds)}
                    onMouseLeave={() => setHoveredDate(null)}
                    style={{
                      minHeight: 96, padding: '10px 10px 8px',
                      borderRight: borderR, borderBottom: borderB,
                      background: isToday ? P.todayBg : 'transparent',
                      position: 'relative', transition: 'background 0.15s',
                    }}
                  >
                    {/* Number */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <span style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 15, fontWeight: isToday ? 500 : 300,
                        color: isToday ? P.gold : P.text3,
                        lineHeight: 1,
                      }}>
                        {day}
                      </span>
                      {isToday && <span style={{ width: 4, height: 4, borderRadius: '50%', background: P.gold, display: 'block' }} />}
                    </div>

                    {/* Events */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {goalDl.slice(0, 1).map(g => (
                        <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: P.gold, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: P.goldText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 300, letterSpacing: '0.01em' }}>
                            {g.title}
                          </span>
                        </div>
                      ))}
                      {taskDl.slice(0, 1).map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: P.green, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: P.greenText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 300 }}>
                            {t.title}
                          </span>
                        </div>
                      ))}
                      {goalDl.length + taskDl.length > 2 && (
                        <span style={{ fontSize: 9, color: P.text3, letterSpacing: '0.04em', paddingLeft: 7 }}>
                          +{goalDl.length + taskDl.length - 2} more
                        </span>
                      )}
                    </div>

                    {/* Popover */}
                    {hoveredDate === ds && hasAny && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
                        background: P.surface2, border: `1px solid ${P.border}`,
                        padding: '14px 16px', width: 220,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
                        pointerEvents: 'none',
                      }}>
                        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: P.text3, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${P.borderSub}` }}>
                          {ds}
                        </p>
                        {goalDl.map(g => (
                          <div key={g.id} style={{ display: 'flex', gap: 8, padding: '3px 0', alignItems: 'flex-start' }}>
                            <div style={{ width: 3, height: 3, borderRadius: '50%', background: P.gold, marginTop: 5, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: g.completed ? P.text3 : P.text1, textDecoration: g.completed ? 'line-through' : 'none', lineHeight: 1.5 }}>{g.title}</span>
                          </div>
                        ))}
                        {taskDl.map(t => (
                          <div key={t.id} style={{ display: 'flex', gap: 8, padding: '3px 0', alignItems: 'flex-start' }}>
                            <div style={{ width: 3, height: 3, borderRadius: '50%', background: P.green, marginTop: 5, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: t.completed ? P.text3 : P.text1, textDecoration: t.completed ? 'line-through' : 'none', lineHeight: 1.5 }}>{t.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 28, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${P.border}` }}>
              {[[P.gold, 'Goal deadline'], [P.green, 'Task due date']].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 1, background: color }} />
                  <span style={{ fontSize: 11, color: P.text3, letterSpacing: '0.06em' }}>{label}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, background: P.todayBg, border: `1px solid ${P.border}` }} />
                <span style={{ fontSize: 11, color: P.text3, letterSpacing: '0.06em' }}>Today</span>
              </div>
            </div>
          </div>

          {/* ══ SIDEBAR ══ */}
          <div className="ctd-in-2" style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'sticky', top: 48 }}>

            {/* Add Goal */}
            <div style={{ paddingBottom: 32, marginBottom: 32, borderBottom: `1px solid ${P.border}` }}>
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: P.text3, marginBottom: 18 }}>
                New Goal
              </p>
              <input
                className="ctd-uline"
                value={newGoal}
                onChange={e => setNewGoal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGoal()}
                placeholder="What do you want to achieve?"
                style={{ ...inputBase, marginBottom: 14, fontSize: 14 }}
              />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="date"
                  className="ctd-date ctd-uline"
                  value={goalDeadline}
                  onChange={e => setGoalDeadline(e.target.value)}
                  style={{ ...inputBase, flex: 1, fontSize: 12, color: P.text2 }}
                />
                <button
                  className="ctd-add-btn"
                  onClick={addGoal}
                  style={{ padding: '9px 20px', background: 'transparent', border: `1px solid ${P.border}`, color: P.text1, fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Goals list */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: P.text3 }}>Goals</p>
                {!loading && goals.length > 0 && (
                  <span style={{ fontSize: 11, color: P.text3 }}>
                    {goals.filter(g => g.completed).length} / {goals.length}
                  </span>
                )}
              </div>

              {loading ? (
                <p style={{ fontSize: 13, color: P.text3, fontStyle: 'italic', padding: '16px 0' }}>Loading…</p>
              ) : goals.length === 0 ? (
                <p style={{ fontSize: 13, color: P.text3, fontStyle: 'italic', padding: '16px 0' }}>No goals yet.</p>
              ) : (
                <div className="ctd-scroll" style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
                  {goals.map(goal => {
                    const myTasks    = tasks.filter(t => t.goal_id === goal.id)
                    const doneTasks  = myTasks.filter(t => t.completed).length
                    const isExpanded = expandedGoal === goal.id

                    return (
                      <div key={goal.id} style={{ borderBottom: `1px solid ${P.borderSub}` }}>

                        {/* Goal row */}
                        <div
                          className="ctd-goal-row"
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', transition: 'background 0.1s' }}
                        >
                          <input
                            type="checkbox"
                            className="ctd-chk-circle"
                            checked={goal.completed}
                            onChange={() => toggleGoal(goal.id, goal.completed)}
                            style={{ marginTop: 2 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 300, color: goal.completed ? P.text3 : P.text1, textDecoration: goal.completed ? 'line-through' : 'none', lineHeight: 1.45, marginBottom: goal.deadline ? 4 : 0 }}>
                              {goal.title}
                            </p>
                            {goal.deadline && (
                              <p style={{ fontSize: 11, color: P.gold, letterSpacing: '0.04em' }}>{goal.deadline}</p>
                            )}
                            {myTasks.length > 0 && (
                              <p style={{ fontSize: 10, color: P.text3, marginTop: 5, letterSpacing: '0.04em' }}>
                                {doneTasks}/{myTasks.length} tasks
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 0, flexShrink: 0, alignItems: 'center' }}>
                            <button
                              className="ctd-icon-btn"
                              onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                              style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: P.text3, cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s', fontFamily: 'inherit' }}
                            >
                              {isExpanded ? '▲' : '▼'}
                            </button>
                            <button
                              className="ctd-del"
                              onClick={() => setConfirmDialog({ type: 'goal', id: goal.id, title: goal.title })}
                              style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: P.text3, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s', lineHeight: 1, fontFamily: 'inherit' }}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Expanded tasks */}
                        {isExpanded && (
                          <div style={{ paddingLeft: 28, paddingBottom: 14 }}>
                            {myTasks.length === 0 && (
                              <p style={{ fontSize: 12, color: P.text3, fontStyle: 'italic', padding: '4px 0 10px' }}>No tasks yet.</p>
                            )}
                            {myTasks.map(task => (
                              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: `1px solid ${P.borderSub}` }}>
                                <input
                                  type="checkbox"
                                  className="ctd-chk-sq"
                                  checked={task.completed}
                                  onChange={() => toggleTask(task.id, task.completed)}
                                />
                                <span style={{ flex: 1, fontSize: 12, fontWeight: 300, color: task.completed ? P.text3 : P.text1, textDecoration: task.completed ? 'line-through' : 'none', lineHeight: 1.5 }}>
                                  {task.title}
                                </span>
                                {task.due_date && (
                                  <span style={{ fontSize: 10, color: P.green, letterSpacing: '0.04em', flexShrink: 0 }}>{task.due_date}</span>
                                )}
                                <button
                                  className="ctd-del"
                                  onClick={() => setConfirmDialog({ type: 'task', id: task.id, title: task.title })}
                                  style={{ background: 'transparent', border: 'none', color: P.text3, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px', fontFamily: 'inherit', transition: 'color 0.15s', flexShrink: 0 }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            {/* Add task */}
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', paddingTop: 10, borderTop: `1px dashed ${P.border}` }}>
                              <input
                                className="ctd-uline"
                                value={newTaskTexts[goal.id] || ''}
                                onChange={e => setNewTaskTexts(p => ({ ...p, [goal.id]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && addTask(goal.id)}
                                placeholder="Add a task…"
                                style={{ flex: 1, background: 'transparent', color: P.text1, border: 'none', borderBottom: `1px solid ${P.border}`, padding: '5px 0', fontSize: 12, fontFamily: 'inherit', fontWeight: 300, outline: 'none' }}
                              />
                              <input
                                type="date"
                                className="ctd-date ctd-uline"
                                value={newTaskDates[goal.id] || ''}
                                onChange={e => setNewTaskDates(p => ({ ...p, [goal.id]: e.target.value }))}
                                style={{ background: 'transparent', color: P.text2, border: 'none', borderBottom: `1px solid ${P.border}`, padding: '5px 0', fontSize: 11, fontFamily: 'inherit', fontWeight: 300, outline: 'none', width: 110 }}
                              />
                              <button
                                className="ctd-task-add"
                                onClick={() => addTask(goal.id)}
                                style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${P.border}`, color: P.text2, fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', flexShrink: 0 }}
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}