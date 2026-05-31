'use client'

import { useState, useEffect, useRef } from 'react'

export default function ProgressDashboard({ userId, api }: { userId: string; api: string }) {
  const [stats, setStats] = useState<any>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rafRef      = useRef<number | null>(null)
  const progressRef = useRef(0)
  const targetRef   = useRef(0)
  const loopStarted = useRef(false)

  useEffect(() => {
    fetch(`${api}/progress/stats?user_id=${userId}`)
      .then(r => r.json()).then(setStats).catch(console.error)
  }, [])

  useEffect(() => {
    if (!stats) return
    const taskPct = stats.tasks_total > 0 ? (stats.tasks_completed / stats.tasks_total) * 100 : 0
    const goalPct = stats.goals_total > 0 ? (stats.goals_completed / stats.goals_total) * 100 : 0
    const appPct  = Math.min(stats.total_applications / 20, 1) * 100
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

      // ── SKY ──────────────────────────────────────────────────────
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H)
      skyGrad.addColorStop(0,    '#5e8fae')
      skyGrad.addColorStop(0.55, '#8ab4cc')
      skyGrad.addColorStop(0.78, '#a8c8dc')
      skyGrad.addColorStop(1,    '#1c1c1c')   // fade into card bg
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, W, H)

      // Atmospheric lines
      ctx.save()
      ctx.globalAlpha = 0.06
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      for (let i = 0; i < 18; i++) {
        const y  = H * 0.03 + i * H * 0.048
        const cx = W * (0.25 + Math.sin(i * 0.9) * 0.28)
        ctx.beginPath()
        ctx.moveTo(-W * 0.05, y + Math.sin(i * 0.5) * 6)
        ctx.bezierCurveTo(cx, y - 14, W - cx, y + 10, W * 1.05, y + Math.cos(i * 0.5) * 6)
        ctx.stroke()
      }
      ctx.restore()

      // ── ARCH — full width, low dramatic angle ─────────────────────
      // Starts bottom-left, peaks upper-center, ends bottom-right
      const ax0 = -W * 0.04,  ay0 = H * 1.1
      const acx  = W * 0.50,  acy  = H * 0.12
      const ax1  = W * 1.04,  ay1  = H * 1.1

      const thick = H * 0.16

      ctx.beginPath()
      ctx.moveTo(ax0, ay0)
      ctx.quadraticCurveTo(acx, acy, ax1, ay1)
      ctx.quadraticCurveTo(acx, acy + thick, ax0, ay0)
      ctx.closePath()
      const ag = ctx.createLinearGradient(W * 0.5, acy, W * 0.5, ay0)
      ag.addColorStop(0,   '#1a1e2c')
      ag.addColorStop(0.4, '#22273a')
      ag.addColorStop(1,   '#0c0f18')
      ctx.fillStyle = ag
      ctx.fill()

      // Top edge
      ctx.beginPath()
      ctx.moveTo(ax0, ay0)
      ctx.quadraticCurveTo(acx, acy, ax1, ay1)
      ctx.strokeStyle = '#38425a'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Railings — full arch, both sides
      ctx.save()
      ctx.globalAlpha = 0.45
      const posts: [number,number][] = []
      for (let i = 0; i <= 16; i++) {
        const t  = 0.05 + i * (0.90 / 16)
        const mt = 1 - t
        const rx = mt*mt*ax0 + 2*mt*t*acx + t*t*ax1
        const ry = mt*mt*ay0 + 2*mt*t*acy + t*t*ay1
        posts.push([rx, ry])
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry - H*0.07)
        ctx.strokeStyle = '#48556e'; ctx.lineWidth = 1.5; ctx.stroke()
      }
      // Top handrail
      ctx.beginPath()
      posts.forEach(([rx,ry],i) => i===0 ? ctx.moveTo(rx, ry-H*0.07) : ctx.lineTo(rx, ry-H*0.07))
      ctx.strokeStyle = '#38455e'; ctx.lineWidth = 1.2; ctx.stroke()
      ctx.restore()

      // ── GOAL MARKER at arch end ───────────────────────────────────
      const goalT  = 0.84
      const gmt    = 1 - goalT
      const goalX  = gmt*gmt*ax0 + 2*gmt*goalT*acx + goalT*goalT*ax1
      const goalY  = gmt*gmt*ay0 + 2*gmt*goalT*acy + goalT*goalT*ay1
      const flagH  = H * 0.22

      // Pole glow
      ctx.save()
      ctx.shadowColor = 'rgba(226,75,74,0.5)'
      ctx.shadowBlur  = 12

      // Flag pole
      ctx.beginPath()
      ctx.moveTo(goalX, goalY)
      ctx.lineTo(goalX, goalY - flagH)
      ctx.strokeStyle = '#c0c8d8'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Flag body
      ctx.beginPath()
      ctx.moveTo(goalX, goalY - flagH)
      ctx.lineTo(goalX - W * 0.075, goalY - flagH + H * 0.05)
      ctx.lineTo(goalX, goalY - flagH + H * 0.10)
      ctx.closePath()
      ctx.fillStyle = '#E24B4A'
      ctx.fill()
      ctx.restore()

      // "GOAL" text — bright, prominent
      ctx.save()
      ctx.font = `700 ${Math.max(13, W * 0.018)}px -apple-system, sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur  = 8
      ctx.fillText('GOAL', goalX - W * 0.025, goalY - flagH - H * 0.03)
      ctx.restore()

      // ── FIGURE ───────────────────────────────────────────────────
      // Full arch: figure goes from left base (t≈0.04) to right base (t≈0.96)
      const figT = 0.04 + p * 0.92
      const fmt  = 1 - figT
      const figX = fmt*fmt*ax0 + 2*fmt*figT*acx + figT*figT*ax1
      const figY = fmt*fmt*ay0 + 2*fmt*figT*acy + figT*figT*ay1
      const tdx  = 2*(1-figT)*(acx-ax0) + 2*figT*(ax1-acx)
      const tdy  = 2*(1-figT)*(acy-ay0) + 2*figT*(ay1-acy)
      const ang  = Math.atan2(tdy, tdx)

      if (Math.abs(targetRef.current - progressRef.current) > 0.003) legPhase += 0.13

      const S  = H * 0.26
      const fc = '#0a0c16'

      ctx.save()
      ctx.translate(figX, figY)
      ctx.rotate(ang)

      // Shadow
      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.scale(1, 0.2)
      ctx.beginPath()
      ctx.ellipse(0, 6, S*0.22, S*0.1, 0, 0, Math.PI*2)
      ctx.fillStyle = '#000'; ctx.fill()
      ctx.restore()

      const sw = Math.sin(legPhase), cw = Math.cos(legPhase)

      // Back leg
      ctx.save(); ctx.rotate(sw*0.2)
      ctx.beginPath(); ctx.moveTo(S*0.04,-S*0.2); ctx.quadraticCurveTo(S*0.09,-S*0.05,S*0.13,S*0.04)
      ctx.lineWidth=S*0.1; ctx.lineCap='round'; ctx.strokeStyle=fc; ctx.stroke()
      ctx.beginPath(); ctx.ellipse(S*0.16,S*0.04,S*0.085,S*0.032,0.2,0,Math.PI*2)
      ctx.fillStyle=fc; ctx.fill(); ctx.restore()

      // Front leg
      ctx.save(); ctx.rotate(-sw*0.2)
      ctx.beginPath(); ctx.moveTo(-S*0.04,-S*0.2); ctx.quadraticCurveTo(-S*0.09,-S*0.05,-S*0.13,S*0.04)
      ctx.lineWidth=S*0.1; ctx.lineCap='round'; ctx.strokeStyle=fc; ctx.stroke()
      ctx.beginPath(); ctx.ellipse(-S*0.16,S*0.04,S*0.085,S*0.032,-0.2,0,Math.PI*2)
      ctx.fillStyle=fc; ctx.fill(); ctx.restore()

      // Torso
      ctx.beginPath()
      ctx.moveTo(-S*0.12,-S*0.2); ctx.lineTo(S*0.12,-S*0.2)
      ctx.lineTo(S*0.15,-S*0.58); ctx.lineTo(-S*0.15,-S*0.58); ctx.closePath()
      ctx.fillStyle=fc; ctx.fill()

      // Backpack — on the BACK (negative x, behind torso)
      ctx.beginPath(); ctx.rect(-S*0.31,-S*0.56,S*0.19,S*0.3)
      ctx.fillStyle='#161c2a'; ctx.fill()
      ctx.beginPath(); ctx.moveTo(-S*0.12,-S*0.54); ctx.quadraticCurveTo(-S*0.08,-S*0.4,-S*0.05,-S*0.3)
      ctx.lineWidth=S*0.035; ctx.strokeStyle='#161c2a'; ctx.stroke()

      // Arms
      ctx.save(); ctx.rotate(cw*0.18)
      ctx.beginPath(); ctx.moveTo(S*0.11,-S*0.5); ctx.lineTo(S*0.23,-S*0.3)
      ctx.lineWidth=S*0.09; ctx.lineCap='round'; ctx.strokeStyle=fc; ctx.stroke(); ctx.restore()
      ctx.save(); ctx.rotate(-cw*0.18)
      ctx.beginPath(); ctx.moveTo(-S*0.11,-S*0.5); ctx.lineTo(-S*0.23,-S*0.32)
      ctx.lineWidth=S*0.09; ctx.lineCap='round'; ctx.strokeStyle=fc; ctx.stroke(); ctx.restore()

      // Neck
      ctx.beginPath(); ctx.rect(-S*0.045,-S*0.66,S*0.09,S*0.1); ctx.fillStyle=fc; ctx.fill()

      // Head
      ctx.beginPath(); ctx.ellipse(0,-S*0.82,S*0.13,S*0.16,0,0,Math.PI*2); ctx.fillStyle=fc; ctx.fill()

      // Cap
      ctx.beginPath(); ctx.ellipse(0,-S*0.96,S*0.12,S*0.05,0,Math.PI,Math.PI*2); ctx.fillStyle=fc; ctx.fill()
      ctx.beginPath(); ctx.moveTo(-S*0.02,-S*0.96); ctx.lineTo(S*0.21,-S*0.92)
      ctx.lineTo(S*0.17,-S*0.88); ctx.lineTo(-S*0.02,-S*0.92); ctx.fillStyle=fc; ctx.fill()

      ctx.restore()

      // % label above figure (hide near start/end to avoid overlap)
      const pctVal = Math.round(progressRef.current * 100)
      ctx.save()
      ctx.font = `500 ${Math.max(12,W*0.016)}px -apple-system, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur = 6
      ctx.fillText(`${pctVal}%`, figX, figY - S * 1.2)
      ctx.restore()

      // ── BOTTOM FADE into dark bg ──────────────────────────────────
      const fadeGrad = ctx.createLinearGradient(0, H*0.72, 0, H)
      fadeGrad.addColorStop(0, 'rgba(28,28,28,0)')
      fadeGrad.addColorStop(1, 'rgba(28,28,28,1)')
      ctx.fillStyle = fadeGrad
      ctx.fillRect(0, H*0.72, W, H*0.28)

      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
  }

  if (!stats) return <p style={{ color: '#6b7280' }}>Loading stats...</p>

  const taskPct = stats.tasks_total > 0 ? (stats.tasks_completed / stats.tasks_total) * 100 : 0
  const goalPct = stats.goals_total > 0 ? (stats.goals_completed / stats.goals_total) * 100 : 0
  const appPct  = Math.min(stats.total_applications / 20, 1) * 100
  const pct     = Math.round(taskPct * 0.5 + goalPct * 0.3 + appPct * 0.2)
  const total   = stats.total_applications || 1

  const statCards = [
    { label: 'Total applications', value: stats.total_applications },
    { label: 'This week',          value: stats.weekly_applications },
    { label: 'Tasks completed',    value: `${stats.tasks_completed}/${stats.tasks_total}` },
    { label: 'Roadmap progress',   value: `${pct}%` },
  ]

  const statusColors: Record<string, string> = {
    Applied: '#1D9E75', Interviewing: '#534AB7', Offered: '#BA7517', Rejected: '#A32D2D',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {statCards.map(card => (
          <div key={card.label} style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'white' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 0' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
            Your journey — {pct}% to goal
          </p>
        </div>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '280px', display: 'block' }}
        />
      </div>

      <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 16, padding: '16px 20px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px 0' }}>
          Application status breakdown
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {Object.entries(stats.status_breakdown || {}).map(([status, count]: any) => {
            const barColor = statusColors[status] || '#6b7280'
            const w = Math.round((count / total) * 100)
            return (
              <div key={status} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: 'white' }}>{count}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 8px' }}>{status}</div>
                <div style={{ height: 4, background: '#2a2a2a', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: barColor, width: `${w}%`, transition: 'width 1.2s cubic-bezier(.4,0,.2,1)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}