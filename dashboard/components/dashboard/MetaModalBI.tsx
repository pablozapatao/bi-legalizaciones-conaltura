'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { T, B, A, F, MESF, fN } from './brand'

export default function MetaModalBI({ anio, mes, actual, onClose, onSaved }: {
  anio: number; mes: number; actual: number; onClose: () => void; onSaved: (n: number) => void
}) {
  const [v, setV] = useState(actual > 0 ? String(actual) : '')
  const [s, setS] = useState(false)
  async function save() {
    const x = parseInt(v, 10)
    if (isNaN(x) || x < 0) return
    setS(true)
    try {
      await fetch('/api/metas/upsert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anio, mes, meta_negocios: x }) })
      onSaved(x); onClose(); toast.success(`Meta ${MESF[mes]} ${anio} → ${fN(x)}`)
    } finally { setS(false) }
  }
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(18,81,96,.35)', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(18,81,96,.18)', border: '1px solid rgba(18,81,96,.1)', fontFamily: F }}>
        <h3 style={{ fontSize: 18, fontWeight: 900, color: T, marginBottom: 4 }}>Meta de legalizaciones</h3>
        <p style={{ fontSize: 12, color: 'rgba(18,81,96,.5)', marginBottom: 20 }}>{MESF[mes]} {anio} · número objetivo de aprobaciones del mes</p>
        <label className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>Objetivo (unidades)</label>
        <input type="number" min="0" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} autoFocus placeholder="ej. 150"
          style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: '1.5px solid rgba(18,81,96,.18)', fontSize: 22, fontWeight: 900, color: T, background: B, marginBottom: 14, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }}>Cancelar</button>
          <button onClick={save} disabled={s || !v} className="btn btn-cta" style={{ flex: 1, justifyContent: 'center', padding: '10px 0', background: A }}>{s ? 'Guardando…' : 'Guardar meta'}</button>
        </div>
      </div>
    </div>
  )
}
