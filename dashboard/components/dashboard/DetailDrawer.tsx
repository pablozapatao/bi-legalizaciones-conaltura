'use client'
import type { DetalleRow } from '@/types'
import { T, A, B, STAGE_COLOR, fM, fD, dtF, ltColor, hubspotUrl } from './brand'
import { Drawer, SemaforoDot, StageBadge, ExternalIcon } from './ui'

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(18,81,96,.07)' }}>
      <p className="eyebrow" style={{ marginBottom: 7 }}>{title}</p>
      {children}
    </div>
  )
}
const KV = ({ items }: { items: [string, string | null | undefined][] }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    {items.filter(([, v]) => v).map(([l, v]) => (
      <div key={l}><p style={{ fontSize: 9, color: 'rgba(18,81,96,.4)', marginBottom: 1 }}>{l}</p><p style={{ fontSize: 12, fontWeight: 600 }}>{v}</p></div>
    ))}
  </div>
)

export default function DetailDrawer({ row, onClose }: { row: DetalleRow; onClose: () => void }) {
  const col = STAGE_COLOR[row.etapa_codigo] || T
  const lines: [string, string | number | null | undefined][] = [
    ['SARLAFT', row.estado_sarlaft], ['Verificación doc.', row.verificacion_documental], ['Decisión final', row.decision_final],
    ['Propietario', row.propietario_del_negocio], ['ID Negocio origen', row.id_negocio_origen], ['Deal HubSpot', row.deal_id],
    ['Envío SARLAFT', row.fecha_envio_sarlaft], ['Respuesta SARLAFT', row.fecha_respuesta_sarlaft],
  ]
  const stageDays: [string, number | null][] = [
    ['Consignación', row.dias_en_consignacion], ['Espera Director', row.dias_en_legal_espera],
    ['Aprobada Dir.', row.dias_en_legal_aprobada], ['Revisión SINCO', row.dias_en_revision_sinco],
  ]
  const stageDates: [string, string | null][] = [
    ['Consignación', row.date_entered_consignacion], ['Espera Director', row.date_entered_legal_espera],
    ['Aprobada Dir.', row.date_entered_legal_aprobada_dir], ['Revisión SINCO', row.date_entered_revision_sinco],
    ['Aprobado Exitoso', row.date_entered_aprobado_exitoso], ['Con Novedades', row.date_entered_aprobado_novedades],
    ['Rechazado', row.date_entered_negocio_rechazado], ['Venta Caída', row.date_entered_venta_caida],
  ]
  return (
    <Drawer width={420} color={col} onClose={onClose}>
      <div className="drawer-head" style={{ padding: '18px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <StageBadge code={row.etapa_codigo} />
              <SemaforoDot s={row.motivo_semaforo} motivo={row.motivo_de_observacion} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.3, wordBreak: 'break-word' }}>{row.nombre_legalizacion || `Legalización #${row.hs_object_id}`}</h3>
            <p style={{ fontSize: 11, color: 'rgba(18,81,96,.5)', marginTop: 4 }}>{row.proyecto} · {row.ciudad} · ID {row.hs_object_id}</p>
          </div>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <a href={hubspotUrl(row)} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '9px 12px', borderRadius: 9, background: A, textDecoration: 'none', color: T }}>
          <ExternalIcon size={13} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>Abrir en HubSpot</span>
          <span style={{ fontSize: 10, color: 'rgba(18,81,96,.5)', marginLeft: 'auto' }}>→ CRM</span>
        </a>
      </div>

      <div className="drawer-body" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {([['Valor', fM(row.valor_del_inmueble), T], ['Lead time', fD(row.dias_lead_time), ltColor(row.dias_lead_time)], ['Antigüedad', fD(row.aging_dias), T]] as const).map(([l, v, c]) => (
            <div key={l} style={{ background: 'white', borderRadius: 9, padding: '10px 12px', border: '1px solid rgba(18,81,96,.07)' }}>
              <p className="eyebrow" style={{ marginBottom: 3 }}>{l}</p><p style={{ fontSize: 15, fontWeight: 900, color: c }}>{v}</p>
            </div>
          ))}
        </div>

        <Box title="Semáforo — Motivo de observación">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <SemaforoDot s={row.motivo_semaforo} motivo={row.motivo_de_observacion} />
            <p style={{ fontSize: 12, lineHeight: 1.5 }}>{row.motivo_de_observacion || <em style={{ opacity: .4 }}>Sin observación registrada</em>}</p>
          </div>
        </Box>

        <Box title="Comprador">
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{row.nombrecomprador || '—'}</p>
          <div style={{ display: 'flex', gap: 16 }}>
            {row.documento_comprador_1 && <p style={{ fontSize: 11, color: 'rgba(18,81,96,.5)' }}>Doc 1: {row.documento_comprador_1}</p>}
            {row.documento_comprador_2 && <p style={{ fontSize: 11, color: 'rgba(18,81,96,.5)' }}>Doc 2: {row.documento_comprador_2}</p>}
          </div>
        </Box>

        <Box title="Canales">
          <KV items={[['Atribución', row.canal_atribucion], ['Gestión (primario)', row.canal_gestion_original], ['Gestión (secundario)', row.canal_gestion_secundario], ['Tipo cuenta consig.', row.tipo_cuenta_consignacion]]} />
        </Box>

        <Box title="Unidad">
          <KV items={[['Descripción', row.invdescunidad], ['Número', row.numero_unidad], ['Torre', row.torre], ['Director', row.director]]} />
        </Box>

        <Box title="Estados del proceso">
          {lines.filter(([, v]) => v).map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(18,81,96,.05)' }}>
              <span style={{ fontSize: 11, color: 'rgba(18,81,96,.5)' }}>{l}</span><span style={{ fontSize: 11, fontWeight: 600 }}>{String(v)}</span>
            </div>
          ))}
        </Box>

        {stageDays.some(([, v]) => v) && (
          <Box title="Tiempo en cada etapa">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {stageDays.filter(([, v]) => v != null && Number(v) > 0).map(([l, v]) => (
                <div key={l} style={{ background: B, borderRadius: 7, padding: '7px 10px' }}>
                  <p style={{ fontSize: 9, color: 'rgba(18,81,96,.45)', marginBottom: 2 }}>{l}</p><p style={{ fontSize: 14, fontWeight: 900 }}>{fD(v)}</p>
                </div>
              ))}
            </div>
          </Box>
        )}

        <Box title="Fechas">
          {([['Creación', row.fecha_creacion], ['Modificación', row.fecha_modificacion], ['Aprobación', row.fecha_aprobacion_final], ...stageDates.filter(([, v]) => v).map(([l, v]) => [`Entró a ${l}`, v] as [string, string | null])] as [string, string | null][]).map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 11, color: 'rgba(18,81,96,.5)' }}>{l}</span><span style={{ fontSize: 11, fontWeight: 600 }}>{dtF(v)}</span>
            </div>
          ))}
          {row.en_ventana_cierre && (
            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 9, background: 'rgba(219,255,105,.35)', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
              Aprobada en ventana de cierre (día 25+)
            </div>
          )}
        </Box>
      </div>
    </Drawer>
  )
}
