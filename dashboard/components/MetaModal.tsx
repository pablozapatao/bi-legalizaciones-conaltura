'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { MES_NAMES } from '@/types'

export default function MetaModal({
  anio,
  mes,
  metaActual,
  onClose,
  onSaved,
}: {
  anio: number
  mes: number
  metaActual: number
  onClose: () => void
  onSaved: (meta: number) => void
}) {
  const [valor, setValor] = useState(metaActual > 0 ? String(metaActual) : '')
  const [saving, setSaving] = useState(false)

  async function handleGuardar() {
    const n = parseInt(valor, 10)
    if (isNaN(n) || n < 0) {
      toast.error('Ingresa un número válido')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/metas/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio, mes, meta_negocios: n }),
      })
      if (!res.ok) throw new Error('Error guardando')
      toast.success(`Meta ${MES_NAMES[mes]} ${anio} → ${n.toLocaleString('es-CO')}`)
      onSaved(n)
      onClose()
    } catch {
      toast.error('No se pudo guardar la meta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(18,81,96,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card p-6 w-full max-w-sm">
        <h3 className="font-display text-lg font-bold mb-1" style={{ color: 'var(--primary)' }}>
          Meta de legalizaciones
        </h3>
        <p className="text-xs opacity-50 mb-5">
          {MES_NAMES[mes]} {anio} · número objetivo de aprobaciones (exitosas + con novedades)
        </p>

        <label className="block text-xs font-semibold uppercase tracking-wide mb-2 opacity-60">
          Número de legalizaciones objetivo
        </label>
        <input
          type="number"
          min="0"
          value={valor}
          onChange={e => setValor(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleGuardar()}
          className="w-full px-4 py-3 rounded-lg border text-lg font-bold focus:outline-none focus:ring-2 mb-4"
          style={{
            borderColor: 'rgba(18,81,96,0.2)',
            background: 'white',
            color: 'var(--primary)',
          }}
          placeholder="ej. 150"
          autoFocus
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
            style={{ background: 'var(--beige-dk)', color: 'rgba(18,81,96,0.6)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving || !valor}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
            style={{
              background: 'var(--accent-lt)',
              color: 'var(--primary)',
              opacity: (saving || !valor) ? 0.5 : 1,
            }}
          >
            {saving ? 'Guardando…' : 'Guardar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}
