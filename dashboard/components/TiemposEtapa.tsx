'use client'
import type { TiemposResponse } from '@/types'
import { STAGE_LABELS, fmtDias, fmtNum } from '@/types'

// Semáforo de velocidad en lenguaje natural
function SemaforoTexto({ avg, p50, p90 }: { avg: number | null; p50: number | null; p90: number | null }) {
  if (!p50) return <span className="text-xs opacity-40">Sin datos suficientes</span>
  const color = p50 <= 15 ? 'var(--success)' : p50 <= 30 ? 'var(--warning)' : 'var(--coral)'
  const texto = p50 <= 15 ? 'Proceso rápido' : p50 <= 30 ? 'Proceso normal' : 'Proceso lento'
  return (
    <span className="text-xs font-semibold" style={{ color }}>● {texto}</span>
  )
}

// Barra de rango visual con zonas de color
function BarraRango({ avg, p50, p90, max }: { avg: number | null; p50: number | null; p90: number | null; max: number }) {
  if (!avg && !p50) return <div className="h-2 rounded-full opacity-10" style={{ background: 'var(--primary)' }} />

  const escala = max || 60
  const pctP50 = Math.min(((p50 || 0) / escala) * 100, 100)
  const pctP90 = Math.min(((p90 || 0) / escala) * 100, 100)
  const pctAvg = Math.min(((avg || 0) / escala) * 100, 100)

  return (
    <div className="relative h-3 rounded-full overflow-visible" style={{ background: 'var(--beige-dk)' }}>
      {/* Zona verde 0-15d */}
      <div className="absolute inset-y-0 left-0 rounded-l-full opacity-30"
           style={{ width: `${Math.min(15/escala*100,100)}%`, background: 'var(--success)' }} />
      {/* Zona amarilla 15-30d */}
      <div className="absolute inset-y-0 opacity-20"
           style={{
             left: `${Math.min(15/escala*100,100)}%`,
             width: `${Math.max(0, Math.min(15/escala*100, 100-15/escala*100))}%`,
             background: 'var(--warning)',
           }} />
      {/* Marcador p50 */}
      {p50 != null && (
        <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
             style={{ left: `${pctP50}%`, background: '#125160', opacity: 0.7 }}
             title={`Mediana: ${p50}d`} />
      )}
      {/* Marcador p90 */}
      {p90 != null && (
        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
             style={{ left: `${pctP90}%`, background: 'var(--coral)', opacity: 0.6 }}
             title={`P90: ${p90}d`} />
      )}
      {/* Punto promedio */}
      {avg != null && (
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
             style={{ left: `${pctAvg}%`, background: '#125160', transform: 'translate(-50%, -50%)' }}
             title={`Promedio: ${avg}d`} />
      )}
    </div>
  )
}

// Ranking de proyectos por velocidad
function RankingProyectos({ data }: { data: TiemposResponse }) {
  const proyectos = data.por_proyecto.slice(0, 10)
  if (!proyectos.length) return null
  const maxLt = Math.max(...proyectos.map(p => p.avg_lead_time || 0), 1)

  return (
    <div className="card p-5 mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide opacity-40 mb-4">
        Velocidad por proyecto — promedio de días hasta aprobación
      </p>
      <div className="space-y-3">
        {proyectos.map(p => {
          const color = p.semaforo === 'verde' ? 'var(--success)'
                      : p.semaforo === 'amarillo' ? 'var(--warning)'
                      : p.semaforo === 'rojo' ? 'var(--coral)'
                      : 'rgba(18,81,96,0.3)'
          return (
            <div key={p.proyecto}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs font-semibold truncate max-w-[180px]">{p.proyecto}</span>
                  <span className="text-xs opacity-40">({fmtNum(p.n)})</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold">{fmtDias(p.avg_lead_time)}</span>
                  {p.p50_lead_time != null && (
                    <span className="text-xs opacity-40 ml-1">med. {fmtDias(p.p50_lead_time)}</span>
                  )}
                </div>
              </div>
              {/* Barra proporcional */}
              <div className="h-1.5 rounded-full" style={{ background: 'var(--beige-dk)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${((p.avg_lead_time || 0) / maxLt) * 100}%`,
                    background: color,
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {/* Leyenda de zonas */}
      <div className="flex gap-4 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(18,81,96,0.06)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} />
          <span className="text-xs opacity-50">Rápido (≤15d)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--warning)' }} />
          <span className="text-xs opacity-50">Normal (16–30d)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--coral)' }} />
          <span className="text-xs opacity-50">Lento (&gt;30d)</span>
        </div>
      </div>
    </div>
  )
}

export default function TiemposEtapa({ data }: { data: TiemposResponse }) {
  const global = data.global
  const maxDias = Math.max(...data.por_stage.map(s => s.p90_dias || 0), 60)

  return (
    <section>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-40">Velocidad del proceso</p>
        <h2 className="font-display text-xl font-bold" style={{ color: 'var(--primary)' }}>
          Tiempos de legalización
        </h2>
      </div>

      {/* Resumen global */}
      {global.p50_lead_time != null && (
        <div className="card p-5 mb-4">
          <div className="flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-xs opacity-40 mb-0.5">La mitad se aprueba en menos de</p>
              <p className="font-display text-4xl font-bold" style={{ color: 'var(--primary)' }}>
                {global.p50_lead_time} <span className="text-xl font-normal opacity-60">días</span>
              </p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-xs opacity-40">Promedio</p>
                <p className="text-xl font-bold font-display">{fmtDias(global.avg_lead_time)}</p>
              </div>
              <div>
                <p className="text-xs opacity-40">El 90% en menos de</p>
                <p className="text-xl font-bold font-display">{fmtDias(global.p90_lead_time)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tiempos por stage */}
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-40 mb-4">
          Duración promedio por etapa
        </p>
        <div className="space-y-4">
          {data.por_stage.filter(s => s.n > 0).map(stage => (
            <div key={stage.stage}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{STAGE_LABELS[stage.stage] ?? stage.stage}</span>
                  <span className="text-xs opacity-40">({fmtNum(stage.n)} registros)</span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <SemaforoTexto avg={stage.avg_dias} p50={stage.p50_dias} p90={stage.p90_dias} />
                  <span className="text-xs font-bold">{fmtDias(stage.avg_dias)}</span>
                </div>
              </div>
              <BarraRango avg={stage.avg_dias} p50={stage.p50_dias} p90={stage.p90_dias} max={maxDias} />
              <div className="flex gap-3 mt-1">
                <span className="text-xs opacity-30">Mediana: {fmtDias(stage.p50_dias)}</span>
                <span className="text-xs opacity-30">P90: {fmtDias(stage.p90_dias)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Clave de lectura */}
        <div className="mt-5 pt-4 border-t flex flex-wrap gap-4" style={{ borderColor: 'rgba(18,81,96,0.06)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-white" style={{ background: '#125160' }} />
            <span className="text-xs opacity-50">Punto = promedio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4 rounded-full" style={{ background: '#125160', opacity: 0.7 }} />
            <span className="text-xs opacity-50">Barra gruesa = mediana</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4 rounded-full" style={{ background: 'var(--coral)', opacity: 0.6 }} />
            <span className="text-xs opacity-50">Barra fina = P90 (el 10% más lento)</span>
          </div>
        </div>
      </div>

      <RankingProyectos data={data} />
    </section>
  )
}
