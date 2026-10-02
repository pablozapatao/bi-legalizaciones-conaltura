'use client'
import type { ReactNode, CSSProperties } from 'react'
import { AM, YE, OR, T, STAGE_COLOR, STAGE_LABEL, hubspotUrl } from './brand'

export function SemaforoDot({ s, motivo }: { s: string | null | undefined; motivo?: string }) {
  if (!s) return <span style={{ color: 'rgba(18,81,96,.25)', fontSize: 12 }}>—</span>
  const col = s === 'verde' ? AM : s === 'amarillo' ? YE : OR
  return (
    <span className="tip" data-tip={motivo || s}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: col, display: 'inline-block' }} />
    </span>
  )
}

export function SecHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="sec-bar" />
        <div>
          <h2 className="sec-title">{title}</h2>
          {sub && <p className="sec-sub">{sub}</p>}
        </div>
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{right}</div>}
    </div>
  )
}

export function Skeleton({ h = 100 }: { h?: number }) {
  return <div className="shimmer" style={{ height: h }} />
}

export function DownloadIcon({ color = T }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4 4 4-4M12 4v12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ExternalIcon({ color = T, size = 11 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function StageBadge({ code }: { code: string }) {
  const col = STAGE_COLOR[code] || T
  return (
    <span className="badge" style={{ background: `${col}15`, color: col, border: `1px solid ${col}30` }}>
      {STAGE_LABEL[code] || code}
    </span>
  )
}

export function HubspotLink({ row, compact }: { row: { hs_object_id: number | string; hubspot_url?: string }; compact?: boolean }) {
  return (
    <a href={hubspotUrl(row)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      className="badge badge-active" style={{ textDecoration: 'none', gap: 4, padding: compact ? '3px 8px' : '3px 10px' }}>
      HubSpot <ExternalIcon size={9} />
    </a>
  )
}

export function Drawer({ width, color = T, onClose, children }: { width: number; color?: string; onClose: () => void; children: ReactNode }) {
  const st: CSSProperties = { width, borderLeftColor: color }
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" style={st}>{children}</div>
    </>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(18,81,96,.35)', fontSize: 13 }}>{children}</div>
}
