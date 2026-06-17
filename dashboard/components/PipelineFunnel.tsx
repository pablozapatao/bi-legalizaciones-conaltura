'use client'
import type { PipelineResponse } from '@/types'
import { fmtNum } from '@/types'

const STAGE_COLORS = [
  'var(--stage1)', 'var(--stage2)', 'var(--stage3)', 'var(--stage4)',
]

export default function PipelineFunnel({ data }: { data: PipelineResponse }) {
  const total = data.total_pipeline || 1

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-40">Pipeline activo</p>
          <h2 className="font-display text-xl font-bold" style={{ color: 'var(--primary)' }}>
            {fmtNum(data.total_pipeline)} en proceso
          </h2>
        </div>
        {data.caidas_del_mes > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
               style={{ background: 'rgba(153,27,27,0.1)' }}>
            <span className="text-xs font-bold" style={{ color: '#991B1B' }}>
              {data.caidas_del_mes}
            </span>
            <span className="text-xs" style={{ color: '#991B1B' }}>ventas caídas este mes</span>
          </div>
        )}
      </div>

      {/* Timeline horizontal proporcional */}
      <div className="card p-5">
        {/* Barras */}
        <div className="flex gap-1 h-14 mb-4 rounded-lg overflow-hidden">
          {data.stages.map((stage, i) => {
            const pct = (stage.count / total) * 100
            if (pct < 0.5) return null
            return (
              <div
                key={stage.etapa_codigo}
                className="relative flex items-center justify-center rounded-md transition-all duration-700 group"
                style={{ flex: stage.count, background: STAGE_COLORS[i], minWidth: '4px' }}
                title={`${stage.etapa_label}: ${stage.count}`}
              >
                {pct > 8 && (
                  <span className="text-white text-sm font-bold font-display">
                    {stage.count}
                  </span>
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                  <div className="card px-3 py-2 text-xs whitespace-nowrap shadow-lg">
                    <p className="font-semibold">{stage.etapa_label}</p>
                    <p className="opacity-60">{stage.count} legalizaciones · {pct.toFixed(1)}%</p>
                    {stage.aging_promedio != null && (
                      <p className="opacity-60">{stage.aging_promedio}d promedio en esta etapa</p>
                    )}
                  </div>
                  <div className="w-2 h-2 rotate-45 -mt-1" style={{ background: 'white', border: '1px solid rgba(18,81,96,0.1)' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Leyenda */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.stages.map((stage, i) => (
            <div key={stage.etapa_codigo} className="flex items-start gap-2">
              <div className="w-2.5 h-2.5 rounded-sm mt-0.5 shrink-0"
                   style={{ background: STAGE_COLORS[i] }} />
              <div>
                <p className="text-xs font-semibold leading-tight">{stage.etapa_label}</p>
                <p className="text-xs opacity-50">
                  {fmtNum(stage.count)} · {stage.pct_del_total}%
                  {stage.aging_promedio != null && ` · ${stage.aging_promedio}d`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
