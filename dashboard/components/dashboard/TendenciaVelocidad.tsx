'use client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { TendenciaResponse, TiemposResponse } from '@/types'
import { T, B, AM, OR, PU, F, fN, fD, pct } from './brand'
import { SecHeader, Skeleton } from './ui'

const TT = {
  contentStyle: { background: 'white', border: '1px solid rgba(18,81,96,.1)', borderRadius: 10, fontSize: 12, fontFamily: F, boxShadow: '0 4px 14px rgba(18,81,96,.1)' },
  labelStyle: { color: T, fontWeight: 700, marginBottom: 4 },
}

export default function TendenciaVelocidad({ tend, times }: { tend: TendenciaResponse | null; times: TiemposResponse | null }) {
  const data = (tend?.meses || []).map(m => ({ label: m.label, aprobadas: m.aprobadas, rechazadas: m.rechazadas, caidas: m.ventas_caidas, meta: m.meta || null }))
  const g = times?.global
  const maxD = Math.max(...(times?.por_stage || []).map(x => x.avg_dias || 0), 1)
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 16 }}>
      <div>
        <SecHeader title="Tendencia histórica" sub="Aprobadas vs meta vs rechazadas" />
        <div className="card" style={{ padding: 18 }}>
          {!tend ? <Skeleton h={220} /> : (<>
            {data.length > 1 && (() => {
              const last = data[data.length - 1], prev = data[data.length - 2], diff = last.aprobadas - prev.aprobadas
              return (
                <div style={{ display: 'flex', gap: 16, marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: B }}>
                  <div><p className="eyebrow">Último mes</p><p style={{ fontSize: 18, fontWeight: 900 }}>{fN(last.aprobadas)}<span style={{ fontSize: 12, marginLeft: 5, color: diff >= 0 ? '#166534' : OR }}>{diff > 0 ? '↑' : diff < 0 ? '↓' : '='}{Math.abs(diff)}</span></p></div>
                  <div><p className="eyebrow">Mes anterior</p><p style={{ fontSize: 18, fontWeight: 900, opacity: .55 }}>{fN(prev.aprobadas)}</p></div>
                  {!!last.meta && <div><p className="eyebrow">% meta</p><p style={{ fontSize: 18, fontWeight: 900 }}>{pct(last.aprobadas, last.meta)}%</p></div>}
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              {[{ c: T, l: 'Aprobadas' }, { c: OR, l: 'Rechazadas' }, { c: '#B5472F', l: 'Caídas' }, { c: AM, l: 'Meta' }].map(x => (
                <span key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(18,81,96,.55)' }}>
                  <i style={{ width: 14, height: 3, borderRadius: 99, background: x.c, display: 'inline-block' }} />{x.l}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs><linearGradient id="gT" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T} stopOpacity={.12} /><stop offset="95%" stopColor={T} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,81,96,.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(18,81,96,.45)', fontFamily: F }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(18,81,96,.4)', fontFamily: F }} axisLine={false} tickLine={false} />
                <Tooltip {...TT} formatter={(v: number, n: string) => [fN(v), n === 'aprobadas' ? 'Aprobadas' : n === 'rechazadas' ? 'Rechazadas' : n === 'caidas' ? 'Caídas' : 'Meta']} />
                <Area type="monotone" dataKey="meta" stroke={AM} strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} connectNulls />
                <Area type="monotone" dataKey="aprobadas" stroke={T} strokeWidth={2} fill="url(#gT)" dot={{ fill: T, r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="rechazadas" stroke={OR} strokeWidth={1.5} fill="none" dot={{ fill: OR, r: 2, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="caidas" stroke="#B5472F" strokeWidth={1.5} fill="none" dot={{ fill: '#B5472F', r: 2, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </>)}
        </div>
      </div>

      <div>
        <SecHeader title="Velocidad del proceso" sub="¿Cuánto tarda aprobar una legalización?" />
        <div className="card" style={{ padding: 18 }}>
          {!times ? <Skeleton h={220} /> : (<>
            {g?.p50_lead_time != null && (
              <div style={{ padding: '14px 16px', borderRadius: 10, background: B, marginBottom: 16, border: '1px solid rgba(18,81,96,.08)' }}>
                <p style={{ fontSize: 11, color: 'rgba(18,81,96,.5)', marginBottom: 4 }}>
                  La mitad de las legalizaciones se aprueba en menos de
                  <span className="tip" data-tip="Mediana: la mitad tarda menos y la otra mitad más. No se distorsiona por casos extremos." style={{ marginLeft: 5, color: 'rgba(18,81,96,.35)' }}>?</span>
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <p style={{ fontSize: 38, fontWeight: 900, lineHeight: 1 }}>{g.p50_lead_time}</p>
                  <p style={{ fontSize: 15, color: 'rgba(18,81,96,.5)', fontWeight: 300 }}>días</p>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(18,81,96,.07)' }}>
                  {([['Promedio', g.avg_lead_time], ['Lentos (P90)', g.p90_lead_time]] as const).map(([l, v]) => (
                    <div key={l}><p className="eyebrow">{l}</p><p style={{ fontSize: 14, fontWeight: 700 }}>{fD(v)}</p></div>
                  ))}
                </div>
              </div>
            )}
            <p className="eyebrow" style={{ marginBottom: 10 }}>Tiempo en cada etapa</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {times.por_stage.filter(s => s.n > 0).map(s => {
                const w = Math.min(((s.avg_dias || 0) / maxD) * 100, 100)
                const col = !s.avg_dias ? 'rgba(18,81,96,.3)' : s.avg_dias <= 5 ? AM : s.avg_dias <= 15 ? T : OR
                const msg = !s.avg_dias ? '' : s.avg_dias <= 5 ? 'Muy ágil' : s.avg_dias <= 15 ? 'Normal' : 'Revisar'
                return (
                  <div key={s.stage}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{s.label}</span>
                      <span style={{ display: 'flex', gap: 8 }}><span style={{ fontSize: 10, color: 'rgba(18,81,96,.5)', fontWeight: 600 }}>{msg}</span><span style={{ fontSize: 13, fontWeight: 900 }}>{fD(s.avg_dias)}</span></span>
                    </div>
                    <div className="progress-track lg"><div className="progress-fill" style={{ width: `${w}%`, background: col }} /></div>
                  </div>
                )
              })}
            </div>
          </>)}
        </div>
      </div>
    </section>
  )
}
