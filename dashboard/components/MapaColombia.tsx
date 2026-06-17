'use client'
import { useState } from 'react'
import type { MapaResponse } from '@/types'
import { fmtNum, fmtDias } from '@/types'

// Contorno simplificado de Colombia (path SVG)
const COLOMBIA_PATH = `
  M 155 30 L 195 25 L 230 35 L 245 55 L 260 65 L 255 85 L 235 90
  L 220 75 L 205 80 L 215 100 L 225 115 L 230 135 L 220 155 L 215 175
  L 225 195 L 220 215 L 210 230 L 215 250 L 205 270 L 195 285
  L 185 300 L 175 315 L 160 330 L 145 340 L 130 330 L 120 315
  L 115 295 L 125 275 L 115 255 L 110 235 L 105 215 L 115 195
  L 110 175 L 100 160 L 95 140 L 100 120 L 110 105 L 105 85
  L 115 70 L 125 55 L 140 40 Z
`

// Coordenadas SVG de cada ciudad sobre el mapa
const CIUDAD_SVG: Record<string, { x: number; y: number }> = {
  'Barranquilla': { x: 175, y: 62 },
  'Cartagena':    { x: 145, y: 78 },
  'Medellín':     { x: 148, y: 200 },
  'Bogotá':       { x: 185, y: 255 },
  'Cali':         { x: 148, y: 295 },
}

export default function MapaColombia({
  data,
  metrica = 'aprobadas',
}: {
  data: MapaResponse
  metrica?: 'aprobadas' | 'pipeline_activo' | 'ventas_caidas'
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [activeMetrica, setActiveMetrica] = useState<typeof metrica>(metrica)

  const maxVal = Math.max(...data.ciudades.map(c => c[activeMetrica] || 0), 1)

  const metricas: { key: typeof metrica; label: string; color: string }[] = [
    { key: 'aprobadas',      label: 'Aprobadas',     color: '#125160' },
    { key: 'pipeline_activo',label: 'En proceso',    color: '#1a7d6e' },
    { key: 'ventas_caidas',  label: 'Caídas',        color: '#991B1B' },
  ]
  const metricaActiva = metricas.find(m => m.key === activeMetrica)!

  return (
    <section>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-40">Distribución</p>
        <h2 className="font-display text-xl font-bold" style={{ color: 'var(--primary)' }}>
          Por ciudad
        </h2>
      </div>

      <div className="card p-5">
        {/* Selector de métrica */}
        <div className="flex gap-2 mb-5">
          {metricas.map(m => (
            <button
              key={m.key}
              onClick={() => setActiveMetrica(m.key)}
              className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
              style={{
                background: activeMetrica === m.key ? m.color : 'var(--beige-dk)',
                color:      activeMetrica === m.key ? 'white' : 'rgba(18,81,96,0.6)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Mapa SVG */}
          <div className="relative shrink-0">
            <svg
              width="300" height="370"
              viewBox="80 20 200 330"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(18,81,96,0.10))' }}
            >
              {/* Fondo del mapa */}
              <path
                d={COLOMBIA_PATH}
                fill="var(--beige-dk)"
                stroke="rgba(18,81,96,0.15)"
                strokeWidth="1.5"
              />

              {/* Burbujas de ciudades */}
              {data.ciudades.map(ciudad => {
                const coords = CIUDAD_SVG[ciudad.ciudad]
                if (!coords) return null
                const val    = ciudad[activeMetrica] || 0
                const r      = val > 0 ? Math.max(8, Math.min(32, (val / maxVal) * 32)) : 6
                const isHov  = hovered === ciudad.ciudad
                const color  = metricaActiva.color

                return (
                  <g key={ciudad.ciudad}
                     onMouseEnter={() => setHovered(ciudad.ciudad)}
                     onMouseLeave={() => setHovered(null)}
                     style={{ cursor: 'pointer' }}>
                    {/* Halo al hover */}
                    {isHov && (
                      <circle cx={coords.x} cy={coords.y} r={r + 6}
                              fill={color} opacity={0.12} />
                    )}
                    {/* Burbuja */}
                    <circle
                      cx={coords.x} cy={coords.y} r={r}
                      fill={color}
                      opacity={val > 0 ? (isHov ? 0.95 : 0.75) : 0.2}
                      style={{ transition: 'all 0.2s' }}
                    />
                    {/* Número dentro si cabe */}
                    {r >= 14 && (
                      <text x={coords.x} y={coords.y + 4} textAnchor="middle"
                            fontSize="10" fontWeight="700" fill="white"
                            fontFamily="var(--font-syne, sans-serif)">
                        {val}
                      </text>
                    )}
                    {/* Punto si burbuja pequeña */}
                    {r < 14 && val > 0 && (
                      <text x={coords.x} y={coords.y - r - 3} textAnchor="middle"
                            fontSize="9" fontWeight="600" fill={color}
                            fontFamily="var(--font-funnel, sans-serif)">
                        {val}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Tooltip de ciudad */}
            {hovered && (() => {
              const c = data.ciudades.find(x => x.ciudad === hovered)
              if (!c) return null
              return (
                <div
                  className="absolute card p-3 text-xs shadow-lg z-10 pointer-events-none w-48"
                  style={{ top: 16, right: -8, transform: 'translateX(100%)' }}
                >
                  <p className="font-bold mb-2" style={{ color: 'var(--primary)' }}>{c.ciudad}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="opacity-50">Aprobadas</span>
                      <span className="font-semibold">{fmtNum(c.aprobadas)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-50">En proceso</span>
                      <span className="font-semibold">{fmtNum(c.pipeline_activo)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-50">Caídas</span>
                      <span className="font-semibold">{fmtNum(c.ventas_caidas)}</span>
                    </div>
                    {c.avg_lead_time != null && (
                      <div className="flex justify-between pt-1 border-t" style={{ borderColor: 'rgba(18,81,96,0.08)' }}>
                        <span className="opacity-50">Tiempo prom.</span>
                        <span className="font-semibold">{fmtDias(c.avg_lead_time)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Tabla de ciudades */}
          <div className="flex-1 min-w-0">
            <table className="tabla-base w-full">
              <thead>
                <tr>
                  <th>Ciudad</th>
                  <th className="text-right">Aprobadas</th>
                  <th className="text-right">En proceso</th>
                  <th className="text-right">Caídas</th>
                  <th className="text-right">Lead time</th>
                </tr>
              </thead>
              <tbody>
                {data.ciudades
                  .sort((a, b) => b.aprobadas - a.aprobadas)
                  .map(c => (
                    <tr key={c.ciudad}
                        onMouseEnter={() => setHovered(c.ciudad)}
                        onMouseLeave={() => setHovered(null)}
                        className="cursor-default"
                        style={{ background: hovered === c.ciudad ? 'rgba(18,81,96,0.04)' : undefined }}>
                      <td className="font-semibold">{c.ciudad}</td>
                      <td className="text-right font-bold" style={{ color: 'var(--success)' }}>
                        {fmtNum(c.aprobadas)}
                      </td>
                      <td className="text-right">{fmtNum(c.pipeline_activo)}</td>
                      <td className="text-right" style={{ color: c.ventas_caidas > 0 ? '#991B1B' : undefined }}>
                        {fmtNum(c.ventas_caidas)}
                      </td>
                      <td className="text-right opacity-70">{fmtDias(c.avg_lead_time)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
