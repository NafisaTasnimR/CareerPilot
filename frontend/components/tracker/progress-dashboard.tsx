'use client'

import { useState, useEffect, useRef } from 'react'

const USER_ID = 'test-user-123'
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const ACCENT  = '#d4a853'
const DIM     = '#2e2e2e'
const MUTED   = '#aaaaaa'    // was #888 — much brighter
const TEXT    = '#ffffff'    // pure white
const SURFACE = '#111111'
const RULE    = '#2e2e2e'    // was #2a — a touch more visible

const STATUS_META = [
  { key: 'Applied',      color: '#6eb5f5' },  // vivid blue
  { key: 'Interviewing',  color: '#d4a853' },  // gold
  { key: 'Offered',       color: '#4dd6a0' },  // vivid teal
  { key: 'Rejected',     color: '#e07575' },  // vivid red
]

export default function ProgressDashboard({ userId, api }: { userId: string; api: string }) {
  const effectiveUserId = USER_ID
  const effectiveApi   = API

  const [stats, setStats]       = useState<any>(null)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [animated, setAnimated] = useState(false)

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rafRef      = useRef<number | null>(null)
  const progressRef = useRef(0)
  const targetRef   = useRef(0)
  const loopStarted = useRef(false)

  useEffect(() => {
    setLoading(true); setError(null)
    fetch(`${effectiveApi}/progress/stats?user_id=${effectiveUserId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => setStats(data && typeof data === 'object' && !Array.isArray(data) ? data : emptyStats()))
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
      canvas.width  = canvas.clientWidth * window.devicePixelRatio
      canvas.height = canvas.clientHeight * window.devicePixelRatio
      loopStarted.current = true
      startLoop(canvas)
    }
    setTimeout(() => setAnimated(true), 150)
  }, [stats])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  function emptyStats() {
    return { total_applications:0, weekly_applications:0, status_breakdown:{},
             tasks_completed:0, tasks_total:0, goals_completed:0, goals_total:0 }
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

      ctx.fillStyle = SURFACE
      ctx.fillRect(0, 0, W, H)

      // Subtle vertical grid
      ctx.save()
      ctx.globalAlpha = 0.04
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 0.5
      for (let i = 1; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(W*i/5, 0); ctx.lineTo(W*i/5, H); ctx.stroke()
      }
      ctx.restore()

      // Track geometry
      const ax0 = -W*0.02, ay0 = H*1.05
      const acx  = W*0.50,  acy = H*0.18
      const ax1  = W*1.02,  ay1 = H*1.05
      const thick = H*0.10

      ctx.beginPath()
      ctx.moveTo(ax0, ay0)
      ctx.quadraticCurveTo(acx, acy, ax1, ay1)
      ctx.quadraticCurveTo(acx, acy+thick, ax0, ay0)
      ctx.closePath()
      ctx.fillStyle = '#181818'
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(ax0, ay0)
      ctx.quadraticCurveTo(acx, acy, ax1, ay1)
      ctx.strokeStyle = '#383838'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Gold progress line
      const progressT = 0.04 + p * 0.80
      ctx.beginPath()
      ctx.moveTo(ax0, ay0)
      for (let t = 0; t <= progressT; t += 0.005) {
        const mt = 1 - t
        ctx.lineTo(mt*mt*ax0 + 2*mt*t*acx + t*t*ax1, mt*mt*ay0 + 2*mt*t*acy + t*t*ay1)
      }
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Milestones
      ;[0.25, 0.5, 0.75].forEach(mt2 => {
        const mt = 1 - mt2
        const rx = mt*mt*ax0 + 2*mt*mt2*acx + mt2*mt2*ax1
        const ry = mt*mt*ay0 + 2*mt*mt2*acy + mt2*mt2*ay1
        const lit = p > mt2 - 0.04
        ctx.beginPath(); ctx.arc(rx, ry, 5, 0, Math.PI*2)
        ctx.strokeStyle = lit ? ACCENT : '#333'; ctx.lineWidth = 1; ctx.stroke()
        ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI*2)
        ctx.fillStyle = lit ? ACCENT : '#222'; ctx.fill()
        ctx.save()
        ctx.font = `400 ${Math.max(10,W*0.012)}px "DM Mono",monospace`
        ctx.fillStyle = lit ? ACCENT : '#555'
        ctx.textAlign = 'center'
        ctx.fillText(`${Math.round(mt2*100)}%`, rx, ry - H*0.07)
        ctx.restore()
      })

      // Target
      const goalT = 0.84, gmt = 1 - goalT
      const goalX = gmt*gmt*ax0 + 2*gmt*goalT*acx + goalT*goalT*ax1
      const goalY = gmt*gmt*ay0 + 2*gmt*goalT*acy + goalT*goalT*ay1
      ctx.save()
      ctx.beginPath(); ctx.moveTo(goalX, goalY); ctx.lineTo(goalX, goalY - H*0.30)
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.setLineDash([3,5]); ctx.stroke()
      ctx.setLineDash([])
      ctx.font = `400 ${Math.max(9,W*0.011)}px "DM Mono",monospace`
      ctx.fillStyle = '#666'; ctx.textAlign = 'center'
      ctx.fillText('TARGET', goalX, goalY - H*0.33)
      ctx.restore()

      // Figure
      const figT = 0.04 + p * 0.80
      const fmt  = 1 - figT
      const figX = fmt*fmt*ax0 + 2*fmt*figT*acx + figT*figT*ax1
      const figY = fmt*fmt*ay0 + 2*fmt*figT*acy + figT*figT*ay1
      const tdx  = 2*(1-figT)*(acx-ax0) + 2*figT*(ax1-acx)
      const tdy  = 2*(1-figT)*(acy-ay0) + 2*figT*(ay1-acy)
      const ang  = Math.atan2(tdy, tdx)
      if (Math.abs(targetRef.current - progressRef.current) > 0.003) legPhase += 0.13

      const S  = H * 0.26
      const sw = Math.sin(legPhase), cw = Math.cos(legPhase)
      const lc = ACCENT

      ctx.save()
      ctx.translate(figX, figY); ctx.rotate(ang)

      // Glow
      ctx.save()
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, S*0.5)
      glow.addColorStop(0, `${ACCENT}28`); glow.addColorStop(1, 'transparent')
      ctx.beginPath(); ctx.ellipse(0, 4, S*0.5, S*0.18, 0, 0, Math.PI*2)
      ctx.fillStyle = glow; ctx.fill(); ctx.restore()

      ctx.save(); ctx.rotate(sw*0.22)
      ctx.beginPath(); ctx.moveTo(S*.04,-S*.18); ctx.quadraticCurveTo(S*.08,-S*.04,S*.12,S*.04)
      ctx.lineWidth=S*.09; ctx.lineCap='round'; ctx.strokeStyle=lc; ctx.stroke()
      ctx.beginPath(); ctx.ellipse(S*.15,S*.04,S*.078,S*.030,.2,0,Math.PI*2); ctx.fillStyle=lc; ctx.fill()
      ctx.restore()

      ctx.save(); ctx.rotate(-sw*0.22)
      ctx.beginPath(); ctx.moveTo(-S*.04,-S*.18); ctx.quadraticCurveTo(-S*.08,-S*.04,-S*.12,S*.04)
      ctx.lineWidth=S*.09; ctx.lineCap='round'; ctx.strokeStyle=lc; ctx.stroke()
      ctx.beginPath(); ctx.ellipse(-S*.15,S*.04,S*.078,S*.030,-.2,0,Math.PI*2); ctx.fillStyle=lc; ctx.fill()
      ctx.restore()

      ctx.beginPath()
      ctx.moveTo(-S*.11,-S*.18); ctx.lineTo(S*.11,-S*.18)
      ctx.lineTo(S*.13,-S*.54); ctx.lineTo(-S*.13,-S*.54); ctx.closePath()
      ctx.fillStyle=lc; ctx.fill()

      ctx.save(); ctx.rotate(cw*.18)
      ctx.beginPath(); ctx.moveTo(S*.11,-S*.48); ctx.lineTo(S*.25,-S*.28)
      ctx.lineWidth=S*.085; ctx.lineCap='round'; ctx.strokeStyle=lc; ctx.stroke(); ctx.restore()
      ctx.save(); ctx.rotate(-cw*.18)
      ctx.beginPath(); ctx.moveTo(-S*.11,-S*.48); ctx.lineTo(-S*.25,-S*.30)
      ctx.lineWidth=S*.085; ctx.lineCap='round'; ctx.strokeStyle=lc; ctx.stroke(); ctx.restore()

      ctx.beginPath(); ctx.rect(-S*.042,-S*.62,S*.084,S*.10); ctx.fillStyle=lc; ctx.fill()
      ctx.beginPath(); ctx.ellipse(0,-S*.77,S*.13,S*.155,0,0,Math.PI*2); ctx.fillStyle=lc; ctx.fill()

      ctx.restore()

      const pctVal = Math.round(progressRef.current*100)
      ctx.save()
      ctx.font = `500 ${Math.max(12,W*0.015)}px "DM Mono",monospace`
      ctx.fillStyle = TEXT; ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 10
      ctx.fillText(`${pctVal}%`, figX, figY - S*1.22)
      ctx.restore()

      const fg = ctx.createLinearGradient(0, H*0.6, 0, H)
      fg.addColorStop(0, `${SURFACE}00`); fg.addColorStop(1, SURFACE)
      ctx.fillStyle = fg; ctx.fillRect(0, H*0.6, W, H*0.4)

      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
  }

  if (loading) return (
    <div style={{ background:SURFACE, padding:'40px 24px', textAlign:'center',
      fontFamily:'"DM Mono",monospace', fontSize:10, letterSpacing:'.18em',
      color:MUTED, textTransform:'uppercase' }}>Loading</div>
  )

  // ── Computed values
  const taskPct = stats.tasks_total > 0 ? (stats.tasks_completed/stats.tasks_total)*100 : 0
  const goalPct = stats.goals_total > 0 ? (stats.goals_completed/stats.goals_total)*100 : 0
  const appPct  = Math.min((stats.total_applications??0)/20,1)*100
  const pct     = Math.round(taskPct*.5 + goalPct*.3 + appPct*.2)

  const breakdown = stats.status_breakdown || {}

  // Always derive total from actual breakdown counts so per-status %
  // is never wrong when total_applications is 0 or mismatched.
  const breakdownSum =
    (breakdown['Applied']      ?? 0) +
    (breakdown['Interviewing'] ?? 0) +
    (breakdown['Offered']      ?? 0) +
    (breakdown['Rejected']     ?? 0)
  // Fall back to total_applications if breakdown is empty
  const total = Math.max(breakdownSum || stats.total_applications || 1, 1)

  const rows = STATUS_META.map(m => {
    const count = breakdown[m.key] ?? 0
    // Real percentage: count / sum-of-all-statuses (never rounds to 0 unfairly)
    const shareOfTotal = total > 0
      ? parseFloat(((count / total) * 100).toFixed(1))
      : 0
    return { ...m, count, shareOfTotal }
  })

  // Bars proportional to max count — widest fills 72%, rest scale relative
  const maxCount = Math.max(...rows.map(r => r.count), 1)

  const responseRate = parseFloat((
    ((breakdown['Interviewing']??0) + (breakdown['Offered']??0) + (breakdown['Rejected']??0)) / total * 100
  ).toFixed(1))
  const offerRate = parseFloat(((breakdown['Offered']??0) / total * 100).toFixed(1))

  const metricCards = [
    { label: 'Total',         value: String(total),                          color: TEXT },
    { label: 'This week',     value: `+${stats.weekly_applications ?? 0}`,   color: ACCENT },
    { label: 'Response rate', value: `${responseRate}%`,                     color: TEXT },
    { label: 'Offer rate',    value: `${offerRate}%`,                        color: '#4dd6a0' },
    { label: 'Tasks done',    value: `${stats.tasks_completed ?? 0} / ${stats.tasks_total ?? 0}`, color: TEXT },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column',
      fontFamily:'"DM Mono",monospace', color:TEXT, background:SURFACE }}>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Cormorant+Garamond:wght@300;400&display=swap');`}</style>

      {error && (
        <div style={{ background:'#1a0f0f', borderBottom:`1px solid #3a1a1a`,
          padding:'8px 24px', fontSize:10, color:'#c47a7a', letterSpacing:'.08em' }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Canvas strip ── */}
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', top:18, left:24, zIndex:1 }}>
          <div style={{ fontSize:9, letterSpacing:'.22em', color:'#bbbbbb',
            textTransform:'uppercase', marginBottom:5 }}>Overall progress</div>
          <div style={{ fontFamily:'"Cormorant Garamond",serif', fontSize:36,
            fontWeight:300, color:ACCENT, lineHeight:1 }}>
            {pct}<span style={{ fontSize:15, marginLeft:3, color:`${ACCENT}88` }}>%</span>
          </div>
        </div>
        <canvas ref={canvasRef} style={{ width:'100%', height:'160px', display:'block' }} />
      </div>

      <div style={{ height:1, background:DIM }} />

      {/* ── Two-column body: pipeline left | metrics right ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 200px' }}>

        {/* LEFT — pipeline rows */}
        <div style={{ borderRight:`1px solid ${DIM}` }}>

          <div style={{ display:'flex', alignItems:'baseline',
            justifyContent:'space-between', padding:'16px 24px 12px',
            borderBottom:`1px solid ${RULE}` }}>
            <span style={{ fontSize:9, letterSpacing:'.22em', color:'#cccccc',
              textTransform:'uppercase' }}>Pipeline</span>
            <span style={{ fontSize:10, color:'#888', letterSpacing:'.04em' }}>
              {total} total
            </span>
          </div>

          {rows.map((row) => {
            // Bar fills to 70% of container max so the widest bar doesn't crowd the label
            const barPct = Math.round((row.count / maxCount) * 70)

            return (
              <div key={row.key}
                style={{ display:'grid', gridTemplateColumns:'100px 1fr 56px',
                  alignItems:'center', padding:'0 24px',
                  borderBottom:`1px solid ${RULE}`,
                  transition:'background .15s', cursor:'default' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#181818')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Label */}
                <div style={{ padding:'18px 0', display:'flex', flexDirection:'column', gap:5 }}>
                  <span style={{ fontSize:9, letterSpacing:'.20em', color:row.color,
                    textTransform:'uppercase', fontWeight:500 }}></span>
                  <span style={{ fontSize:12, letterSpacing:'.06em', color:'#dddddd' }}>{row.key}</span>
                </div>

                {/* Bar — proportional to max count */}
                <div style={{ padding:'18px 20px' }}>
                  <div style={{ height:1.5, background:RULE, position:'relative', borderRadius:1 }}>
                    <div style={{
                      height:'100%', position:'absolute', left:0, top:0, borderRadius:1,
                      background: row.color,
                      width: animated ? `${barPct}%` : '0%',
                      transition:'width 1.8s cubic-bezier(.4,0,.2,1)',
                    }} />
                    <div style={{
                      width:6, height:6, borderRadius:'50%',
                      position:'absolute', top:-2.25,
                      background: row.color,
                      boxShadow:`0 0 7px ${row.color}bb`,
                      left: animated ? `calc(${barPct}% - 3px)` : '-3px',
                      transition:'left 1.8s cubic-bezier(.4,0,.2,1)',
                    }} />
                  </div>
                </div>

                {/* Count + real % of total */}
                <div style={{ textAlign:'right', padding:'18px 0' }}>
                  <div style={{ fontFamily:'"Cormorant Garamond",serif', fontSize:42,
                    fontWeight:400, lineHeight:1, letterSpacing:'-.02em', color:'#ffffff' }}>
                    {row.count}
                  </div>
                  <div style={{ fontSize:10, letterSpacing:'.08em', color:row.color,
                    marginTop:4, fontWeight:500 }}>
                    {row.shareOfTotal}%
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* RIGHT — metric stack */}
        <div style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'16px 20px 12px', borderBottom:`1px solid ${RULE}` }}>
            <span style={{ fontSize:9, letterSpacing:'.22em', color:'#cccccc',
              textTransform:'uppercase' }}>At a glance</span>
          </div>

          {metricCards.map((m, i) => (
            <div key={m.label} style={{
              padding:'14px 20px',
              borderBottom: i < metricCards.length - 1 ? `1px solid ${RULE}` : 'none',
              flex:1,
              display:'flex', flexDirection:'column', justifyContent:'center', gap:5,
            }}>
              <div style={{ fontSize:9, letterSpacing:'.18em', color:'#aaaaaa',
                textTransform:'uppercase' }}>{m.label}</div>
              <div style={{ fontFamily:'"Cormorant Garamond",serif', fontSize:28,
                fontWeight:400, color: m.color, letterSpacing:'-.01em',
                lineHeight:1 }}>{m.value}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}