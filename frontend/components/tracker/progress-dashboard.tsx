'use client'

import { useState, useEffect, useRef } from 'react'

const USER_ID = 'test-user-123'
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ─── Elegant thin serif + mono aesthetic ────────────────────────────────────
// Direction: "Luxury editorial dark" — like a Bloomberg terminal meets Monocle
// magazine. Crisp numbers, hairline rules, restrained gold accents, no gradients,
// no rounded pills, no childish icons. Pure typographic hierarchy.

const ACCENT   = '#b8975a'   // warm gold
const DIM      = '#3a3a3a'   // rule / separator
const MUTED    = '#6b6b6b'   // secondary text
const TEXT     = '#e8e4dc'   // primary text
const SURFACE  = '#161616'   // card bg
const BORDER   = '#252525'   // card border

const STATUS_META: Record<string, { label: string; abbr: string; color: string }> = {
  Applied:      { label: 'Applied',      abbr: 'APL', color: '#7a9abf' },
  Interviewing: { label: 'Interviewing', abbr: 'INT', color: '#b8975a' },
  Offered:      { label: 'Offered',      abbr: 'OFR', color: '#6aab8e' },
  Rejected:     { label: 'Rejected',     abbr: 'REJ', color: '#9e6060' },
}

export default function ProgressDashboard({ userId, api }: { userId: string; api: string }) {
  const effectiveUserId = USER_ID
  const effectiveApi   = API

  const [stats, setStats]     = useState<any>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rafRef      = useRef<number | null>(null)
  const progressRef = useRef(0)
  const targetRef   = useRef(0)
  const loopStarted = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${effectiveApi}/progress/stats?user_id=${effectiveUserId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => {
        setStats(data && typeof data === 'object' && !Array.isArray(data) ? data : emptyStats())
      })
      .catch(err => { setError(err.message); setStats(emptyStats()) })
      .finally(() => setLoading(false))
  }, [effectiveUserId, effectiveApi])

  useEffect(() => {
    if (!stats) return
    const taskPct = stats.tasks_total > 0 ? (stats.tasks_completed / stats.tasks_total) * 100 : 0
    const goalPct = stats.goals_total > 0 ? (stats.goals_completed / stats.goals_total) * 100 : 0
    const appPct  = Math.min((stats.total_applications ?? 0) / 20, 1) * 100
    targetRef.current = Math.round(taskPct * 0.5 + goalPct * 0.3 + appPct * 0.2) / 100
    if (canvasRef.current && !loopStarted.current) {
      const canvas = canvasRef.current
      canvas.width  = canvas.clientWidth  * window.devicePixelRatio
      canvas.height = canvas.clientHeight * window.devicePixelRatio
      loopStarted.current = true
      startLoop(canvas)
    }
  }, [stats])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  function emptyStats() {
    return { total_applications:0, weekly_applications:0, status_breakdown:{},
             tasks_completed:0, tasks_total:0, roadmap_percent:0, goals_completed:0, goals_total:0 }
  }

  function startLoop(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!
    let legPhase = 0

    function draw() {
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      if (!W || !H) { rafRef.current = requestAnimationFrame(draw); return }
      if (canvas.width !== Math.round(W * window.devicePixelRatio)) {
        canvas.width  = Math.round(W * window.devicePixelRatio)
        canvas.height = Math.round(H * window.devicePixelRatio)
      }
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, W, H)

      progressRef.current += (targetRef.current - progressRef.current) * 0.015
      const p = progressRef.current

      // ── Background: deep dark, almost black ──
      ctx.fillStyle = '#0e0e0e'
      ctx.fillRect(0, 0, W, H)

      // Subtle horizontal scan lines for texture
      ctx.save()
      ctx.globalAlpha = 0.03
      for (let y = 0; y < H; y += 3) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, y, W, 1)
      }
      ctx.restore()

      // ── Thin gold grid lines (editorial feel) ──
      ctx.save()
      ctx.globalAlpha = 0.07
      ctx.strokeStyle = '#b8975a'
      ctx.lineWidth = 0.5
      for (let i = 1; i < 5; i++) {
        ctx.beginPath()
        ctx.moveTo(W * i / 5, 0)
        ctx.lineTo(W * i / 5, H)
        ctx.stroke()
      }
      ctx.restore()

      // ── Track: single hairline arc ──
      const ax0 = -W * 0.02, ay0 = H * 1.05
      const acx = W * 0.50,  acy = H * 0.18
      const ax1 = W * 1.02,  ay1 = H * 1.05
      const thick = H * 0.10

      // Track fill
      ctx.beginPath()
      ctx.moveTo(ax0, ay0)
      ctx.quadraticCurveTo(acx, acy, ax1, ay1)
      ctx.quadraticCurveTo(acx, acy + thick, ax0, ay0)
      ctx.closePath()
      ctx.fillStyle = '#111318'
      ctx.fill()

      // Track top edge — hairline white
      ctx.beginPath()
      ctx.moveTo(ax0, ay0)
      ctx.quadraticCurveTo(acx, acy, ax1, ay1)
      ctx.strokeStyle = '#2a2a2a'
      ctx.lineWidth = 1
      ctx.stroke()

      // Progress line — gold
      const progressT = 0.04 + p * 0.80
      ctx.beginPath()
      ctx.moveTo(ax0, ay0)
      for (let t = 0; t <= progressT; t += 0.01) {
        const mt = 1 - t
        const rx = mt*mt*ax0 + 2*mt*t*acx + t*t*ax1
        const ry = mt*mt*ay0 + 2*mt*t*acy + t*t*ay1
        ctx.lineTo(rx, ry)
      }
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Milestone dots
      const milestones = [0.25, 0.5, 0.75]
      milestones.forEach(mt2 => {
        const mt = 1 - mt2
        const rx = mt*mt*ax0 + 2*mt*mt2*acx + mt2*mt2*ax1
        const ry = mt*mt*ay0 + 2*mt*mt2*acy + mt2*mt2*ay1
        ctx.beginPath()
        ctx.arc(rx, ry, 3, 0, Math.PI * 2)
        ctx.fillStyle = p > mt2 - 0.04 ? ACCENT : '#2a2a2a'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(rx, ry, 3, 0, Math.PI * 2)
        ctx.strokeStyle = p > mt2 - 0.04 ? ACCENT : '#444'
        ctx.lineWidth = 1
        ctx.stroke()

        // Milestone labels
        ctx.save()
        ctx.font = `400 ${Math.max(9, W * 0.011)}px "DM Mono", monospace`
        ctx.fillStyle = p > mt2 - 0.04 ? ACCENT : '#444'
        ctx.textAlign = 'center'
        ctx.fillText(`${Math.round(mt2 * 100)}%`, rx, ry - H * 0.06)
        ctx.restore()
      })

      // ── Goal marker: minimal vertical tick ──
      const goalT2 = 0.84
      const gmt2   = 1 - goalT2
      const goalX  = gmt2*gmt2*ax0 + 2*gmt2*goalT2*acx + goalT2*goalT2*ax1
      const goalY  = gmt2*gmt2*ay0 + 2*gmt2*goalT2*acy + goalT2*goalT2*ay1

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(goalX, goalY)
      ctx.lineTo(goalX, goalY - H * 0.28)
      ctx.strokeStyle = '#3a3a3a'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()

      ctx.save()
      ctx.font = `400 ${Math.max(9, W * 0.011)}px "DM Mono", monospace`
      ctx.fillStyle = '#555'
      ctx.textAlign = 'center'
      ctx.fillText('TARGET', goalX, goalY - H * 0.31)
      ctx.restore()

      // ── Figure: minimal geometric ──
      const figT = 0.04 + p * 0.80
      const fmt  = 1 - figT
      const figX = fmt*fmt*ax0 + 2*fmt*figT*acx + figT*figT*ax1
      const figY = fmt*fmt*ay0 + 2*fmt*figT*acy + figT*figT*ay1
      const tdx  = 2*(1-figT)*(acx-ax0) + 2*figT*(ax1-acx)
      const tdy  = 2*(1-figT)*(acy-ay0) + 2*figT*(ay1-acy)
      const ang  = Math.atan2(tdy, tdx)

      if (Math.abs(targetRef.current - progressRef.current) > 0.003) legPhase += 0.13

      const S  = H * 0.22
      const sw = Math.sin(legPhase)
      const cw = Math.cos(legPhase)

      ctx.save()
      ctx.translate(figX, figY)
      ctx.rotate(ang)

      // Glow dot under figure
      ctx.save()
      ctx.globalAlpha = 0.18
      ctx.beginPath()
      ctx.ellipse(0, 4, S * 0.18, S * 0.07, 0, 0, Math.PI * 2)
      ctx.fillStyle = ACCENT
      ctx.fill()
      ctx.restore()

      // Body — all in accent gold, geometric/minimal
      const lc = ACCENT

      // Legs
      ctx.save(); ctx.rotate(sw * 0.22)
      ctx.beginPath(); ctx.moveTo(S*0.04,-S*0.18); ctx.quadraticCurveTo(S*0.08,-S*0.04,S*0.12,S*0.04)
      ctx.lineWidth=S*0.08; ctx.lineCap='round'; ctx.strokeStyle=lc; ctx.stroke()
      ctx.beginPath(); ctx.ellipse(S*0.15,S*0.04,S*0.072,S*0.026,0.2,0,Math.PI*2)
      ctx.fillStyle=lc; ctx.fill(); ctx.restore()

      ctx.save(); ctx.rotate(-sw * 0.22)
      ctx.beginPath(); ctx.moveTo(-S*0.04,-S*0.18); ctx.quadraticCurveTo(-S*0.08,-S*0.04,-S*0.12,S*0.04)
      ctx.lineWidth=S*0.08; ctx.lineCap='round'; ctx.strokeStyle=lc; ctx.stroke()
      ctx.beginPath(); ctx.ellipse(-S*0.15,S*0.04,S*0.072,S*0.026,-0.2,0,Math.PI*2)
      ctx.fillStyle=lc; ctx.fill(); ctx.restore()

      // Torso
      ctx.beginPath()
      ctx.moveTo(-S*0.10,-S*0.18); ctx.lineTo(S*0.10,-S*0.18)
      ctx.lineTo(S*0.12,-S*0.52); ctx.lineTo(-S*0.12,-S*0.52); ctx.closePath()
      ctx.fillStyle=lc; ctx.fill()

      // Arms
      ctx.save(); ctx.rotate(cw * 0.16)
      ctx.beginPath(); ctx.moveTo(S*0.10,-S*0.46); ctx.lineTo(S*0.22,-S*0.28)
      ctx.lineWidth=S*0.075; ctx.lineCap='round'; ctx.strokeStyle=lc; ctx.stroke(); ctx.restore()
      ctx.save(); ctx.rotate(-cw * 0.16)
      ctx.beginPath(); ctx.moveTo(-S*0.10,-S*0.46); ctx.lineTo(-S*0.22,-S*0.30)
      ctx.lineWidth=S*0.075; ctx.lineCap='round'; ctx.strokeStyle=lc; ctx.stroke(); ctx.restore()

      // Neck + Head
      ctx.beginPath(); ctx.rect(-S*0.038,-S*0.60,S*0.076,S*0.10); ctx.fillStyle=lc; ctx.fill()
      ctx.beginPath(); ctx.ellipse(0,-S*0.74,S*0.115,S*0.14,0,0,Math.PI*2); ctx.fillStyle=lc; ctx.fill()

      ctx.restore()

      // Percentage label — elegant mono
      const pctVal = Math.round(progressRef.current * 100)
      ctx.save()
      ctx.font = `400 ${Math.max(11, W * 0.014)}px "DM Mono", monospace`
      ctx.fillStyle = ACCENT
      ctx.textAlign = 'center'
      ctx.fillText(`${pctVal}%`, figX, figY - S * 1.15)
      ctx.restore()

      // Bottom fade to page bg
      const fadeGrad = ctx.createLinearGradient(0, H * 0.65, 0, H)
      fadeGrad.addColorStop(0, 'rgba(14,14,14,0)')
      fadeGrad.addColorStop(1, 'rgba(14,14,14,1)')
      ctx.fillStyle = fadeGrad
      ctx.fillRect(0, H * 0.65, W, H * 0.35)

      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:1, fontFamily:'"DM Mono", monospace' }}>
        <div style={{ background:SURFACE, border:`1px solid ${BORDER}`, padding:'40px 0', textAlign:'center' }}>
          <span style={{ color:MUTED, fontSize:11, letterSpacing:'0.15em', textTransform:'uppercase' }}>Loading</span>
        </div>
      </div>
    )
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const taskPct = stats.tasks_total > 0 ? (stats.tasks_completed / stats.tasks_total) * 100 : 0
  const goalPct = stats.goals_total > 0 ? (stats.goals_completed / stats.goals_total) * 100 : 0
  const appPct  = Math.min((stats.total_applications ?? 0) / 20, 1) * 100
  const pct     = Math.round(taskPct * 0.5 + goalPct * 0.3 + appPct * 0.2)

  const breakdown = stats.status_breakdown || {}
  const total     = Math.max(stats.total_applications || 1, 1)

  const rows = ['Applied','Interviewing','Offered','Rejected'].map(key => ({
    key,
    meta: STATUS_META[key],
    count: breakdown[key] ?? 0,
    pct: Math.round(((breakdown[key] ?? 0) / total) * 100),
  }))

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      fontFamily: '"DM Mono", monospace',
      color: TEXT,
    }}>

      {/* Google Font import via style tag */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Cormorant+Garamond:wght@300;400;500&display=swap');`}</style>

      {error && (
        <div style={{ background:'#1a0f0f', borderBottom:`1px solid #3a1a1a`, padding:'10px 20px' }}>
          <span style={{ color:'#9e6060', fontSize:11, letterSpacing:'0.08em' }}>⚠ {error} — showing empty state</span>
        </div>
      )}

      {/* ── Canvas strip ── */}
      <div style={{ position:'relative', background:'#0e0e0e', borderBottom:`1px solid ${BORDER}` }}>
        <div style={{
          position:'absolute', top:16, left:20, zIndex:1,
          display:'flex', flexDirection:'column', gap:3,
        }}>
          <span style={{ fontSize:10, letterSpacing:'0.18em', color:MUTED, textTransform:'uppercase' }}>
            Progress
          </span>
          <span style={{
            fontSize:28, fontWeight:300, color:ACCENT,
            fontFamily:'"Cormorant Garamond", serif', lineHeight:1,
          }}>
            {pct}<span style={{ fontSize:14, marginLeft:3 }}>%</span>
          </span>
        </div>
        <canvas
          ref={canvasRef}
          style={{ width:'100%', height:'150px', display:'block' }}
        />
      </div>

      {/* ── Four status columns ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:DIM }}>
        {rows.map((row, i) => (
          <div
            key={row.key}
            style={{
              background: SURFACE,
              padding: '24px 20px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transition: 'background 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1c1c1c')}
            onMouseLeave={e => (e.currentTarget.style.background = SURFACE)}
          >
            {/* Abbr + index */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{
                fontSize: 10,
                letterSpacing: '0.20em',
                color: row.meta.color,
                textTransform: 'uppercase',
              }}>
                {row.meta.abbr}
              </span>
              <span style={{ fontSize:10, color:'#333', letterSpacing:'0.1em' }}>
                0{i + 1}
              </span>
            </div>

            {/* Big count */}
            <div style={{
              fontFamily: '"Cormorant Garamond", serif',
              fontSize: 52,
              fontWeight: 300,
              lineHeight: 1,
              color: TEXT,
              letterSpacing: '-0.02em',
            }}>
              {row.count}
            </div>

            {/* Label */}
            <div style={{ fontSize:11, color:MUTED, letterSpacing:'0.12em', textTransform:'uppercase' }}>
              {row.meta.label}
            </div>

            {/* Hairline progress bar */}
            <div style={{ marginTop:'auto', paddingTop:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:9, color:'#444', letterSpacing:'0.1em' }}>SHARE</span>
                <span style={{ fontSize:9, color: row.meta.color, letterSpacing:'0.05em' }}>{row.pct}%</span>
              </div>
              <div style={{ height:1, background:'#222', width:'100%' }}>
                <div style={{
                  height:'100%',
                  background: row.meta.color,
                  width: `${row.pct}%`,
                  transition: 'width 1.4s cubic-bezier(.4,0,.2,1)',
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Summary row ── */}
      <div style={{
        background: DIM,
        borderTop: `1px solid ${BORDER}`,
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gap: 1,
      }}>
        {[
          { label:'Total Applications', value: stats.total_applications ?? 0 },
          { label:'This Week',          value: stats.weekly_applications ?? 0 },
          { label:'Tasks',              value: `${stats.tasks_completed ?? 0} / ${stats.tasks_total ?? 0}` },
        ].map(item => (
          <div key={item.label} style={{ background:SURFACE, padding:'16px 20px', display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:9, letterSpacing:'0.18em', color:'#444', textTransform:'uppercase' }}>
              {item.label}
            </span>
            <span style={{ fontFamily:'"Cormorant Garamond", serif', fontSize:26, fontWeight:300, color:TEXT, letterSpacing:'-0.01em' }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}