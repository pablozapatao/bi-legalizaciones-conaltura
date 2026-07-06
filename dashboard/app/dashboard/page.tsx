'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import toast from 'react-hot-toast'

/* ════════════════════════════════════════════════════════════════════
   MANUAL DE MARCA — CONALTURA
   Funnel Sans / Arial  |  Beige #F4F0E5  |  Teal #125160  |  Acento #DBFF69
════════════════════════════════════════════════════════════════════ */
const B = '#F4F0E5'   // beige fondo
const T = '#125160'   // teal principal
const A = '#DBFF69'   // acento verde claro
const AM= '#A1D81A'   // verde medio (gráficas)
const OR= '#FF795A'   // naranja (alertas)
const PU= '#B382FF'   // morado (gráficas)
const F = `'Funnel Sans',Arial,sans-serif`

/* ════════════════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════════════════ */
const MES  = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESF = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const fN   = (v:any,d=0)=> v==null?'—':Number(v).toLocaleString('es-CO',{maximumFractionDigits:d})
const fM   = (v:any)    => !v||!Number(v)?'—':`$${(Number(v)/1e6).toLocaleString('es-CO',{maximumFractionDigits:1})}M`
const fD   = (v:any)    => v==null?'—':`${Number(v).toFixed(1)} d`
const pct  = (a:number,b:number)=> b>0 ? Math.round(a/b*100) : 0
const now  = ()=>{ const x=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Bogota'})); return {y:x.getFullYear(),mo:x.getMonth()+1} }

const STAGE_LABEL: Record<string,string> = {
  consignacion:'Consignación', legal_espera:'Espera Director',
  legal_aprobada_dir:'Aprobada Dir.', revision_sinco:'Revisión SINCO',
  aprobado_exitoso:'Aprobado ✓', aprobado_novedades:'Con Novedades',
  aprobado_gerencia:'Aprob. Gerencia',
  negocio_rechazado:'Rechazado', venta_caida:'Venta Caída',
}
const STAGE_COLOR: Record<string,string> = {
  consignacion:T, legal_espera:'#1a6b7a',
  legal_aprobada_dir:'#1a7d6e', revision_sinco:'#279752',
  aprobado_exitoso:'#166534', aprobado_novedades:'#4d7c0f',
  aprobado_gerencia:'#B382FF',
  negocio_rechazado:OR, venta_caida:'#991B1B',
}
const PIPELINE_STAGES = ['consignacion','legal_espera','legal_aprobada_dir','revision_sinco']

function SemaforoIcon({s,motivo}:{s:string|null;motivo?:string}) {
  if(!s) return <span style={{color:'rgba(18,81,96,.25)',fontSize:12}}>—</span>
  const icon = s==='verde'?'🟢':s==='amarillo'?'🟡':'🔴'
  return <span className="tip" data-tip={motivo||s} style={{fontSize:13}}>{icon}</span>
}

const TT_STYLE = {
  contentStyle:{background:'white',border:'1px solid rgba(18,81,96,.1)',borderRadius:10,fontSize:12,fontFamily:F,boxShadow:'0 4px 14px rgba(18,81,96,.1)'},
  labelStyle:{color:T,fontWeight:700,marginBottom:4},
}

/* ════════════════════════════════════════════════════════════════════
   GAUGE — compacto, sin solapamiento, meta separada debajo del arco
════════════════════════════════════════════════════════════════════ */
function Gauge({pct:p,meta,onEdit}:{pct:number;meta:number;onEdit:()=>void}) {
  const [v,setV]=useState(0)
  const raf=useRef<number>()
  useEffect(()=>{
    const t=Math.min(p,150),t0=performance.now(),dur=1200
    const go=(ts:number)=>{
      const pr=Math.min((ts-t0)/dur,1)
      setV(Math.round((1-Math.pow(1-pr,3))*t))
      if(pr<1)raf.current=requestAnimationFrame(go)
    }
    raf.current=requestAnimationFrame(go)
    return ()=>{if(raf.current)cancelAnimationFrame(raf.current)}
  },[p])

  // Arco más pequeño, centrado bien
  const R=48,cx=64,cy=58,startDeg=-210,sweep=240
  const arc=(sd:number,sw:number)=>{
    const r=(d:number)=>d*Math.PI/180,[a,b]=[r(sd),r(sd+sw)]
    return `M${cx+R*Math.cos(a)} ${cy+R*Math.sin(a)} A${R} ${R} 0 ${sw>180?1:0} 1 ${cx+R*Math.cos(b)} ${cy+R*Math.sin(b)}`
  }
  const fill=Math.min(v,100)/100*sweep
  const col=v>=90?'#166534':v>=60?'#92400E':OR
  const lbl=v>=90?'En meta ✓':v>=60?'En riesgo':'Crítico'

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:0,width:'100%'}}>
      {/* Arco SVG — solo el arco y el número grande */}
      <svg width="128" height="78" viewBox="0 0 128 78" style={{overflow:'visible'}}>
        <path d={arc(startDeg,sweep)} fill="none" stroke="rgba(18,81,96,.08)" strokeWidth="9" strokeLinecap="round"/>
        {fill>0&&<path d={arc(startDeg,fill)} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"/>}
        {/* Número grande — bien centrado en el arco */}
        <text x={cx} y={cy+2} textAnchor="middle" fontSize="22" fontWeight="900" fontFamily={F} fill={col}>{v}%</text>
        <text x={cx} y={cy+15} textAnchor="middle" fontSize="9" fontWeight="600" fontFamily={F} fill={col} opacity=".75">{lbl}</text>
      </svg>

      {/* Meta — separada visualmente del arco, fuera del SVG */}
      {meta>0 ? (
        <div style={{
          display:'flex',alignItems:'center',gap:6,
          padding:'4px 10px',borderRadius:99,
          background:'rgba(18,81,96,.06)',
          border:'1px solid rgba(18,81,96,.1)',
          marginTop:4,
        }}>
          <span style={{fontSize:9,color:'rgba(18,81,96,.45)',textTransform:'uppercase',letterSpacing:'.07em'}}>meta</span>
          <span style={{fontSize:12,fontWeight:900,color:T}}>{fN(meta)}</span>
          <button onClick={onEdit} style={{
            fontSize:9,padding:'1px 7px',borderRadius:99,fontFamily:F,
            border:`1px solid rgba(18,81,96,.18)`,background:'transparent',
            color:'rgba(18,81,96,.45)',cursor:'pointer',marginLeft:2,
          }}>editar</button>
        </div>
      ) : (
        <button onClick={onEdit} style={{
          fontSize:10,fontWeight:600,padding:'4px 12px',borderRadius:99,fontFamily:F,
          border:`1px solid rgba(18,81,96,.18)`,background:'transparent',
          color:'rgba(18,81,96,.5)',cursor:'pointer',marginTop:4,
        }}>+ Fijar meta</button>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   META MODAL
════════════════════════════════════════════════════════════════════ */
function MetaModal({anio,mes,actual,onClose,onSaved}:{
  anio:number;mes:number;actual:number;onClose:()=>void;onSaved:(n:number)=>void
}) {
  const [v,setV]=useState(actual>0?String(actual):'')
  const [s,setS]=useState(false)
  async function save(){
    const x=parseInt(v,10);if(isNaN(x)||x<0)return;setS(true)
    try{
      await fetch('/api/metas/upsert',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({anio,mes,meta_negocios:x})})
      onSaved(x);onClose();toast.success(`Meta ${MESF[mes]} ${anio} → ${fN(x)}`)
    }finally{setS(false)}
  }
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{
      position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',
      padding:16,background:'rgba(18,81,96,.35)',backdropFilter:'blur(6px)'}}>
      <div style={{background:'white',borderRadius:16,padding:28,width:'100%',maxWidth:360,
        boxShadow:'0 20px 60px rgba(18,81,96,.18)',border:'1px solid rgba(18,81,96,.1)',fontFamily:F}}>
        <h3 style={{fontSize:18,fontWeight:900,color:T,marginBottom:4}}>Meta de legalizaciones</h3>
        <p style={{fontSize:12,color:'rgba(18,81,96,.5)',marginBottom:20}}>
          {MESF[mes]} {anio} · número objetivo de aprobaciones del mes
        </p>
        <label style={{display:'block',fontSize:10,fontWeight:700,textTransform:'uppercase',
          letterSpacing:'.07em',color:'rgba(18,81,96,.45)',marginBottom:7}}>Objetivo (unidades)</label>
        <input type="number" min="0" value={v}
          onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()}
          autoFocus placeholder="ej. 150"
          style={{width:'100%',padding:'11px 14px',borderRadius:10,border:`1.5px solid rgba(18,81,96,.18)`,
            fontSize:22,fontWeight:900,color:T,background:B,fontFamily:F,
            marginBottom:14,outline:'none',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:'10px 0',borderRadius:9,
            border:`1px solid rgba(18,81,96,.14)`,cursor:'pointer',fontFamily:F,
            background:'transparent',color:'rgba(18,81,96,.55)',fontWeight:600,fontSize:13}}>
            Cancelar
          </button>
          <button onClick={save} disabled={s||!v} style={{flex:1,padding:'10px 0',borderRadius:9,
            border:'none',cursor:'pointer',background:A,color:T,fontWeight:900,
            fontFamily:F,fontSize:13,opacity:(s||!v)?.5:1}}>
            {s?'Guardando…':'Guardar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   DETAIL DRAWER
════════════════════════════════════════════════════════════════════ */
function DetailDrawer({row,onClose}:{row:any;onClose:()=>void}) {
  const col=STAGE_COLOR[row.etapa_codigo]||T
  const dtF=(s:string|null)=>s?new Date(s).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'2-digit'}):'—'
  const ltCol=row.dias_lead_time==null?T:row.dias_lead_time>30?OR:row.dias_lead_time>15?'#92400E':'#166534'
  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(18,81,96,.35)',
        backdropFilter:'blur(4px)',zIndex:40}}/>
      <div style={{position:'fixed',right:0,top:0,bottom:0,width:420,maxWidth:'95vw',zIndex:41,
        background:B,borderLeft:`3px solid ${col}`,display:'flex',flexDirection:'column',
        fontFamily:F,boxShadow:'-20px 0 60px rgba(18,81,96,.15)'}}>
        {/* Header */}
        <div style={{padding:'18px 20px 14px',borderBottom:`1px solid rgba(18,81,96,.08)`,background:'white'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                <span style={{background:`${col}18`,color:col,padding:'2px 9px',
                  borderRadius:99,fontSize:10,fontWeight:700,border:`1px solid ${col}33`}}>
                  {STAGE_LABEL[row.etapa_codigo]||row.etapa_codigo}
                </span>
                <SemaforoIcon s={row.motivo_semaforo} motivo={row.motivo_de_observacion}/>
              </div>
              <h3 style={{fontSize:15,fontWeight:900,color:T,lineHeight:1.3,wordBreak:'break-word'}}>
                {row.nombre_legalizacion||`Legalización #${row.hs_object_id}`}
              </h3>
              <p style={{fontSize:11,color:'rgba(18,81,96,.5)',marginTop:4}}>
                {row.proyecto} · {row.ciudad} · ID {row.hs_object_id}
              </p>
            </div>
            <button onClick={onClose} style={{background:B,border:`1px solid rgba(18,81,96,.14)`,
              borderRadius:8,color:'rgba(18,81,96,.5)',cursor:'pointer',
              width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
          </div>
          {row.hubspot_url&&(
            <a href={row.hubspot_url} target="_blank" rel="noopener noreferrer"
              style={{display:'flex',alignItems:'center',gap:8,marginTop:12,padding:'8px 12px',
                borderRadius:9,background:A,textDecoration:'none',transition:'opacity .15s'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                  stroke={T} strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <span style={{fontSize:12,fontWeight:700,color:T}}>Abrir en HubSpot</span>
              <span style={{fontSize:10,color:'rgba(18,81,96,.5)',marginLeft:'auto'}}>→ CRM</span>
            </a>
          )}
        </div>
        {/* Body */}
        <div style={{flex:1,overflowY:'auto',padding:'14px 18px',display:'flex',flexDirection:'column',gap:12}}>
          {/* Métricas */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[
              ['Valor',    fM(row.valor_del_inmueble),A],
              ['Lead time',fD(row.dias_lead_time),    ltCol],
              ['Antigüedad',fD(row.aging_dias),      'rgba(18,81,96,.6)'],
            ].map(([l,v,c])=>(
              <div key={l as string} style={{background:'white',borderRadius:9,padding:'10px 12px',
                border:`1px solid rgba(18,81,96,.07)`}}>
                <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',
                  color:'rgba(18,81,96,.45)',marginBottom:3}}>{l}</p>
                <p style={{fontSize:15,fontWeight:900,color:c as string}}>{v}</p>
              </div>
            ))}
          </div>

          {/* Motivo observación */}
          <div style={{background:'white',borderRadius:10,padding:'12px 14px',border:`1px solid rgba(18,81,96,.07)`}}>
            <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',color:'rgba(18,81,96,.45)',marginBottom:7}}>
              🚦 Semáforo de venta — Motivo de Observación
            </p>
            <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
              <SemaforoIcon s={row.motivo_semaforo} motivo={row.motivo_de_observacion}/>
              <p style={{fontSize:12,color:T,lineHeight:1.5}}>
                {row.motivo_de_observacion||<em style={{opacity:.4}}>Sin observación registrada</em>}
              </p>
            </div>
          </div>

          {/* Comprador */}
          <div style={{background:'white',borderRadius:10,padding:'12px 14px',border:`1px solid rgba(18,81,96,.07)`}}>
            <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',color:'rgba(18,81,96,.45)',marginBottom:7}}>👤 Comprador</p>
            <p style={{fontSize:13,fontWeight:700,color:T,marginBottom:2}}>{row.nombrecomprador||'—'}</p>
            <p style={{fontSize:11,color:'rgba(18,81,96,.5)'}}>CC {row.documento_comprador_1||'—'}</p>
          </div>

          {/* Unidad */}
          {(row.invdescunidad||row.numero_unidad||row.torre)&&(
            <div style={{background:'white',borderRadius:10,padding:'12px 14px',border:`1px solid rgba(18,81,96,.07)`}}>
              <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',color:'rgba(18,81,96,.45)',marginBottom:7}}>🏢 Unidad</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[['Descripción',row.invdescunidad],['Número',row.numero_unidad],['Torre',row.torre],['Director',row.director]]
                  .filter(([,v])=>v).map(([l,v])=>(
                  <div key={l as string}>
                    <p style={{fontSize:9,color:'rgba(18,81,96,.4)',marginBottom:1}}>{l}</p>
                    <p style={{fontSize:12,fontWeight:600,color:T}}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estados */}
          <div style={{background:'white',borderRadius:10,padding:'12px 14px',border:`1px solid rgba(18,81,96,.07)`}}>
            <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',color:'rgba(18,81,96,.45)',marginBottom:7}}>⚙️ Estados del proceso</p>
            {[['SARLAFT',row.estado_sarlaft],['Verificación doc.',row.verificacion_documental],['Decisión final',row.decision_final],['Canal atribución',row.canal_atribucion],['Canal gestión',row.canal_gestion_original]]
              .map(([l,v])=>(
              <div key={l as string} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'5px 0',borderBottom:'1px solid rgba(18,81,96,.05)'}}>
                <span style={{fontSize:11,color:'rgba(18,81,96,.5)'}}>{l}</span>
                <span style={{fontSize:11,fontWeight:600,color:T}}>{v||'—'}</span>
              </div>
            ))}
          </div>

          {/* Fechas */}
          <div style={{background:'white',borderRadius:10,padding:'12px 14px',border:`1px solid rgba(18,81,96,.07)`}}>
            <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',color:'rgba(18,81,96,.45)',marginBottom:7}}>📅 Fechas</p>
            {[['Creación',row.fecha_creacion],['Aprobación',row.fecha_aprobacion_final]]
              .map(([l,v])=>(
              <div key={l as string} style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}>
                <span style={{fontSize:11,color:'rgba(18,81,96,.5)'}}>{l}</span>
                <span style={{fontSize:11,fontWeight:600,color:T}}>{dtF(v as string)}</span>
              </div>
            ))}
            {row.en_ventana_cierre&&(
              <div style={{marginTop:8,padding:'6px 10px',borderRadius:7,
                background:'rgba(219,255,105,.25)',border:'1px solid rgba(18,81,96,.1)',
                fontSize:11,fontWeight:700,color:T,textAlign:'center'}}>
                ✅ Aprobada en ventana de cierre (después del día 25)
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════
   EXCEL EXPORT — SheetJS, formato .xlsx nativo
════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════
   EXCEL EXPORTS — múltiples formatos
════════════════════════════════════════════════════════════════════ */

// Exportar tabla de proyectos (resumen)
async function exportXLSX(rows:any[]) {
  const XLSX = await import('xlsx')
  const data = rows.map((r:any)=>({
    'Proyecto':         r.proyecto||'',
    'Director':         r.director||'',
    'Ciudad':           r.ciudad||'',
    'Aprobadas':        (r.exitosas||0)+(r.con_novedades||0),
    'Sin Novedad':      r.exitosas||0,
    'Con Novedad':      r.con_novedades||0,
    'Rechazadas':       r.rechazadas||0,
    'Ventas Caídas':    r.ventas_caidas||0,
    'Pipeline Activo':  r.pipeline_activo||0,
    'Valor Total COP':  r.suma_valor_inmueble||0,
    'Lead Time Prom.':  r.avg_lead_time||null,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [22,22,14,12,12,12,12,12,14,20,16].map(w=>({wch:w}))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,ws,'Flujo de Proyectos')
  XLSX.writeFile(wb,'Conaltura_BI_Proyectos.xlsx')
  toast.success('✅ Conaltura_BI_Proyectos.xlsx')
}

// Exportar clientes legalizados — toda la información disponible
async function exportClientesXLSX(rows:any[], nombreArchivo='Conaltura_Clientes_Legalizados.xlsx') {
  const XLSX = await import('xlsx')
  const data = rows.map((r:any)=>({
    'ID HubSpot':               r.hs_object_id||'',
    'Nombre Legalización':      r.nombre_legalizacion||'',
    'Proyecto':                 r.proyecto||'',
    'Director':                 r.director||'',
    'Ciudad':                   r.ciudad||'',
    'Torre':                    r.torre||'',
    'Número Unidad':            r.numero_unidad||'',
    'Descripción Unidad':       r.invdescunidad||'',
    'Comprador':                r.nombrecomprador||'',
    'Documento Comprador':      r.documento_comprador_1||'',
    'Stage':                    r.etapa_label||r.etapa_codigo||'',
    'Canal Atribución':         r.canal_atribucion||'',
    'Canal Gestión':            r.canal_gestion_original||'',
    'Valor Inmueble COP':       r.valor_del_inmueble||'',
    'Fecha Aprobación':         r.fecha_aprobacion_final||'',
    'Lead Time (días)':         r.dias_lead_time||'',
    'Antigüedad (días)':        r.aging_dias||'',
    'En Ventana Cierre':        r.en_ventana_cierre ? 'Sí' : 'No',
    'Motivo Observación':       r.motivo_de_observacion||'',
    'SARLAFT':                  r.estado_sarlaft||'',
    'Verificación Documental':  r.verificacion_documental||'',
    'Decisión Final':           r.decision_final||'',
    'URL HubSpot':              r.hubspot_url||'',
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [14,32,24,22,14,10,12,24,28,18,18,18,18,18,16,14,14,16,40,16,24,20,40].map(w=>({wch:w}))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,ws,'Clientes Legalizados')
  XLSX.writeFile(wb,nombreArchivo)
  toast.success(`✅ ${nombreArchivo}`)
}

// Exportar rechazados — listado detallado para gestión
async function exportRechazadosXLSX(rows:any[]) {
  const XLSX = await import('xlsx')
  const rechazados = rows.filter((r:any)=>
    r.etapa_codigo==='negocio_rechazado' || r.etapa_codigo==='venta_caida'
  )
  if(!rechazados.length){ toast.error('No hay rechazados en el período'); return }
  const data = rechazados.map((r:any)=>({
    'ID HubSpot':         r.hs_object_id||'',
    'Nombre':             r.nombre_legalizacion||'',
    'Tipo':               r.etapa_codigo==='negocio_rechazado'?'Rechazado':'Venta Caída',
    'Comprador':          r.nombrecomprador||'',
    'Documento':          r.documento_comprador_1||'',
    'Proyecto':           r.proyecto||'',
    'Director':           r.director||'',
    'Ciudad':             r.ciudad||'',
    'Valor COP':          r.valor_del_inmueble||'',
    'Motivo Observación': r.motivo_de_observacion||'',
    'Canal':              r.canal_atribucion||'',
    'Fecha':              r.fecha_aprobacion_final||'',
    'URL HubSpot':        r.hubspot_url||'',
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [14,32,14,28,18,24,22,14,18,40,18,16,40].map(w=>({wch:w}))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,ws,'Rechazados y Caídas')
  XLSX.writeFile(wb,'Conaltura_Rechazados.xlsx')
  toast.success('✅ Conaltura_Rechazados.xlsx')
}

/* ════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════
   KPI CARD — componente reutilizable
════════════════════════════════════════════════════════════════════ */
function KpiCard({card}:{card:{l:string;v:any;border:string;sub?:string;tip?:string;prog?:number}}) {
  const {l,v,border,sub,tip,prog} = card
  return (
    <div style={{
      background:'white',borderRadius:11,
      border:'1px solid rgba(18,81,96,.07)',
      borderLeft:`3px solid ${border}`,
      padding:'13px 16px',
      minHeight:80,
      display:'flex',flexDirection:'column',justifyContent:'space-between',
      transition:'box-shadow .18s, transform .18s',
    }}>
      <div>
        <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase' as const,
          letterSpacing:'.07em',color:'rgba(18,81,96,.45)',
          marginBottom:6,display:'flex',alignItems:'center',gap:3}}>
          {l}
          {tip&&<span className="tip" data-tip={tip}
            style={{cursor:'help',color:'rgba(18,81,96,.3)',fontSize:11,lineHeight:1}}>?</span>}
        </p>
        <p style={{fontFamily:`'Funnel Sans',Arial,sans-serif`,fontSize:28,fontWeight:900,
          color:'#125160',margin:0,lineHeight:1,letterSpacing:'-.03em',
          fontVariantNumeric:'tabular-nums'}}>
          {typeof v==='number'?v.toLocaleString('es-CO'):v}
        </p>
      </div>
      <div>
        {prog!=null&&(
          <div style={{height:3,background:'rgba(18,81,96,.08)',
            borderRadius:99,overflow:'hidden',marginTop:7}}>
            <div style={{height:'100%',borderRadius:99,background:border,
              width:`${Math.min(prog,100)}%`,
              transition:'width .8s cubic-bezier(.4,0,.2,1)'}}/>
          </div>
        )}
        {sub&&<p style={{fontSize:10,color:'rgba(18,81,96,.45)',
          marginTop:4,lineHeight:1.4}}>{sub}</p>}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   RECHAZADOS DRAWER — listado completo de rechazados y caídas
════════════════════════════════════════════════════════════════════ */
function RechazadosDrawer({rows,onClose,onSelectRow,onExport}:{
  rows:any[];onClose:()=>void;onSelectRow:(r:any)=>void;onExport:()=>void
}) {
  const rechazados = rows.filter((r:any)=>r.etapa_codigo==='negocio_rechazado')
  const caidas     = rows.filter((r:any)=>r.etapa_codigo==='venta_caida')
  const [tab,setTab]=useState<'rechazados'|'caidas'>('rechazados')
  const visible = tab==='rechazados' ? rechazados : caidas

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(18,81,96,.35)',
        backdropFilter:'blur(4px)',zIndex:40}}/>
      <div style={{
        position:'fixed',right:0,top:0,bottom:0,width:560,maxWidth:'97vw',zIndex:41,
        background:B,borderLeft:`3px solid ${OR}`,display:'flex',flexDirection:'column',
        fontFamily:F,boxShadow:'-20px 0 60px rgba(18,81,96,.15)',
      }}>
        {/* Header */}
        <div style={{padding:'16px 20px 12px',borderBottom:`1px solid rgba(18,81,96,.08)`,
          background:'white'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div>
              <h3 style={{fontSize:16,fontWeight:900,color:T,margin:0}}>
                Rechazados y Ventas Caídas
              </h3>
              <p style={{fontSize:11,color:'rgba(18,81,96,.5)',marginTop:2}}>
                {rechazados.length} rechazados · {caidas.length} caídas en el período
              </p>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={onExport} style={{
                display:'flex',alignItems:'center',gap:5,padding:'5px 11px',
                borderRadius:8,border:`1px solid rgba(18,81,96,.2)`,cursor:'pointer',
                background:A,color:T,fontSize:11,fontWeight:700,fontFamily:F}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4 4 4-4M12 4v12"
                    stroke={T} strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Excel
              </button>
              <button onClick={onClose} style={{background:B,border:`1px solid rgba(18,81,96,.14)`,
                borderRadius:8,color:'rgba(18,81,96,.5)',cursor:'pointer',
                width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
          </div>
          {/* Tabs */}
          <div style={{display:'flex',gap:4,background:'rgba(18,81,96,.07)',
            borderRadius:8,padding:3,width:'fit-content'}}>
            {([['rechazados',`Rechazados (${rechazados.length})`],
               ['caidas',`Ventas Caídas (${caidas.length})`]] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{
                padding:'4px 12px',borderRadius:6,fontSize:11,fontWeight:700,
                cursor:'pointer',border:'none',fontFamily:F,
                background:tab===k?A:'transparent',
                color:tab===k?T:'rgba(18,81,96,.6)'}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
          {visible.length===0 ? (
            <div style={{textAlign:'center',padding:'40px 0',color:'rgba(18,81,96,.35)',fontSize:13}}>
              No hay registros en esta categoría para el período
            </div>
          ) : visible.map((r:any)=>(
            <div key={r.hs_object_id}
              onClick={()=>onSelectRow(r)}
              style={{
                background:'white',borderRadius:10,padding:'12px 14px',marginBottom:8,
                border:`1px solid rgba(18,81,96,.08)`,
                borderLeft:`3px solid ${r.etapa_codigo==='negocio_rechazado'?OR:'#991B1B'}`,
                cursor:'pointer',transition:'box-shadow .15s',
              }}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                <div style={{flex:1}}>
                  <p style={{fontWeight:700,fontSize:13,color:T,marginBottom:2}}>
                    {r.nombrecomprador||'Sin nombre'}
                  </p>
                  <p style={{fontSize:11,color:'rgba(18,81,96,.55)',marginBottom:4}}>
                    {r.nombre_legalizacion||`#${r.hs_object_id}`} · {r.proyecto||'—'}
                  </p>
                  {r.motivo_de_observacion&&(
                    <p style={{fontSize:11,color:OR,fontWeight:600,marginBottom:2}}>
                      ⚠️ {r.motivo_de_observacion}
                    </p>
                  )}
                  <div style={{display:'flex',gap:12,marginTop:4}}>
                    {[
                      ['Director', r.director],
                      ['Ciudad',   r.ciudad],
                      ['Canal',    r.canal_atribucion],
                      ['Doc.',     r.documento_comprador_1],
                    ].filter(([,v])=>v).map(([l,v])=>(
                      <span key={l as string} style={{fontSize:10,color:'rgba(18,81,96,.45)'}}>
                        <strong>{l}:</strong> {v}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <p style={{fontSize:13,fontWeight:900,color:T,marginBottom:2}}>
                    {r.valor_del_inmueble
                      ? `$${(r.valor_del_inmueble/1e6).toLocaleString('es-CO',{maximumFractionDigits:1})}M`
                      : '—'}
                  </p>
                  {r.hubspot_url&&(
                    <a href={r.hubspot_url} target="_blank" rel="noopener noreferrer"
                      onClick={e=>e.stopPropagation()}
                      style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:10,
                        fontWeight:700,color:T,textDecoration:'none',
                        background:A,padding:'3px 8px',borderRadius:6}}>
                      HubSpot →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer con resumen */}
        <div style={{padding:'12px 18px',borderTop:`1px solid rgba(18,81,96,.08)`,
          background:'white',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:11,color:'rgba(18,81,96,.5)'}}>
            {visible.length} registros · clic en cualquier fila para ver detalle completo
          </span>
          <span style={{fontSize:12,fontWeight:700,color:OR}}>
            {tab==='rechazados'?rechazados.length:caidas.length} {tab==='rechazados'?'rechazados':'caídas'}
          </span>
        </div>
      </div>
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MOTIVO DRAWER — drill-down de un motivo específico
════════════════════════════════════════════════════════════════════ */
function MotivoDrawer({motivo,rows,loading,onClose,onSelectRow,onExport}:{
  motivo:string;rows:any[];loading:boolean;
  onClose:()=>void;onSelectRow:(r:any)=>void;onExport:()=>void
}) {
  // Agrupar por director para el resumen
  const dirMap: Record<string,number> = {}
  rows.forEach(r=>{ const d=(r.director||'Sin director'); dirMap[d]=(dirMap[d]||0)+1 })
  const dirSummary = Object.entries(dirMap).sort((a,b)=>b[1]-a[1])

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(18,81,96,.35)',
        backdropFilter:'blur(4px)',zIndex:40}}/>
      <div style={{
        position:'fixed',right:0,top:0,bottom:0,width:580,maxWidth:'97vw',zIndex:41,
        background:B,borderLeft:`3px solid ${AM}`,display:'flex',flexDirection:'column',
        fontFamily:F,boxShadow:'-20px 0 60px rgba(18,81,96,.15)',
      }}>
        {/* Header */}
        <div style={{padding:'16px 20px 12px',borderBottom:`1px solid rgba(18,81,96,.08)`,
          background:'white'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                <span style={{fontSize:12,fontWeight:700,background:`${AM}18`,
                  color:'#166534',padding:'2px 9px',borderRadius:99,border:`1px solid ${AM}44`}}>
                  Motivo de Observación
                </span>
              </div>
              <h3 style={{fontSize:14,fontWeight:900,color:T,lineHeight:1.4,
                wordBreak:'break-word',marginBottom:4}}>
                "{motivo}"
              </h3>
              <p style={{fontSize:11,color:'rgba(18,81,96,.5)'}}>
                {loading?'Cargando…':`${rows.length} legalizaciones con este motivo en el período`}
              </p>
            </div>
            <div style={{display:'flex',gap:8,flexShrink:0}}>
              <button onClick={onExport} disabled={loading||rows.length===0}
                style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',
                  borderRadius:8,border:`1px solid rgba(18,81,96,.2)`,cursor:'pointer',
                  background:A,color:T,fontSize:11,fontWeight:700,fontFamily:F,
                  opacity:loading||rows.length===0?.5:1}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4 4 4-4M12 4v12"
                    stroke={T} strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Excel
              </button>
              <button onClick={onClose} style={{background:B,border:`1px solid rgba(18,81,96,.14)`,
                borderRadius:8,color:'rgba(18,81,96,.5)',cursor:'pointer',
                width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
          </div>
        </div>

        {/* Resumen por director */}
        {!loading&&dirSummary.length>0&&(
          <div style={{padding:'12px 18px',borderBottom:`1px solid rgba(18,81,96,.08)`,
            background:`${AM}08`}}>
            <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',
              letterSpacing:'.08em',color:'rgba(18,81,96,.45)',marginBottom:8}}>
              CONSOLIDADO POR DIRECTOR
            </p>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {dirSummary.map(([dir,cnt])=>(
                <div key={dir} style={{
                  background:'white',borderRadius:8,padding:'8px 12px',
                  border:'1px solid rgba(18,81,96,.08)',
                }}>
                  <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginBottom:2}}>
                    {dir.split(' ')[0]} {dir.split(' ').slice(-1)[0]}
                  </p>
                  <p style={{fontSize:18,fontWeight:900,color:T}}>{cnt}</p>
                </div>
              ))}
              <div style={{background:AM,borderRadius:8,padding:'8px 12px',border:`1px solid ${AM}`}}>
                <p style={{fontSize:10,color:'rgba(0,0,0,.5)',marginBottom:2}}>Total</p>
                <p style={{fontSize:18,fontWeight:900,color:'#0a3340'}}>{rows.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de legalizaciones */}
        <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
          {loading ? (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {Array(4).fill(0).map((_,i)=>(
                <div key={i} className="shimmer" style={{height:70,borderRadius:10}}/>
              ))}
            </div>
          ) : rows.length===0 ? (
            <div style={{textAlign:'center',padding:'40px 0',color:'rgba(18,81,96,.35)',fontSize:13}}>
              No se encontraron legalizaciones con este motivo
            </div>
          ) : rows.map((r:any)=>{
            const col=STAGE_COLOR[r.etapa_codigo]||T
            return (
              <div key={r.hs_object_id}
                onClick={()=>onSelectRow(r)}
                style={{
                  background:'white',borderRadius:10,padding:'12px 14px',marginBottom:8,
                  border:`1px solid rgba(18,81,96,.08)`,
                  borderLeft:`3px solid ${col}`,
                  cursor:'pointer',transition:'box-shadow .15s',
                }}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                      <span style={{background:`${col}15`,color:col,padding:'1px 8px',
                        borderRadius:99,fontSize:10,fontWeight:700,
                        border:`1px solid ${col}28`}}>
                        {STAGE_LABEL[r.etapa_codigo]||r.etapa_codigo}
                      </span>
                      <SemaforoIcon s={r.motivo_semaforo} motivo={r.motivo_de_observacion}/>
                    </div>
                    <p style={{fontWeight:700,fontSize:13,color:T,marginBottom:2}}>
                      {r.nombrecomprador||r.nombre_legalizacion||`#${r.hs_object_id}`}
                    </p>
                    <p style={{fontSize:11,color:'rgba(18,81,96,.55)',marginBottom:2}}>
                      {r.proyecto||'—'} · {r.director||'—'} · {r.ciudad||'—'}
                    </p>
                    {r.documento_comprador_1&&(
                      <p style={{fontSize:10,color:'rgba(18,81,96,.4)'}}>
                        CC {r.documento_comprador_1}
                      </p>
                    )}
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <p style={{fontSize:13,fontWeight:900,color:T,marginBottom:4}}>
                      {r.valor_del_inmueble
                        ? `$${(r.valor_del_inmueble/1e6).toLocaleString('es-CO',{maximumFractionDigits:1})}M`
                        : '—'}
                    </p>
                    {r.hubspot_url&&(
                      <a href={r.hubspot_url} target="_blank" rel="noopener noreferrer"
                        onClick={e=>e.stopPropagation()}
                        style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:10,
                          fontWeight:700,color:T,textDecoration:'none',
                          background:A,padding:'3px 8px',borderRadius:6}}>
                        HubSpot →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{padding:'10px 18px',borderTop:`1px solid rgba(18,81,96,.08)`,
          background:'white',fontSize:11,color:'rgba(18,81,96,.45)',textAlign:'center'}}>
          Clic en cualquier fila para ver el detalle completo · Exportar descarga todo el listado
        </div>
      </div>
    </>
  )
}

export default function Dashboard() {
  const hoy=now()
  const [anio,    setAnio]   =useState(hoy.y)
  const [mes,     setMes]    =useState(hoy.mo)
  const [semana,  setSemana] =useState<number|null>(null)  // cohorte semanal
  const [ciudad,  setCiudad] =useState('')
  const [director,setDir]    =useState('')
  const [proyecto,setProy]   =useState('')    // ← NUEVO filtro por proyecto
  const [showMeta,setMeta]   =useState(false)
  const [pagina,  setPagina] =useState(1)
  const [search,  setSearch] =useState('')
  const [sortK,   setSortK]  =useState('proyecto')
  const [sortD,   setSortD]  =useState<'asc'|'desc'>('asc')
  const [selected,    setSelected]    =useState<any>(null)
  const [tabDet,      setTabDet]      =useState<'todos'|'pipeline'|'resolucion'|'caida'>('todos')
  const [kanbanStage, setKanbanStage] =useState<string|null>(null)
  // Drawer de rechazados — listado filtrado
  const [showRechazados, setShowRechazados]=useState(false)
  // Drill-down de motivo de observación
  const [motivoSeleccionado, setMotivoSel]=useState<string|null>(null)
  const [motivoDet, setMotivoDet]         =useState<any[]>([])
  const [motivoLoading, setMotivoLoading] =useState(false)

  const [kpis,    setK] =useState<any>(null)
  const [pipe,    setP] =useState<any>(null)
  const [tend,    setT] =useState<any>(null)
  const [times,   setTi]=useState<any>(null)
  const [proy,    setPr]=useState<any>(null)
  const [cana,    setCa]=useState<any>(null)
  const [det,     setDe]=useState<any>(null)
  const [motivos, setMo]=useState<any[]>([])  // NEW: motivos por director
  const [ldDet,   setLd]=useState(false)
  const [loading, setLoading]=useState(true)
  const [allProy, setAllProy]=useState<string[]>([])

  const qs=useCallback(()=>{
    const p=new URLSearchParams({anio:String(anio),mes:String(mes)})
    if(ciudad)   p.set('ciudad',ciudad)
    if(director) p.set('director',director)
    if(proyecto) p.set('proyecto',proyecto)
    return p.toString()
  },[anio,mes,ciudad,director,proyecto])

  const fetchAll=useCallback(async()=>{
    setLoading(true);setK(null);setP(null);setTi(null);setPr(null);setCa(null)
    const q=qs()
    const tq=new URLSearchParams({meses:'14',...Object.fromEntries(new URLSearchParams(q))}).toString()
    try{
      const [k,p,t,ti,pr,ca]=await Promise.all([
        fetch(`/api/kpis?${q}`).then(r=>r.json()),
        fetch(`/api/pipeline?${q}`).then(r=>r.json()),
        fetch(`/api/tendencia?${tq}`).then(r=>r.json()),
        fetch(`/api/tiempos?${q}`).then(r=>r.json()),
        fetch(`/api/proyectos?${q}`).then(r=>r.json()),
        fetch(`/api/canales?${q}`).then(r=>r.json()),
      ])
      setK(k);setP(p);setT(t);setTi(ti);setPr(pr);setCa(ca)
      // Extraer lista de proyectos para el filtro
      if(pr?.proyectos) setAllProy(pr.proyectos.map((x:any)=>x.proyecto).filter(Boolean).sort())
      // Cargar motivos de observación desde detalle (todos, sin paginación limitada)
      try {
        const detAll = await fetch(`/api/detalle?${q}&pagina=1&por_pagina=200`).then(r=>r.json())
        // Agregar por director + motivo
        const map: Record<string,Record<string,number>> = {}
        for (const row of (detAll.rows||[])) {
          if (!row.motivo_de_observacion || row.motivo_de_observacion.trim()==='') continue
          const dir = (row.director||'Sin director').split(' ')[0]+' '+((row.director||'').split(' ').slice(-1)[0]||'')
          const mot = row.motivo_de_observacion.trim().substring(0,60)
          if (!map[mot]) map[mot]={}
          map[mot][dir]=(map[mot][dir]||0)+1
        }
        // Convertir a array para el gráfico, top 8 motivos
        const arr = Object.entries(map)
          .map(([motivo,dirs])=>({motivo, total:Object.values(dirs).reduce((s,n)=>s+n,0), dirs}))
          .sort((a,b)=>b.total-a.total)
          .slice(0,8)
        setMo(arr)
      } catch { setMo([]) }
    }finally{setLoading(false)}
  },[qs])

  // Cargar detalle de legalizaciones para un motivo específico
  const fetchMotivoDet = useCallback(async(motivo:string)=>{
    setMotivoLoading(true)
    setMotivoSel(motivo)
    try{
      const q=qs()
      const p=new URLSearchParams(q)
      p.set('pagina','1'); p.set('por_pagina','200')
      const data = await fetch(`/api/detalle?${p.toString()}`).then(r=>r.json())
      // Filtrar client-side por motivo exacto
      const filtradas = (data.rows||[]).filter((r:any)=>
        (r.motivo_de_observacion||'').trim().substring(0,60) === motivo.trim().substring(0,60)
      )
      setMotivoDet(filtradas)
    }finally{setMotivoLoading(false)}
  },[qs])

  const fetchDet=useCallback(async(pg=1,grupo=tabDet,stageFilter:string|null=kanbanStage)=>{
    setLd(true)
    const q=qs(); const p=new URLSearchParams(q)
    p.set('pagina',String(pg)); p.set('por_pagina','50')
    if(grupo!=='todos') p.set('grupo',grupo)
    // Si hay filtro de kanban, pasarlo como filtro de etapa (se usa en el API si lo soporta)
    try{ setDe(await fetch(`/api/detalle?${p.toString()}`).then(r=>r.json())); setPagina(pg) }
    finally{setLd(false)}
  },[qs,tabDet,kanbanStage])

  useEffect(()=>{fetchAll()},[fetchAll])
  useEffect(()=>{fetchDet(1)},[fetchDet])

  // Cuando se hace clic en una etapa del kanban, filtrar el detalle
  function onKanbanClick(stage:string) {
    const same=kanbanStage===stage
    setKanbanStage(same?null:stage)
    setTabDet('pipeline')
    fetchDet(1,'pipeline',same?null:stage)
  }

  // Semanas del mes (para cohortes semanales)
  const SEMANAS = [
    {n:1,l:'Semana 1 (1–7)'},
    {n:2,l:'Semana 2 (8–14)'},
    {n:3,l:'Semana 3 (15–21)'},
    {n:4,l:'Semana 4 (22–28)'},
    {n:5,l:'Semana 5 (29–fin)'},
  ]

  const periodos:any[]=[]
  let pa=hoy.y,pm=hoy.mo
  for(let i=0;i<18;i++){periodos.push({y:pa,m:pm,l:`${MES[pm]} ${pa}`});pm--;if(pm<1){pm=12;pa--}}

  // Sort proyectos table
  const proyRows=(()=>{
    if(!proy?.proyectos)return[]
    let r=[...proy.proyectos]
    if(search)r=r.filter((x:any)=>x.proyecto?.toLowerCase().includes(search.toLowerCase())||x.director?.toLowerCase().includes(search.toLowerCase()))
    r.sort((a:any,b:any)=>{
      const av=a[sortK],bv=b[sortK]
      const c=typeof av==='string'?av.localeCompare(bv):(Number(av)||0)-(Number(bv)||0)
      return sortD==='asc'?c:-c
    })
    return r
  })()

  function srt(k:string){if(sortK===k)setSortD(x=>x==='asc'?'desc':'asc');else{setSortK(k);setSortD('desc')}}
  function arr(k:string){return sortK===k?(sortD==='asc'?' ↑':' ↓'):''}

  const DIRS=['Alba Luz Consuegra','Carolina Cárdenas','Ingrid Marcela Matta','Leonardo Villegas','Natalia Giraldo','Patricia Herrera']
  const CITIES=['Medellín','Bogotá','Barranquilla','Cartagena','Cali']
  const chanColors=[T,'#1a6b7a','#1a7d6e',AM,'#4d7c0f','#166534']

  const Sk=({h=100}:{h?:number})=><div className="shimmer" style={{height:h}}/>

  // Datos tendencia para chart (14 meses, formato legible)
  const tendData = tend?.meses?.map((m:any)=>({
    label:   m.label,
    aprobadas: m.aprobadas,
    rechazadas: m.rechazadas,
    caidas:  m.ventas_caidas,
    meta:    m.meta||null,
    pct:     m.pct_cumplimiento,
  })) || []

  // Detalle filtrado por kanban stage (client-side)
  const detRows = (det?.rows||[]).filter((r:any)=>
    !kanbanStage || r.etapa_codigo===kanbanStage
  )

  /* ── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',fontFamily:F,color:T,background:B}}>
      {selected&&<DetailDrawer row={selected} onClose={()=>setSelected(null)}/>}

      {/* ══ DRAWER: RECHAZADOS Y CAÍDAS ═══════════════════════════════ */}
      {showRechazados&&det&&(
        <RechazadosDrawer
          rows={(det.rows||[]).filter((r:any)=>r.etapa_codigo==='negocio_rechazado'||r.etapa_codigo==='venta_caida')}
          onClose={()=>setShowRechazados(false)}
          onSelectRow={(r:any)=>{setSelected(r);setShowRechazados(false)}}
          onExport={()=>exportRechazadosXLSX(det.rows||[])}
        />
      )}

      {/* ══ DRAWER: MOTIVO DRILL-DOWN ═════════════════════════════════ */}
      {motivoSeleccionado&&(
        <MotivoDrawer
          motivo={motivoSeleccionado}
          rows={motivoDet}
          loading={motivoLoading}
          onClose={()=>{setMotivoSel(null);setMotivoDet([])}}
          onSelectRow={(r:any)=>{setSelected(r);setMotivoSel(null);setMotivoDet([])}}
          onExport={()=>exportClientesXLSX(motivoDet,`Conaltura_Motivo_${motivoSeleccionado.slice(0,20).replace(/\s+/g,'_')}.xlsx`)}
        />
      )}
      {showMeta&&kpis&&(
        <MetaModal anio={anio} mes={mes} actual={kpis.meta_negocios}
          onClose={()=>setMeta(false)}
          onSaved={x=>{
            setK((p:any)=>p?{...p,meta_negocios:x,
              pct_cumplimiento:x>0?parseFloat(((p.aprobadas_exitoso+p.aprobadas_novedades+(p.aprobadas_gerencia||0))/x*100).toFixed(1)):0}:p)
            setMeta(false)
          }}/>
      )}

      {/* ══ SIDEBAR ══════════════════════════════════════════════════ */}
      <aside style={{width:230,flexShrink:0,display:'flex',flexDirection:'column',
        background:T,borderRight:'1px solid rgba(255,255,255,.08)',overflowY:'auto',zIndex:20}}>

        {/* Brand */}
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:11}}>
            <div style={{width:38,height:38,borderRadius:10,flexShrink:0,
              background:`linear-gradient(135deg,#0d3b47,${A})`,
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:`0 3px 12px rgba(219,255,105,.3)`}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke={A} strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{fontSize:14,fontWeight:900,color:'rgba(255,255,255,.95)',margin:0}}>
                conaltura <span style={{color:A}}>·</span> BI
              </p>
              <p style={{fontSize:9,color:'rgba(219,255,105,.5)',letterSpacing:'.1em',
                textTransform:'uppercase',marginTop:1}}>Legalizaciones</p>
            </div>
          </div>
        </div>

        {/* Período + semanas */}
        <div style={{padding:'12px 14px 10px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',
            color:'rgba(219,255,105,.5)',marginBottom:7}}>Período</p>
          <select value={`${anio}-${mes}`}
            onChange={e=>{const[a,mo]=e.target.value.split('-').map(Number);setAnio(a);setMes(mo);setSemana(null)}}
            className="inp" style={{fontSize:12,fontWeight:700}}>
            {periodos.map(o=>(
              <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{o.l}</option>
            ))}
          </select>

          {/* Cohorte semanal */}
          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',
            color:'rgba(219,255,105,.5)',margin:'10px 0 6px'}}>
            Cohorte semanal
            <span className="tip" data-tip="Filtra aprobaciones por semana del mes para analizar la distribución dentro del período"
              style={{marginLeft:5,cursor:'help',color:'rgba(219,255,105,.4)',fontSize:11}}>?</span>
          </p>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            <button onClick={()=>setSemana(null)} style={{
              padding:'4px 8px',borderRadius:6,fontSize:10,cursor:'pointer',fontFamily:F,
              background:semana===null?A:'rgba(255,255,255,.08)',
              color:semana===null?T:'rgba(255,255,255,.6)',
              border:'none',fontWeight:semana===null?700:400}}>Todas</button>
            {SEMANAS.map(s=>(
              <button key={s.n} onClick={()=>setSemana(s.n===semana?null:s.n)} style={{
                padding:'4px 8px',borderRadius:6,fontSize:10,cursor:'pointer',fontFamily:F,
                background:semana===s.n?A:'rgba(255,255,255,.08)',
                color:semana===s.n?T:'rgba(255,255,255,.6)',
                border:'none',fontWeight:semana===s.n?700:400}}>S{s.n}</button>
            ))}
          </div>
          {semana!==null&&(
            <p style={{fontSize:10,color:'rgba(219,255,105,.55)',marginTop:5}}>
              {SEMANAS.find(s=>s.n===semana)?.l} · datos aproximados
            </p>
          )}
        </div>

        {/* Filtros */}
        <div style={{padding:'12px 14px',flex:1,display:'flex',flexDirection:'column',gap:12,overflowY:'auto'}}>
          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',
            color:'rgba(219,255,105,.5)',margin:0}}>Filtros globales</p>

          {/* Ciudad chips */}
          <div>
            <p style={{fontSize:10,color:'rgba(255,255,255,.55)',marginBottom:5,fontWeight:500}}>Ciudad</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {CITIES.map(c=>{const active=ciudad===c;return(
                <button key={c} onClick={()=>setCiudad(active?'':c)} style={{
                  padding:'4px 8px',borderRadius:6,fontSize:10,cursor:'pointer',fontFamily:F,
                  background:active?A:'rgba(255,255,255,.08)',
                  color:active?T:'rgba(255,255,255,.65)',
                  border:'none',fontWeight:active?700:400,transition:'all .13s'}}>
                  {c}
                </button>
              )})}
            </div>
          </div>

          {/* Director */}
          <div>
            <p style={{fontSize:10,color:'rgba(255,255,255,.55)',marginBottom:5,fontWeight:500}}>Director</p>
            <select value={director} onChange={e=>setDir(e.target.value)}
              className="inp" style={{fontSize:11}}>
              <option value="">Todos los directores</option>
              {DIRS.map(x=><option key={x} value={x}>{x.split(' ')[0]} {x.split(' ').slice(-1)[0]}</option>)}
            </select>
          </div>

          {/* Proyecto — NUEVO filtro global */}
          <div>
            <p style={{fontSize:10,color:'rgba(255,255,255,.55)',marginBottom:5,fontWeight:500}}>
              Proyecto
              <span className="tip" data-tip="Filtra todas las secciones del dashboard por un proyecto específico"
                style={{marginLeft:5,cursor:'help',color:'rgba(219,255,105,.4)',fontSize:11}}>?</span>
            </p>
            <select value={proyecto} onChange={e=>setProy(e.target.value)}
              className="inp" style={{fontSize:11}}>
              <option value="">Todos los proyectos</option>
              {allProy.map(x=><option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          {(ciudad||director||proyecto)&&(
            <button onClick={()=>{setCiudad('');setDir('');setProy('')}} style={{
              padding:'6px 0',borderRadius:7,border:'1px solid rgba(255,121,90,.3)',
              cursor:'pointer',background:'rgba(255,121,90,.1)',
              color:OR,fontSize:11,fontWeight:700,fontFamily:F}}>
              ✕ Limpiar filtros
            </button>
          )}

          <button onClick={()=>{fetchAll();fetchDet(1)}} style={{
            padding:'7px 0',borderRadius:8,border:`1px solid rgba(219,255,105,.2)`,
            cursor:'pointer',background:`rgba(219,255,105,.08)`,
            color:'rgba(219,255,105,.8)',fontSize:11,fontWeight:600,fontFamily:F}}>
            {loading?'⏳ Cargando…':'↺ Actualizar datos'}
          </button>
        </div>

        {/* Footer */}
        <div style={{padding:'10px 14px',borderTop:'1px solid rgba(255,255,255,.06)'}}>
          {kpis?.ultima_actualizacion&&(
            <p style={{fontSize:9,color:'rgba(255,255,255,.3)',marginBottom:5}}>
              ETL: {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO',
                {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            </p>
          )}
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div className="live-dot"/>
            <span style={{fontSize:10,color:'rgba(219,255,105,.45)'}}>Live · cada 2h</span>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Topbar */}
        <header style={{flexShrink:0,display:'flex',alignItems:'center',
          justifyContent:'space-between',padding:'0 22px',height:52,
          background:T,borderBottom:'1px solid rgba(255,255,255,.07)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <h1 style={{fontSize:15,fontWeight:900,color:'rgba(255,255,255,.95)',margin:0}}>
              BI Legalizaciones
              <span style={{fontWeight:300,fontSize:14,marginLeft:8,opacity:.55}}>/ Principal</span>
            </h1>
            <span style={{padding:'2px 9px',borderRadius:99,background:'rgba(219,255,105,.12)',
              border:`1px solid rgba(219,255,105,.3)`,fontSize:10,fontWeight:700,
              color:A,display:'flex',alignItems:'center',gap:4}}>
              <div className="live-dot"/>LIVE
            </span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>
              {MESF[mes]} {anio}{ciudad?` · ${ciudad}`:''}{director?` · ${director.split(' ')[0]}`:''}{proyecto?` · ${proyecto.split(' ').slice(0,2).join(' ')}…`:''}
            </span>
            <select value={`${anio}-${mes}`}
              onChange={e=>{const[a,mo]=e.target.value.split('-').map(Number);setAnio(a);setMes(mo)}}
              style={{fontSize:12,fontWeight:700,padding:'5px 9px',borderRadius:7,
                border:'1px solid rgba(219,255,105,.2)',background:'rgba(255,255,255,.1)',
                color:'rgba(255,255,255,.9)',outline:'none',cursor:'pointer',fontFamily:F}}>
              {periodos.map(o=>(
                <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}
                  style={{background:'#0d3b47'}}>{o.l}</option>
              ))}
            </select>
            {loading&&<div style={{width:8,height:8,borderRadius:'50%',
              border:`2px solid rgba(219,255,105,.25)`,borderTopColor:A,
              animation:'spin 1s linear infinite'}}/>}
          </div>
        </header>

        {/* Scrollable */}
        <main style={{flex:1,overflowY:'auto',padding:'20px 22px 60px',
          display:'flex',flexDirection:'column',gap:22}}>

          {/* ══ 1. KPIs ══════════════════════════════════════════════ */}
          <section>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="sec-bar"/>
                <div>
                  <h2 style={{fontSize:13,fontWeight:900,color:T,margin:0,textTransform:'uppercase',letterSpacing:'.04em'}}>
                    RENDIMIENTO DEL MES
                  </h2>
                  <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:1}}>
                    {MESF[mes]} {anio} · aprobaciones con fecha en este período
                  </p>
                </div>
              </div>
              {kpis?.ultima_actualizacion&&(
                <span style={{fontSize:10,color:'rgba(18,81,96,.4)'}}>
                  Actualizado {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO',
                    {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                </span>
              )}
            </div>

            {!kpis ? <Sk h={190}/> : (()=>{
              const ger = kpis.aprobadas_gerencia || 0
              const apr = kpis.aprobadas_exitoso + kpis.aprobadas_novedades + ger

              // ── Fila 1: Gauge + 4 cards de aprobación (misma altura) ──────
              // ── Fila 2: 3 cards de alertas (mismo ancho que las de arriba) ─
              // Layout: gauge ocupa 1 columna, las cards llenan las restantes.
              // Usamos un grid de 5 columnas para que las 4 cards de aprobación
              // quepan junto al gauge, y abajo 3 cards alineadas con las 4.

              return (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>

                  {/* ── FILA 1: Gauge + 4 KPIs principales ─────────────── */}
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'160px repeat(4,1fr)',
                    gap:8,
                    alignItems:'stretch',
                  }}>
                    {/* Gauge */}
                    <div className="card" style={{
                      padding:'16px 12px',
                      display:'flex',flexDirection:'column',
                      alignItems:'center',justifyContent:'center',
                      gridRow:'1',
                    }}>
                      <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',
                        letterSpacing:'.09em',color:'rgba(18,81,96,.38)',
                        textAlign:'center',marginBottom:6}}>
                        CUMPLIMIENTO
                      </p>
                      <Gauge pct={kpis.pct_cumplimiento} meta={kpis.meta_negocios} onEdit={()=>setMeta(true)}/>
                    </div>

                    {/* Card 1: Total */}
                    <KpiCard card={{
                      l:'Total del mes', v:kpis.total_resolucion, border:T,
                      sub:`${apr} aprobadas · ${kpis.rechazadas} rechazadas`,
                      prog:kpis.meta_negocios>0?pct(kpis.total_resolucion,kpis.meta_negocios):undefined,
                    }}/>
                    {/* Card 2: Sin novedad */}
                    <KpiCard card={{
                      l:'Aprobadas sin novedad', v:kpis.aprobadas_exitoso, border:'#166534',
                      sub:apr>0?`${pct(kpis.aprobadas_exitoso,apr)}% de aprobadas`:undefined,
                      prog:apr>0?pct(kpis.aprobadas_exitoso,apr):undefined,
                    }}/>
                    {/* Card 3: Con novedades */}
                    <KpiCard card={{
                      l:'Con novedades', v:kpis.aprobadas_novedades, border:'#92400E',
                      sub:apr>0?`${pct(kpis.aprobadas_novedades,apr)}% de aprobadas`:undefined,
                      prog:apr>0?pct(kpis.aprobadas_novedades,apr):undefined,
                    }}/>
                    {/* Card 4: Gerencia */}
                    <KpiCard card={{
                      l:'Gerencia Comercial', v:ger, border:'#B382FF',
                      tip:'Aprobados por Gerencia Comercial — Con Novedades (stage 1394950689).',
                      sub:apr>0?`${pct(ger,apr)}% de aprobadas`:undefined,
                      prog:apr>0?pct(ger,apr):undefined,
                    }}/>
                  </div>

                  {/* ── FILA 2: 3 KPIs de alerta — alineados con las cards de arriba ── */}
                  {/* Columna 0 vacía (bajo el gauge), luego 3 cards en col 1-3 */}
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'160px repeat(4,1fr)',
                    gap:8,
                  }}>
                    {/* Espaciador transparente bajo el gauge */}
                    <div/>
                    {/* Card 5: Rechazadas */}
                    <KpiCard card={{
                      l:'Rechazadas', v:kpis.rechazadas, border:kpis.rechazadas>0?OR:T,
                    }}/>
                    {/* Card 6: Ventas caídas */}
                    <KpiCard card={{
                      l:'Ventas caídas', v:kpis.ventas_caidas, border:kpis.ventas_caidas>0?'#991B1B':T,
                    }}/>
                    {/* Card 7: Ventana de cierre */}
                    <KpiCard card={{
                      l:'Ventana de cierre',
                      v:`${kpis.pct_ventana_cierre}%`,
                      border:kpis.pct_ventana_cierre>40?'#92400E':AM,
                      sub:`${kpis.en_ventana_cierre} aprobadas después del día 25`,
                      tip:'% de aprobaciones en los últimos días del mes (día 25+). Un % alto indica que el equipo cierra al final del mes.',
                      prog:kpis.pct_ventana_cierre,
                    }}/>
                    {/* Celda vacía en col 4 para mantener el grid equilibrado */}
                    <div/>
                  </div>

                </div>
              )
            })()}
          </section>

          {/* ══ 1b. SEMÁFORO DE DISTRIBUCIÓN (para la junta) ══════════ */}
          {kpis&&(()=>{
            const ger  = kpis.aprobadas_gerencia  || 0
            const apr  = kpis.aprobadas_exitoso + kpis.aprobadas_novedades + ger
            if (apr === 0) return null

            const segmentos = [
              {
                label: 'Aprobado sin novedades',
                sub:   'Todo correcto ✓',
                v:     kpis.aprobadas_exitoso,
                col:   '#166534',
                bg:    'rgba(22,101,52,.08)',
                icon:  '🟢',
              },
              {
                label: 'Aprobado con novedades',
                sub:   'Requiere seguimiento',
                v:     kpis.aprobadas_novedades,
                col:   '#92400E',
                bg:    'rgba(146,64,14,.08)',
                icon:  '🟡',
              },
              {
                label: 'Aprobado — Gerencia Comercial',
                sub:   'Decisión de gerencia',
                v:     ger,
                col:   '#7c3aed',
                bg:    'rgba(179,130,255,.1)',
                icon:  '🟣',
              },
            ]

            // Ángulos para el arco SVG del semáforo circular
            const TOTAL_DEG = 270  // arco de 270° total
            const START_DEG = -225 // arriba-izquierda
            function polarToXY(deg: number, r: number, cx: number, cy: number) {
              const rad = (deg * Math.PI) / 180
              return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
            }
            function buildArc(startDeg: number, sweepDeg: number, r: number, cx: number, cy: number) {
              if (sweepDeg <= 0) return ''
              const s = polarToXY(startDeg, r, cx, cy)
              const e = polarToXY(startDeg + sweepDeg, r, cx, cy)
              const largeArc = sweepDeg > 180 ? 1 : 0
              return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
            }

            let currentDeg = START_DEG
            const arcs = segmentos.map(s => {
              const sweep = (s.v / apr) * TOTAL_DEG
              const path  = buildArc(currentDeg, sweep - 2, 52, 70, 70) // -2 gap visual
              const start = currentDeg
              currentDeg += sweep
              return { ...s, sweep, path, pct: Math.round(s.v / apr * 100) }
            })

            return (
              <section style={{marginBottom:4}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                  <div className="sec-bar"/>
                  <div>
                    <h2 style={{fontSize:13,fontWeight:900,color:T,margin:0,
                      textTransform:'uppercase',letterSpacing:'.04em'}}>
                      SEMÁFORO DE DISTRIBUCIÓN
                    </h2>
                    <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:1}}>
                      Distribución de las {apr} aprobaciones del mes · vista para junta directiva
                    </p>
                  </div>
                </div>

                <div className="card" style={{padding:'20px 24px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:32,flexWrap:'wrap'}}>

                    {/* Gráfico circular tipo semáforo */}
                    <div style={{flexShrink:0,position:'relative'}}>
                      <svg width="140" height="140" viewBox="0 0 140 140"
                        style={{overflow:'visible'}}>
                        {/* Track vacío */}
                        <path d={buildArc(START_DEG, TOTAL_DEG, 52, 70, 70)}
                          fill="none" stroke="rgba(18,81,96,.07)" strokeWidth="14"
                          strokeLinecap="round"/>
                        {/* Segmentos */}
                        {arcs.filter(a=>a.path).map((a,i)=>(
                          <path key={i} d={a.path} fill="none" stroke={a.col}
                            strokeWidth="14" strokeLinecap="round"
                            style={{transition:'stroke-dasharray .8s'}}/>
                        ))}
                        {/* Centro */}
                        <text x="70" y="64" textAnchor="middle"
                          fontSize="22" fontWeight="900"
                          fontFamily={F} fill={T}>{apr}</text>
                        <text x="70" y="78" textAnchor="middle"
                          fontSize="9" fontWeight="600"
                          fontFamily={F} fill="rgba(18,81,96,.45)">APROBADAS</text>
                        <text x="70" y="90" textAnchor="middle"
                          fontSize="8" fontFamily={F} fill="rgba(18,81,96,.35)">
                          {kpis.meta_negocios>0?`meta ${fN(kpis.meta_negocios)}`:'sin meta'}
                        </text>
                      </svg>
                    </div>

                    {/* Leyenda + métricas */}
                    <div style={{flex:1,display:'flex',flexDirection:'column',gap:10,minWidth:280}}>
                      {arcs.map((a,i)=>(
                        <div key={i} style={{
                          display:'flex',alignItems:'center',gap:12,
                          padding:'10px 14px',borderRadius:10,
                          background:a.bg,border:`1px solid ${a.col}22`,
                        }}>
                          {/* Icono semáforo */}
                          <span style={{fontSize:20,flexShrink:0}}>{a.icon}</span>
                          {/* Texto */}
                          <div style={{flex:1}}>
                            <p style={{fontSize:12,fontWeight:700,color:a.col,
                              margin:0,lineHeight:1.3}}>{a.label}</p>
                            <p style={{fontSize:10,color:'rgba(18,81,96,.5)',
                              margin:'2px 0 0'}}>{a.sub}</p>
                          </div>
                          {/* Barra proporcional */}
                          <div style={{width:80,flexShrink:0}}>
                            <div style={{height:5,borderRadius:99,
                              background:'rgba(18,81,96,.08)',overflow:'hidden',marginBottom:3}}>
                              <div style={{height:'100%',borderRadius:99,background:a.col,
                                width:`${a.pct}%`,transition:'width .8s cubic-bezier(.4,0,.2,1)'}}/>
                            </div>
                            <p style={{fontSize:10,color:'rgba(18,81,96,.45)',
                              textAlign:'right',margin:0}}>
                              {a.pct}%
                            </p>
                          </div>
                          {/* Número */}
                          <div style={{textAlign:'right',flexShrink:0,minWidth:36}}>
                            <p style={{fontFamily:F,fontSize:22,fontWeight:900,
                              color:a.col,margin:0,lineHeight:1}}>{fN(a.v)}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Métricas rápidas para junta */}
                    <div style={{display:'flex',flexDirection:'column',gap:8,flexShrink:0,minWidth:130}}>
                      {[
                        ['Tasa de aprobación', apr>0&&kpis.total_resolucion>0
                          ? `${Math.round(apr/kpis.total_resolucion*100)}%` : '—',
                          T,'del total de resoluciones'],
                        ['Sin ninguna novedad', apr>0
                          ? `${Math.round(kpis.aprobadas_exitoso/apr*100)}%` : '—',
                          '#166534','aprobaciones limpias'],
                        ['Con alguna novedad', apr>0
                          ? `${Math.round((kpis.aprobadas_novedades+ger)/apr*100)}%` : '—',
                          '#92400E','requieren gestión'],
                      ].map(([l,v,c,sub])=>(
                        <div key={l as string} style={{
                          background:'white',borderRadius:9,padding:'10px 12px',
                          border:'1px solid rgba(18,81,96,.08)',
                        }}>
                          <p style={{fontSize:9,color:'rgba(18,81,96,.4)',
                            textTransform:'uppercase',letterSpacing:'.06em',
                            marginBottom:3}}>{l}</p>
                          <p style={{fontSize:18,fontWeight:900,color:c as string,
                            margin:0,lineHeight:1}}>{v}</p>
                          <p style={{fontSize:9,color:'rgba(18,81,96,.4)',
                            marginTop:2}}>{sub}</p>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              </section>
            )
          })()}

          {/* ══ 2. FLUJO DE PROYECTOS ════════════════════════════════ */}
          <section>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="sec-bar"/>
                <div>
                  <h2 style={{fontSize:13,fontWeight:900,color:T,margin:0,textTransform:'uppercase',letterSpacing:'.04em'}}>
                    FLUJO DE PROYECTOS
                  </h2>
                  <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:1}}>
                    Unidades · valor · lead time · sorteable por columna
                  </p>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Buscar proyecto…"
                  style={{padding:'5px 11px',borderRadius:7,border:'1px solid rgba(18,81,96,.14)',
                    background:'white',color:T,fontSize:12,fontFamily:F,outline:'none',width:150}}/>

                {/* Ver rechazados */}
                <button onClick={()=>{setTabDet('todos');fetchDet(1,'todos');setShowRechazados(true)}}
                  style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',
                    borderRadius:8,border:`1px solid ${OR}33`,cursor:'pointer',
                    background:`${OR}0f`,color:OR,fontSize:11,fontWeight:700,fontFamily:F}}>
                  <span style={{fontSize:13}}>⚠️</span> Rechazados
                </button>

                {/* Excel proyectos */}
                <button onClick={()=>proyRows.length&&exportXLSX(proyRows)}
                  disabled={!proyRows.length}
                  title="Resumen por proyecto (.xlsx)"
                  style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',
                    borderRadius:8,border:`1px solid rgba(18,81,96,.2)`,cursor:'pointer',
                    background:A,color:T,fontSize:11,fontWeight:700,fontFamily:F,
                    opacity:proyRows.length?1:.45}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4 4 4-4M12 4v12"
                      stroke={T} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Proyectos
                </button>

                {/* Excel clientes completo */}
                <button onClick={()=>det?.rows?.length&&exportClientesXLSX(det.rows)}
                  disabled={!det?.rows?.length}
                  title="Todos los clientes con información completa (.xlsx)"
                  style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',
                    borderRadius:8,border:`1px solid ${AM}55`,cursor:'pointer',
                    background:`${AM}18`,color:'#166534',fontSize:11,fontWeight:700,fontFamily:F,
                    opacity:det?.rows?.length?1:.45}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4 4 4-4M12 4v12"
                      stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Clientes
                </button>
              </div>
            </div>

            <div style={{borderRadius:14,overflow:'hidden',border:'1px solid rgba(18,81,96,.08)'}}>
              <div style={{overflowX:'auto',maxHeight:380,overflowY:'auto',background:'#E8E4D5'}}>
                {!proy ? <div style={{padding:14}}><Sk h={200}/></div> : (
                  <table className="bi-table" style={{minWidth:1020}}>
                    <thead>
                      <tr>
                        <th colSpan={3} style={{textAlign:'left'}}>Identificación</th>
                        <th colSpan={4} style={{textAlign:'center',color:'rgba(219,255,105,.7)'}}>Aprobadas</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(255,255,255,.5)'}}>Proceso</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(255,121,90,.8)'}}>Alertas</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(255,255,255,.4)'}}>Valor · Tiempo</th>
                      </tr>
                      <tr>
                        <th className={sortK==='proyecto'?'sorted':''} onClick={()=>srt('proyecto')}>Proyecto{arr('proyecto')}</th>
                        <th className={sortK==='director'?'sorted':''} onClick={()=>srt('director')}>Director{arr('director')}</th>
                        <th>Ciudad</th>
                        <th className={sortK==='aprobadas'?'sorted':''} onClick={()=>srt('aprobadas')} style={{textAlign:'right'}}>Total{arr('aprobadas')}</th>
                        <th style={{textAlign:'right'}}>Sin novedad</th>
                        <th style={{textAlign:'right'}}>Con novedad</th>
                        <th style={{textAlign:'right',color:'rgba(179,130,255,.8)'}}>Gerencia</th>
                        <th className={sortK==='pipeline_activo'?'sorted':''} onClick={()=>srt('pipeline_activo')} style={{textAlign:'right'}}>Pipeline{arr('pipeline_activo')}</th>
                        <th style={{textAlign:'right'}}>% total</th>
                        <th className={sortK==='rechazadas'?'sorted':''} onClick={()=>srt('rechazadas')} style={{textAlign:'right'}}>Rechaz.{arr('rechazadas')}</th>
                        <th className={sortK==='ventas_caidas'?'sorted':''} onClick={()=>srt('ventas_caidas')} style={{textAlign:'right'}}>Caídas{arr('ventas_caidas')}</th>
                        <th className={sortK==='suma_valor_inmueble'?'sorted':''} onClick={()=>srt('suma_valor_inmueble')} style={{textAlign:'right'}}>Valor{arr('suma_valor_inmueble')}</th>
                        <th className={sortK==='avg_lead_time'?'sorted':''} onClick={()=>srt('avg_lead_time')} style={{textAlign:'right'}}>Lead{arr('avg_lead_time')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proyRows.map((r:any,i:number)=>{
                        const apr=(r.exitosas||0)+(r.con_novedades||0)
                        const p=proy.total_aprobadas>0?(apr/proy.total_aprobadas*100).toFixed(1):'0.0'
                        return (
                          <tr key={r.proyecto||i} style={{cursor:'default'}}>
                            <td style={{fontWeight:700,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.proyecto||'—'}</td>
                            <td style={{fontSize:11,color:'rgba(18,81,96,.6)'}}>{r.director||'—'}</td>
                            <td style={{fontSize:11,color:'rgba(18,81,96,.6)'}}>{r.ciudad||'—'}</td>
                            <td style={{textAlign:'right'}}>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6}}>
                                <div style={{width:28,height:3,borderRadius:99,background:'rgba(18,81,96,.1)',overflow:'hidden'}}>
                                  <div style={{width:`${Math.min(Number(p),100)}%`,height:'100%',background:T,borderRadius:99}}/>
                                </div>
                                <span style={{fontWeight:700,color:'#166534',fontSize:13}}>{fN(apr)}</span>
                              </div>
                            </td>
                            <td style={{textAlign:'right'}}>
                              <span style={{background:'rgba(22,101,52,.1)',color:'#166534',padding:'1px 7px',borderRadius:5,fontWeight:700,fontSize:11}}>{fN(r.exitosas)}</span>
                            </td>
                            <td style={{textAlign:'right'}}>
                              <span style={{background:'rgba(146,64,14,.1)',color:'#92400E',padding:'1px 7px',borderRadius:5,fontWeight:700,fontSize:11}}>{fN(r.con_novedades)}</span>
                            </td>
                            <td style={{textAlign:'right'}}>
                              {(r.aprobado_gerencia||0)>0
                                ?<span style={{background:'rgba(179,130,255,.12)',color:'#7c3aed',padding:'1px 7px',borderRadius:5,fontWeight:700,fontSize:11}}>{fN(r.aprobado_gerencia)}</span>
                                :<span style={{color:'rgba(18,81,96,.2)',fontSize:11}}>—</span>}
                            </td>
                            <td style={{textAlign:'right',color:'#C2410C',fontWeight:500,fontSize:12}}>{fN(r.pipeline_activo)}</td>
                            <td style={{textAlign:'right',fontSize:11,color:'rgba(18,81,96,.5)'}}>{p}%</td>
                            <td style={{textAlign:'right'}}>
                              {(r.rechazadas||0)>0
                                ?<span style={{background:'rgba(255,121,90,.1)',color:OR,padding:'1px 7px',borderRadius:5,fontWeight:700,fontSize:11}}>{fN(r.rechazadas)}</span>
                                :<span style={{color:'rgba(18,81,96,.2)',fontSize:11}}>—</span>}
                            </td>
                            <td style={{textAlign:'right'}}>
                              {(r.ventas_caidas||0)>0
                                ?<span style={{background:'rgba(153,27,27,.1)',color:'#991B1B',padding:'1px 7px',borderRadius:5,fontWeight:700,fontSize:11}}>{fN(r.ventas_caidas)}</span>
                                :<span style={{color:'rgba(18,81,96,.2)',fontSize:11}}>—</span>}
                            </td>
                            <td style={{textAlign:'right',fontWeight:700,fontSize:12}}>{fM(r.suma_valor_inmueble)}</td>
                            <td style={{textAlign:'right',fontSize:11,color:'rgba(18,81,96,.55)'}}>{fD(r.avg_lead_time)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{fontWeight:900,letterSpacing:'.04em'}}>
                          TOTAL — {proy.proyectos?.length||0} proyectos
                        </td>
                        <td style={{textAlign:'right',color:'rgba(219,255,105,.9)',fontSize:14,fontWeight:900}}>{fN(proy.total_aprobadas)}</td>
                        <td colSpan={9}/>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* ══ 3. PIPELINE KANBAN + FUNNEL ══════════════════════════ */}
          <section>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="sec-bar"/>
                <div>
                  <h2 style={{fontSize:13,fontWeight:900,color:T,margin:0,textTransform:'uppercase',letterSpacing:'.04em'}}>
                    PIPELINE ACTIVO — KANBAN
                  </h2>
                  <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:1}}>
                    Vista tipo HubSpot · clic en etapa para ver los negocios en la tabla inferior
                  </p>
                </div>
              </div>
              {kanbanStage&&(
                <button onClick={()=>{setKanbanStage(null);setTabDet('todos');fetchDet(1,'todos',null)}}
                  style={{fontSize:11,padding:'4px 12px',borderRadius:7,border:'1px solid rgba(18,81,96,.14)',
                    cursor:'pointer',background:'rgba(255,121,90,.08)',color:OR,fontFamily:F,fontWeight:600}}>
                  ✕ Limpiar selección
                </button>
              )}
            </div>

            {!pipe ? <Sk h={200}/> : (()=>{
              const tot = pipe.total_pipeline||1
              // Datos funnel — solo pipeline stages
              const funnelData = (pipe.stages||[]).map((s:any)=>({
                name: s.etapa_label,
                code: s.etapa_codigo,
                count: s.count,
                pct: s.pct_del_total,
                aging: s.aging_promedio,
              }))
              const maxCount = Math.max(...funnelData.map((d:any)=>d.count),1)

              return (
                <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:14}}>
                  {/* Funnel visual */}
                  <div className="card" style={{padding:18}}>
                    <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',
                      color:'rgba(18,81,96,.4)',marginBottom:14}}>EMBUDO DE PROCESO</p>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {funnelData.map((d:any,i:number)=>{
                        const w=Math.max((d.count/maxCount)*100,8)
                        const col=STAGE_COLOR[d.code]||T
                        const isActive=kanbanStage===d.code
                        return (
                          <div key={d.code} onClick={()=>onKanbanClick(d.code)}
                            style={{cursor:'pointer',transition:'transform .15s',
                              transform:isActive?'scale(1.02)':'scale(1)'}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                              <span style={{fontSize:10,fontWeight:600,color:isActive?col:T}}>{d.name}</span>
                              <span style={{fontSize:11,fontWeight:900,color:col}}>{fN(d.count)}</span>
                            </div>
                            <div style={{height:20,borderRadius:5,background:'rgba(18,81,96,.07)',overflow:'hidden',
                              border:isActive?`1.5px solid ${col}`:'1.5px solid transparent',
                              transition:'border .15s'}}>
                              <div style={{width:`${w}%`,height:'100%',background:col,opacity:.85,
                                display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:6,
                                transition:'width .6s cubic-bezier(.4,0,.2,1)'}}>
                                {w>20&&<span style={{fontSize:10,fontWeight:700,color:'white'}}>{d.pct}%</span>}
                              </div>
                            </div>
                            {d.aging!=null&&(
                              <p style={{fontSize:9,color:'rgba(18,81,96,.4)',marginTop:1}}>
                                Antigüedad prom.: {d.aging}d
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* Total + caídas */}
                    <div style={{marginTop:14,padding:'10px 12px',borderRadius:9,
                      background:B,border:'1px solid rgba(18,81,96,.08)'}}>
                      <div style={{display:'flex',justifyContent:'space-between'}}>
                        <span style={{fontSize:11,color:'rgba(18,81,96,.6)'}}>Total en proceso</span>
                        <span style={{fontSize:14,fontWeight:900,color:T}}>{fN(pipe.total_pipeline)}</span>
                      </div>
                      {pipe.caidas_del_mes>0&&(
                        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,
                          paddingTop:5,borderTop:'1px solid rgba(18,81,96,.07)'}}>
                          <span style={{fontSize:11,color:'rgba(153,27,27,.7)'}}>Caídas este mes</span>
                          <span style={{fontSize:13,fontWeight:900,color:'#991B1B'}}>{fN(pipe.caidas_del_mes)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Kanban board */}
                  <div style={{overflowX:'auto',paddingBottom:6}}>
                    <div style={{display:'flex',gap:10,minWidth:0}}>
                      {funnelData.map((d:any)=>{
                        const col=STAGE_COLOR[d.code]||T
                        const isActive=kanbanStage===d.code
                        // Tarjetas de las legalizaciones filtradas por esta etapa
                        const cards=(det?.rows||[]).filter((r:any)=>r.etapa_codigo===d.code).slice(0,8)
                        return (
                          <div key={d.code} className="kanban-col"
                            style={{border:`1.5px solid ${isActive?col:'transparent'}`,
                              transition:'border .15s',cursor:'pointer'}}
                            onClick={()=>onKanbanClick(d.code)}>
                            {/* Header columna */}
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                              padding:'6px 8px 10px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:5}}>
                                <div style={{width:8,height:8,borderRadius:'50%',background:col}}/>
                                <span style={{fontSize:10,fontWeight:700,color:col}}>{d.name}</span>
                              </div>
                              <span style={{fontSize:12,fontWeight:900,color:T,
                                background:'white',borderRadius:99,padding:'1px 7px',
                                border:`1px solid rgba(18,81,96,.1)`}}>{d.count}</span>
                            </div>
                            {/* Tarjetas */}
                            {cards.length>0
                              ? cards.map((r:any)=>(
                                <div key={r.hs_object_id} className="kanban-card"
                                  onClick={e=>{e.stopPropagation();setSelected(r)}}
                                  style={{borderLeft:`2px solid ${col}`}}>
                                  <p style={{fontWeight:600,fontSize:11,color:T,marginBottom:2,
                                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                    {r.nombre_legalizacion||`#${r.hs_object_id}`}
                                  </p>
                                  <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginBottom:3}}>
                                    {r.proyecto?.split(' ').slice(0,3).join(' ')||'—'}
                                  </p>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                    <SemaforoIcon s={r.motivo_semaforo} motivo={r.motivo_de_observacion}/>
                                    <span style={{fontSize:10,fontWeight:700,
                                      color:r.dias_lead_time>30?OR:r.dias_lead_time>15?'#92400E':'#166534'}}>
                                      {fD(r.aging_dias)}
                                    </span>
                                  </div>
                                </div>
                              ))
                              : <p style={{fontSize:10,color:'rgba(18,81,96,.3)',
                                  textAlign:'center',padding:'12px 0'}}>Sin negocios</p>
                            }
                            {d.count>8&&(
                              <p style={{fontSize:10,color:'rgba(18,81,96,.4)',
                                textAlign:'center',padding:'4px 0'}}>
                                +{d.count-8} más
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}
          </section>

          {/* ══ 4. TENDENCIA + VELOCIDAD ══════════════════════════════ */}
          <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

            {/* Tendencia — 14 meses restructurada */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div className="sec-bar"/>
                <div>
                  <h2 style={{fontSize:13,fontWeight:900,color:T,margin:0,textTransform:'uppercase',letterSpacing:'.04em'}}>
                    TENDENCIA HISTÓRICA
                  </h2>
                  <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:1}}>
                    14 meses · aprobadas vs meta vs rechazadas
                  </p>
                </div>
              </div>
              <div className="card" style={{padding:18}}>
                {!tend ? <Sk h={220}/> : (
                  <>
                    {/* Resumen rápido */}
                    {tendData.length>1&&(()=>{
                      const last=tendData[tendData.length-1]
                      const prev=tendData[tendData.length-2]
                      const diff=last.aprobadas-prev.aprobadas
                      const arrow=diff>0?'↑':diff<0?'↓':'='
                      const col=diff>0?'#166534':diff<0?OR:'rgba(18,81,96,.5)'
                      return (
                        <div style={{display:'flex',gap:16,marginBottom:14,padding:'10px 14px',
                          borderRadius:9,background:B}}>
                          <div>
                            <p style={{fontSize:9,color:'rgba(18,81,96,.45)',marginBottom:2}}>Último mes</p>
                            <p style={{fontSize:18,fontWeight:900,color:T}}>{fN(last.aprobadas)}
                              <span style={{fontSize:12,marginLeft:5,color:col}}>{arrow}{Math.abs(diff)}</span>
                            </p>
                          </div>
                          <div>
                            <p style={{fontSize:9,color:'rgba(18,81,96,.45)',marginBottom:2}}>Mes anterior</p>
                            <p style={{fontSize:18,fontWeight:900,color:'rgba(18,81,96,.5)'}}>{fN(prev.aprobadas)}</p>
                          </div>
                          {last.meta>0&&(
                            <div>
                              <p style={{fontSize:9,color:'rgba(18,81,96,.45)',marginBottom:2}}>% meta</p>
                              <p style={{fontSize:18,fontWeight:900,color:pct(last.aprobadas,last.meta)>=90?'#166534':OR}}>
                                {pct(last.aprobadas,last.meta)}%
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:10}}>
                      {[{c:T,l:'Aprobadas',w:2},{c:OR,l:'Rechazadas',w:1.5},{c:'#991B1B',l:'Caídas',w:1.5},{c:AM,l:'Meta',d:true}]
                        .map(({c,l,w,d})=>(
                          <div key={l} style={{display:'flex',alignItems:'center',gap:4}}>
                            <div style={{width:16,height:d?0:2,
                              borderTop:d?`2px dashed ${c}`:undefined,
                              background:d?undefined:c,borderRadius:99}}/>
                            <span style={{fontSize:11,color:'rgba(18,81,96,.55)'}}>{l}</span>
                          </div>
                        ))}
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={tendData} margin={{top:4,right:4,left:-24,bottom:0}}>
                        <defs>
                          <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={T} stopOpacity={.12}/>
                            <stop offset="95%" stopColor={T} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,81,96,.05)"/>
                        <XAxis dataKey="label" tick={{fontSize:9,fill:'rgba(18,81,96,.45)',fontFamily:F}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fill:'rgba(18,81,96,.4)',fontFamily:F}} axisLine={false} tickLine={false}/>
                        <Tooltip {...TT_STYLE}
                          formatter={(v:any,name:any)=>[fN(v),
                            name==='aprobadas'?'Aprobadas':
                            name==='rechazadas'?'Rechazadas':
                            name==='caidas'?'Caídas':'Meta']}/>
                        <Area type="monotone" dataKey="meta" stroke={AM} strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} connectNulls/>
                        <Area type="monotone" dataKey="aprobadas" stroke={T} strokeWidth={2} fill="url(#gT)" dot={{fill:T,r:2.5,strokeWidth:0}} activeDot={{r:4}}/>
                        <Area type="monotone" dataKey="rechazadas" stroke={OR} strokeWidth={1.5} fill="none" dot={{fill:OR,r:2,strokeWidth:0}}/>
                        <Area type="monotone" dataKey="caidas" stroke="#991B1B" strokeWidth={1.5} fill="none" dot={{fill:'#991B1B',r:2,strokeWidth:0}}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </div>

            {/* Velocidad — simplificada "para dummies" */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div className="sec-bar"/>
                <div>
                  <h2 style={{fontSize:13,fontWeight:900,color:T,margin:0,textTransform:'uppercase',letterSpacing:'.04em'}}>
                    VELOCIDAD DEL PROCESO
                  </h2>
                  <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:1}}>
                    ¿Cuánto tarda aprobar una legalización?
                  </p>
                </div>
              </div>
              <div className="card" style={{padding:18}}>
                {!times ? <Sk h={220}/> : (()=>{
                  const g=times.global
                  return (
                    <>
                      {/* Hero stat simplificado */}
                      {g?.p50_lead_time!=null&&(
                        <div style={{padding:'14px 16px',borderRadius:10,background:B,
                          marginBottom:16,border:'1px solid rgba(18,81,96,.08)'}}>
                          <p style={{fontSize:11,color:'rgba(18,81,96,.5)',marginBottom:4}}>
                            La mitad de las legalizaciones se aprueba en menos de
                            <span className="tip" data-tip="Esta es la mediana: la mitad tardan menos y la otra mitad tardan más. Es la medida más confiable de velocidad porque no se distorsiona por casos extremos."
                              style={{marginLeft:5,cursor:'help',color:'rgba(18,81,96,.35)',fontSize:12}}>?</span>
                          </p>
                          <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                            <p style={{fontSize:38,fontWeight:900,color:T,lineHeight:1}}>{g.p50_lead_time}</p>
                            <p style={{fontSize:15,color:'rgba(18,81,96,.5)',fontWeight:300}}>días</p>
                          </div>
                          <div style={{display:'flex',gap:16,marginTop:8,paddingTop:8,
                            borderTop:'1px solid rgba(18,81,96,.07)'}}>
                            {[
                              ['Promedio',g.avg_lead_time,'(suma/total — sensible a extremos)'],
                              ['Rápidos (10%)',g.p50_lead_time ? Math.round(g.p50_lead_time*0.4) : null,'El 10% más ágil'],
                              ['Lentos (90%)',g.p90_lead_time,'El 10% tarda más que esto'],
                            ].map(([l,v,tip])=>(
                              <div key={l as string}>
                                <p style={{fontSize:9,color:'rgba(18,81,96,.4)',marginBottom:2,display:'flex',alignItems:'center',gap:3}}>
                                  {l}
                                  <span className="tip" data-tip={tip as string}
                                    style={{cursor:'help',color:'rgba(18,81,96,.3)',fontSize:11}}>?</span>
                                </p>
                                <p style={{fontSize:14,fontWeight:700,color:T}}>{fD(v)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Por stage — barra simple */}
                      <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',
                        color:'rgba(18,81,96,.38)',marginBottom:10}}>
                        TIEMPO EN CADA ETAPA
                      </p>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {(times.por_stage||[]).filter((s:any)=>s.n>0).map((s:any)=>{
                          const maxD = Math.max(...(times.por_stage||[]).map((x:any)=>x.avg_dias||0),1)
                          const pctW = Math.min(((s.avg_dias||0)/maxD)*100,100)
                          const col  = !s.avg_dias?'rgba(18,81,96,.3)':s.avg_dias<=5?'#166534':s.avg_dias<=15?AM:OR
                          const msg  = !s.avg_dias?'':s.avg_dias<=5?'Muy ágil ✓':s.avg_dias<=15?'Normal':'Revisar'
                          return (
                            <div key={s.stage}>
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,alignItems:'center'}}>
                                <span style={{fontSize:11,fontWeight:600}}>{s.label}</span>
                                <div style={{display:'flex',alignItems:'center',gap:8}}>
                                  <span style={{fontSize:10,color:col,fontWeight:600}}>{msg}</span>
                                  <span style={{fontSize:13,fontWeight:900,color:T}}>{fD(s.avg_dias)}</span>
                                </div>
                              </div>
                              <div className="progress-track">
                                <div className="progress-fill" style={{width:`${pctW}%`,background:col}}/>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </section>

          {/* ══ 5. MOTIVOS DE OBSERVACIÓN ════════════════════════════ */}
          <section>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <div className="sec-bar"/>
              <div>
                <h2 style={{fontSize:13,fontWeight:900,color:T,margin:0,textTransform:'uppercase',letterSpacing:'.04em'}}>
                  MOTIVOS DE OBSERVACIÓN
                </h2>
                <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:1}}>
                  ¿Por qué se generan observaciones en las legalizaciones? · frecuencia por motivo
                </p>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:14}}>
              {/* Gráfico de barras horizontales */}
              <div className="card" style={{padding:18}}>
                {motivos.length===0 ? (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',
                    height:180,color:'rgba(18,81,96,.35)',fontSize:13}}>
                    Sin observaciones en el período seleccionado
                  </div>
                ) : (
                  <>
                    <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',
                      letterSpacing:'.08em',color:'rgba(18,81,96,.4)',marginBottom:4}}>
                      TOP MOTIVOS — FRECUENCIA ACUMULADA
                    </p>
                    <p style={{fontSize:10,color:'rgba(18,81,96,.4)',marginBottom:12}}>
                      Clic en un motivo para ver las legalizaciones afectadas
                    </p>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {motivos.map((m,i)=>{
                        const maxT=motivos[0]?.total||1
                        const pctW=Math.max((m.total/maxT)*100,4)
                        const col=[T,'#1a6b7a','#1a7d6e',AM,'#4d7c0f',OR,PU,'#92400E'][i%8]
                        const isSelected = motivoSeleccionado===m.motivo
                        return (
                          <div key={m.motivo}
                            onClick={()=>fetchMotivoDet(m.motivo)}
                            style={{
                              cursor:'pointer',
                              padding:'8px 10px',borderRadius:8,
                              border:`1.5px solid ${isSelected?col:'transparent'}`,
                              background:isSelected?`${col}09`:'transparent',
                              transition:'all .15s',
                            }}>
                            <div style={{display:'flex',justifyContent:'space-between',
                              alignItems:'center',marginBottom:5}}>
                              <span style={{fontSize:11,fontWeight:isSelected?700:600,
                                color:isSelected?col:T,
                                flex:1,paddingRight:8,lineHeight:1.3}}>
                                {m.motivo}
                              </span>
                              <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                                <span style={{fontSize:13,fontWeight:900,color:col}}>{m.total}</span>
                                <span style={{fontSize:9,color:`${col}99`,fontWeight:600}}>
                                  {isSelected?'▼ ver':'→'}
                                </span>
                              </div>
                            </div>
                            <div style={{height:5,borderRadius:99,
                              background:'rgba(18,81,96,.07)',overflow:'hidden'}}>
                              <div style={{
                                width:`${pctW}%`,height:'100%',borderRadius:99,
                                background:col,opacity:.82,
                                transition:'width .7s cubic-bezier(.4,0,.2,1)',
                              }}/>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Tabla por director */}
              <div className="card" style={{padding:18}}>
                <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',
                  letterSpacing:'.08em',color:'rgba(18,81,96,.4)',marginBottom:14}}>
                  POR DIRECTOR
                </p>
                {motivos.length===0 ? (
                  <p style={{fontSize:12,color:'rgba(18,81,96,.35)',textAlign:'center',paddingTop:16}}>
                    Sin datos
                  </p>
                ) : (()=>{
                  // Agrupar por director → total de observaciones
                  const dirMap: Record<string,number> = {}
                  motivos.forEach(m=>{
                    Object.entries(m.dirs).forEach(([dir,cnt])=>{
                      dirMap[dir]=(dirMap[dir]||0)+(cnt as number)
                    })
                  })
                  const dirs = Object.entries(dirMap).sort((a,b)=>b[1]-a[1])
                  const maxD = dirs[0]?.[1]||1
                  return (
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {dirs.map(([dir,cnt],i)=>{
                        const col=[T,'#1a6b7a','#1a7d6e',AM,OR,PU][i%6]
                        const pctW=Math.max((cnt/maxD)*100,6)
                        return (
                          <div key={dir}>
                            <div style={{display:'flex',justifyContent:'space-between',
                              marginBottom:4,alignItems:'center'}}>
                              <span style={{fontSize:11,fontWeight:600,color:T}}>
                                {dir}
                              </span>
                              <span style={{fontSize:13,fontWeight:900,color:col}}>
                                {cnt}
                              </span>
                            </div>
                            <div style={{height:5,borderRadius:99,
                              background:'rgba(18,81,96,.07)',overflow:'hidden'}}>
                              <div style={{
                                width:`${pctW}%`,height:'100%',borderRadius:99,
                                background:col,opacity:.8,
                                transition:'width .7s',
                              }}/>
                            </div>
                          </div>
                        )
                      })}
                      {/* Nota */}
                      <p style={{fontSize:10,color:'rgba(18,81,96,.35)',marginTop:6,
                        paddingTop:8,borderTop:'1px solid rgba(18,81,96,.07)',lineHeight:1.5}}>
                        Suma total de registros con motivo de observación activo en el período.
                      </p>
                    </div>
                  )
                })()}
              </div>
            </div>
          </section>

          {/* ══ 6. TRAZABILIDAD ENLAZADA AL PIPELINE ══════════════════ */}
          <section>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="sec-bar"/>
                <div>
                  <h2 style={{fontSize:13,fontWeight:900,color:T,margin:0,textTransform:'uppercase',letterSpacing:'.04em'}}>
                    TRAZABILIDAD INDIVIDUAL
                  </h2>
                  <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:1}}>
                    {kanbanStage
                      ? `Filtrando por: ${STAGE_LABEL[kanbanStage]||kanbanStage} · clic en "Limpiar selección" arriba para ver todos`
                      : 'Enlazada al pipeline · clic en etapa del Kanban para filtrar'}
                  </p>
                </div>
              </div>
              {/* Tabs de grupo */}
              <div style={{display:'flex',gap:4,background:'rgba(18,81,96,.07)',
                borderRadius:9,padding:3,border:'1px solid rgba(18,81,96,.1)'}}>
                {([
                  ['todos',     'Todos'],
                  ['pipeline',  'Pipeline'],
                  ['resolucion','Aprobadas'],
                  ['caida',     'Caídas'],
                ] as const).map(([g,l])=>(
                  <button key={g} onClick={()=>{setTabDet(g);fetchDet(1,g)}}
                    style={{padding:'4px 10px',borderRadius:7,fontSize:11,fontWeight:700,
                      cursor:'pointer',border:'none',fontFamily:F,transition:'all .14s',
                      background:tabDet===g?A:'transparent',
                      color:tabDet===g?T:'rgba(18,81,96,.6)'}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Banner de filtro activo */}
            {kanbanStage&&(
              <div style={{padding:'8px 14px',marginBottom:10,borderRadius:9,
                background:`${STAGE_COLOR[kanbanStage]||T}12`,
                border:`1px solid ${STAGE_COLOR[kanbanStage]||T}30`,
                display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:12,fontWeight:700,color:STAGE_COLOR[kanbanStage]||T}}>
                  Vista filtrada: {STAGE_LABEL[kanbanStage]||kanbanStage} · {detRows.length} registros visibles
                </span>
                <button onClick={()=>{setKanbanStage(null);setTabDet('todos');fetchDet(1,'todos',null)}}
                  style={{fontSize:11,padding:'3px 10px',borderRadius:6,border:`1px solid ${OR}33`,
                    cursor:'pointer',background:`${OR}10`,color:OR,fontFamily:F,fontWeight:600}}>
                  ✕ Ver todos
                </button>
              </div>
            )}

            <div style={{borderRadius:14,overflow:'hidden',border:'1px solid rgba(18,81,96,.08)'}}>
              <div style={{overflowX:'auto',maxHeight:340,overflowY:'auto',background:'#E8E4D5'}}>
                {!det ? <div style={{padding:14}}><Sk h={200}/></div> : (
                  <table className="bi-table" style={{minWidth:900}}>
                    <thead>
                      <tr>
                        <th style={{width:24}}/>
                        <th colSpan={3} style={{textAlign:'left'}}>Legalización</th>
                        <th style={{textAlign:'center'}}>🚦</th>
                        <th colSpan={2}>Estado</th>
                        <th style={{textAlign:'right'}}>Valor</th>
                        <th style={{textAlign:'right'}}>Lead</th>
                        <th style={{textAlign:'center'}}>CRM</th>
                      </tr>
                      <tr>
                        <th/>
                        <th>Nombre</th>
                        <th>Proyecto</th>
                        <th>Comprador</th>
                        <th style={{textAlign:'center'}}>Motivo</th>
                        <th>Stage</th>
                        <th>Canal</th>
                        <th style={{textAlign:'right'}}>Valor</th>
                        <th style={{textAlign:'right'}}>Lead time</th>
                        <th style={{textAlign:'center'}}>HubSpot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ldDet
                        ? Array(5).fill(0).map((_,i)=>(
                          <tr key={i}>{Array(10).fill(0).map((_,j)=>(
                            <td key={j}><div className="shimmer" style={{height:10,borderRadius:4}}/></td>
                          ))}</tr>
                        ))
                        : detRows.map((r:any)=>{
                          const col=STAGE_COLOR[r.etapa_codigo]||T
                          const ltCol=r.dias_lead_time==null?'rgba(18,81,96,.5)':r.dias_lead_time>30?OR:r.dias_lead_time>15?'#92400E':'#166534'
                          return (
                            <tr key={r.hs_object_id} onClick={()=>setSelected(r)} style={{cursor:'pointer'}}>
                              <td style={{textAlign:'center',paddingRight:4}}>
                                <div style={{width:7,height:7,borderRadius:'50%',background:col,margin:'0 auto'}}/>
                              </td>
                              <td>
                                <p style={{fontWeight:700,fontSize:12,color:T,margin:0,
                                  maxWidth:165,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                  {r.nombre_legalizacion||`#${r.hs_object_id}`}
                                </p>
                                <p style={{fontSize:9,color:'rgba(18,81,96,.38)',margin:0}}>ID {r.hs_object_id}</p>
                              </td>
                              <td style={{fontSize:11,color:'rgba(18,81,96,.6)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.proyecto||'—'}</td>
                              <td style={{fontSize:11,color:'rgba(18,81,96,.6)'}}>{r.nombrecomprador||'—'}</td>
                              <td style={{textAlign:'center'}}>
                                <SemaforoIcon s={r.motivo_semaforo} motivo={r.motivo_de_observacion}/>
                              </td>
                              <td>
                                <span style={{background:`${col}15`,color:col,padding:'2px 8px',
                                  borderRadius:99,fontSize:10,fontWeight:700,display:'inline-block',
                                  border:`1px solid ${col}28`,whiteSpace:'nowrap'}}>
                                  {STAGE_LABEL[r.etapa_codigo]||r.etapa_codigo}
                                </span>
                              </td>
                              <td style={{fontSize:11,color:'rgba(18,81,96,.55)'}}>{r.canal_atribucion||'—'}</td>
                              <td style={{textAlign:'right',fontSize:11,fontWeight:700,color:T}}>{fM(r.valor_del_inmueble)}</td>
                              <td style={{textAlign:'right',fontSize:12,fontWeight:700,color:ltCol}}>{fD(r.dias_lead_time)}</td>
                              <td style={{textAlign:'center'}}>
                                <a href={r.hubspot_url} target="_blank" rel="noopener noreferrer"
                                  onClick={e=>e.stopPropagation()}
                                  style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                                    width:27,height:27,borderRadius:7,background:A,textDecoration:'none'}}
                                  title="Abrir en HubSpot">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                                      stroke={T} strokeWidth="2.5" strokeLinecap="round"/>
                                  </svg>
                                </a>
                              </td>
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                )}
              </div>
              {det?.total>50&&(
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'10px 14px',borderTop:'1px solid rgba(18,81,96,.07)',background:'white'}}>
                  <button onClick={()=>fetchDet(pagina-1)} disabled={pagina<=1}
                    style={{fontSize:11,fontWeight:600,padding:'5px 12px',borderRadius:7,
                      border:'1px solid rgba(18,81,96,.14)',cursor:'pointer',background:B,
                      color:T,fontFamily:F,opacity:pagina<=1?.35:1}}>← Anterior</button>
                  <span style={{fontSize:11,color:'rgba(18,81,96,.45)'}}>
                    Pág. {pagina} · {fN(det.total)} registros{kanbanStage?` · mostrando ${STAGE_LABEL[kanbanStage]||kanbanStage}`:''}
                  </span>
                  <button onClick={()=>fetchDet(pagina+1)} disabled={pagina>=Math.ceil(det.total/50)}
                    style={{fontSize:11,fontWeight:600,padding:'5px 12px',borderRadius:7,
                      border:'1px solid rgba(18,81,96,.14)',cursor:'pointer',background:B,
                      color:T,fontFamily:F,opacity:pagina>=Math.ceil(det.total/50)?.35:1}}>Siguiente →</button>
                </div>
              )}
            </div>
            <p style={{fontSize:10,color:'rgba(18,81,96,.35)',marginTop:6,textAlign:'center'}}>
              Clic en cualquier fila para ver todos los detalles · 🚦 semáforo = Motivo de Observación del proceso
            </p>
          </section>

        </main>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
