'use client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { TendenciaResponse } from '@/types'
import { fmtNum } from '@/types'

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'white',
    border: '1px solid rgba(18,81,96,0.12)',
    borderRadius: 10,
    fontSize: 12,
    fontFamily: 'var(--font-funnel, sans-serif)',
    boxShadow: '0 4px 12px rgba(18,81,96,0.08)',
  },
  labelStyle: { color: '#125160', fontWeight: 700, marginBottom: 4 },
}

export default function TendenciaMensual({ data }: { data: TendenciaResponse }) {
  const chartData = data.meses.map(m => ({
    label:       m.label,
    aprobadas:   m.aprobadas,
    rechazadas:  m.rechazadas,
    caidas:      m.ventas_caidas,
    meta:        m.meta || null,
    pct:         m.pct_cumplimiento,
  }))

  // Máximo para escala Y
  const maxVal = Math.max(...chartData.map(d => Math.max(d.aprobadas, d.meta || 0, d.rechazadas)))

  return (
    <section>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-40">Tendencia</p>
        <h2 className="font-display text-xl font-bold" style={{ color: 'var(--primary)' }}>
          Últimos {data.periodos} meses
        </h2>
      </div>

      <div className="card p-5">
        {/* Leyenda */}
        <div className="flex flex-wrap gap-4 mb-4">
          {[
            { color: '#125160', label: 'Aprobadas' },
            { color: 'var(--coral)', label: 'Rechazadas' },
            { color: '#991B1B', label: 'Caídas' },
            { color: 'var(--accent)', label: 'Meta', dashed: true },
          ].map(({ color, label, dashed }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="h-0.5 w-5" style={{
                background: color,
                borderTop: dashed ? `2px dashed ${color}` : undefined,
                height: dashed ? 0 : undefined,
              }} />
              <span className="text-xs opacity-60">{label}</span>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAprobadas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#125160" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#125160" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,81,96,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'rgba(18,81,96,0.5)', fontFamily: 'var(--font-funnel, sans-serif)' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              domain={[0, Math.ceil(maxVal * 1.15)]}
              tick={{ fontSize: 10, fill: 'rgba(18,81,96,0.4)', fontFamily: 'var(--font-funnel, sans-serif)' }}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(val: number, name: string) => [
                fmtNum(val),
                name === 'aprobadas' ? 'Aprobadas'
                  : name === 'rechazadas' ? 'Rechazadas'
                  : name === 'caidas' ? 'Caídas'
                  : 'Meta',
              ]}
            />
            {/* Línea de meta (dashed) */}
            <Area
              type="monotone" dataKey="meta"
              stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="5 3"
              fill="none" dot={false} connectNulls
            />
            {/* Área aprobadas */}
            <Area
              type="monotone" dataKey="aprobadas"
              stroke="#125160" strokeWidth={2}
              fill="url(#gradAprobadas)"
              dot={{ fill: '#125160', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#125160' }}
            />
            {/* Rechazadas */}
            <Area
              type="monotone" dataKey="rechazadas"
              stroke="var(--coral)" strokeWidth={1.5}
              fill="none"
              dot={{ fill: 'var(--coral)', r: 2, strokeWidth: 0 }}
            />
            {/* Caídas */}
            <Area
              type="monotone" dataKey="caidas"
              stroke="#991B1B" strokeWidth={1.5}
              fill="none"
              dot={{ fill: '#991B1B', r: 2, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
