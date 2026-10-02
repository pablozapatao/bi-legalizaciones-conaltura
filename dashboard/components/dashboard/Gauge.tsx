'use client'
import { useState, useEffect, useRef } from 'react'
import { T, OR, F, fN } from './brand'

export default function Gauge({ pct: p, meta, onEdit }: { pct: number; meta: number; onEdit: () => void }) {
  const [v, setV] = useState(0)
  const raf = useRef<number>()
  useEffect(() => {
    const target = Math.min(p, 150), t0 = performance.now(), dur = 1200
    const go = (ts: number) => {
      const pr = Math.min((ts - t0) / dur, 1)
      setV(Math.round((1 - Math.pow(1 - pr, 3)) * target))
      if (pr < 1) raf.current = requestAnimationFrame(go)
    }
    raf.current = requestAnimationFrame(go)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [p])

  const R = 48, cx = 64, cy = 58, startDeg = -210, sweep = 240
  const arc = (sd: number, sw: number) => {
    const r = (d: number) => d * Math.PI / 180, a = r(sd), b = r(sd + sw)
    return `M${cx + R * Math.cos(a)} ${cy + R * Math.sin(a)} A${R} ${R} 0 ${sw > 180 ? 1 : 0} 1 ${cx + R * Math.cos(b)} ${cy + R * Math.sin(b)}`
  }
  const fill = Math.min(v, 100) / 100 * sweep
  const col = v >= 90 ? '#166534' : v >= 60 ? '#92400E' : OR
  const lbl = v >= 90 ? 'En meta' : v >= 60 ? 'En riesgo' : 'Crítico'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <svg width="128" height="78" viewBox="0 0 128 78" style={{ overflow: 'visible' }}>
        <path d={arc(startDeg, sweep)} fill="none" stroke="rgba(18,81,96,.08)" strokeWidth="9" strokeLinecap="round" />
        {fill > 0 && <path d={arc(startDeg, fill)} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round" />}
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="22" fontWeight="900" fontFamily={F} fill={T}>{v}%</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="9" fontWeight="600" fontFamily={F} fill={col}>{lbl}</text>
      </svg>
      {meta > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: 'rgba(18,81,96,.06)', border: '1px solid rgba(18,81,96,.1)', marginTop: 4 }}>
          <span style={{ fontSize: 9, color: 'rgba(18,81,96,.45)', textTransform: 'uppercase', letterSpacing: '.07em' }}>meta</span>
          <span style={{ fontSize: 12, fontWeight: 900, color: T }}>{fN(meta)}</span>
          <button onClick={onEdit} className="btn" style={{ fontSize: 9, padding: '1px 7px', color: 'rgba(18,81,96,.45)' }}>editar</button>
        </div>
      ) : (
        <button onClick={onEdit} className="btn" style={{ marginTop: 4 }}>+ Fijar meta</button>
      )}
    </div>
  )
}
