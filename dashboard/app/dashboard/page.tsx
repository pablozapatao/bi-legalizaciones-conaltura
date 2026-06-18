'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

/* ════════════════════════════════════════════════════════
   TOKENS  (Stitch dark palette + Conaltura brand)
════════════════════════════════════════════════════════ */
const LIME   = '#A1D81A'
const LIME2  = '#b9f23a'
const SIDEBAR= '#0B1120'
const TEAL   = '#125160'
const SLATE  = '#94a3b8'
const F      = `Inter,system-ui,-apple-system,sans-serif`

/* ════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════ */
const MES  = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESF = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const fN   = (v:any,d=0)=> v==null?'—':Number(v).toLocaleString('es-CO',{maximumFractionDigits:d})
const fM   = (v:any)    => !v||!Number(v)?'—':`$${(Number(v)/1e6).toLocaleString('es-CO',{maximumFractionDigits:1})}M`
const fD   = (v:any)    => v==null?'—':`${Number(v).toFixed(1)} d`
const now  = ()=>{ const x=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Bogota'})); return {y:x.getFullYear(),mo:x.getMonth()+1} }

const STAGE_LABEL: Record<string,string> = {
  consignacion:'Consignación', legal_espera:'Espera Dir.',
  legal_aprobada_dir:'Aprobada Dir.', revision_sinco:'Rev. SINCO',
  aprobado_exitoso:'Aprobado ✓', aprobado_novedades:'Con Novedades',
  negocio_rechazado:'Rechazado', venta_caida:'Venta Caída',
}
const STAGE_COLOR: Record<string,string> = {
  consignacion:'#38bdf8',legal_espera:'#818cf8',
  legal_aprobada_dir:'#a78bfa',revision_sinco:'#fbbf24',
  aprobado_exitoso:'#4ade80',aprobado_novedades:'#86efac',
  negocio_rechazado:'#f87171',venta_caida:'#e11d48',
}
// Semáforo de motivo
function SemaforoIcon({s}:{s:string|null}) {
  if (!s) return <span style={{color:'rgba(148,163,184,.35)'}}>—</span>
  return (
    <span style={{fontSize:14}} title={s}>
      {s==='verde'?'🟢':s==='amarillo'?'🟡':'🔴'}
    </span>
  )
}

const TT = {
  contentStyle:{background:'rgba(11,17,32,0.95)',border:'1px solid rgba(161,216,26,.2)',borderRadius:8,fontSize:11,fontFamily:F},
  labelStyle:{color:LIME,fontWeight:700,marginBottom:3},
  itemStyle:{color:'#94a3b8'},
}

/* ════════════════════════════════════════════════════════
   GAUGE
════════════════════════════════════════════════════════ */
function Gauge({pct,meta,onEdit}:{pct:number;meta:number;onEdit:()=>void}) {
  const [v,setV]=useState(0)
  const raf=useRef<number>()
  useEffect(()=>{
    const t=Math.min(pct,150),t0=performance.now(),dur=1300
    const go=(ts:number)=>{
      const p=Math.min((ts-t0)/dur,1)
      setV(Math.round((1-Math.pow(1-p,3))*t))
      if(p<1)raf.current=requestAnimationFrame(go)
    }
    raf.current=requestAnimationFrame(go)
    return ()=>{if(raf.current)cancelAnimationFrame(raf.current)}
  },[pct])

  // SVG arc
  const R=38,cx=50,cy=46,start=-210,sw=240
  const arc=(sd:number,s:number)=>{
    const r=(x:number)=>x*Math.PI/180,[a,b]=[r(sd),r(sd+s)]
    return `M${cx+R*Math.cos(a)} ${cy+R*Math.sin(a)} A${R} ${R} 0 ${s>180?1:0} 1 ${cx+R*Math.cos(b)} ${cy+R*Math.sin(b)}`
  }
  const fill = Math.min(v,100)/100*sw
  const col  = v>=90?'#4ade80':v>=60?'#fbbf24':'#f87171'
  const lbl  = v>=90?'En meta':v>=60?'En riesgo':'Crítico'

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
      <svg width="100%" viewBox="0 0 100 60" style={{overflow:'visible',filter:`drop-shadow(0 0 8px ${col}44)`}}>
        <path d={arc(start,sw)} fill="none" stroke="rgba(15,23,42,.8)" strokeWidth="9" strokeLinecap="round"/>
        {fill>0&&<path d={arc(start,fill)} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"/>}
        <text x={cx} y={cy+1} textAnchor="middle" fontSize="19" fontWeight="700"
          fontFamily={F} fill={col} style={{letterSpacing:'-.02em'}}>{v}%</text>
        <text x={cx} y={cy+14} textAnchor="middle" fontSize="7.5" fontWeight="600"
          fontFamily={F} fill={col} opacity=".85">{lbl}</text>
        {meta>0&&<text x={cx} y={cy+25} textAnchor="middle" fontSize="7"
          fontFamily={F} fill="rgba(148,163,184,.5)">meta {fN(meta)}</text>}
      </svg>
      <button onClick={onEdit} style={{
        fontSize:10,fontWeight:500,padding:'3px 12px',borderRadius:6,fontFamily:F,
        border:'1px solid rgba(161,216,26,.25)',background:'transparent',
        color:'rgba(161,216,26,.7)',cursor:'pointer',
      }}>{meta>0?'Editar meta':'+ Fijar meta'}</button>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   META MODAL
════════════════════════════════════════════════════════ */
function MetaModal({anio,mes,actual,onClose,onSaved}:{
  anio:number;mes:number;actual:number;onClose:()=>void;onSaved:(n:number)=>void
}) {
  const [v,setV]=useState(actual>0?String(actual):'')
  const [s,setS]=useState(false)
  async function save(){
    const x=parseInt(v,10); if(isNaN(x)||x<0)return; setS(true)
    try{
      await fetch('/api/metas/upsert',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({anio,mes,meta_negocios:x})})
      onSaved(x); onClose()
      toast.success(`Meta ${MESF[mes]} ${anio} → ${fN(x)}`)
    }finally{setS(false)}
  }
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{
      position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',
      justifyContent:'center',padding:16,background:'rgba(0,0,0,.7)',backdropFilter:'blur(8px)',
    }}>
      <div className="glass-bright" style={{padding:28,width:'100%',maxWidth:360,
        boxShadow:'0 0 40px rgba(161,216,26,.1)',fontFamily:F}}>
        <h3 style={{fontSize:17,fontWeight:700,color:'#f1f5f9',marginBottom:4}}>
          Meta de legalizaciones
        </h3>
        <p style={{fontSize:12,color:SLATE,marginBottom:20}}>
          {MESF[mes]} {anio} · número objetivo de aprobaciones
        </p>
        <label style={{display:'block',fontSize:10,fontWeight:600,textTransform:'uppercase',
          letterSpacing:'.06em',color:'rgba(148,163,184,.6)',marginBottom:7}}>
          Número objetivo
        </label>
        <input type="number" min="0" value={v}
          onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()}
          autoFocus placeholder="ej. 150"
          style={{width:'100%',padding:'11px 14px',borderRadius:9,
            border:'1px solid rgba(161,216,26,.3)',fontSize:22,fontWeight:700,
            color:'#f1f5f9',background:'rgba(15,23,42,.8)',fontFamily:F,
            marginBottom:16,outline:'none',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:'10px 0',borderRadius:9,
            border:'1px solid rgba(226,232,240,.12)',cursor:'pointer',fontFamily:F,
            background:'transparent',color:SLATE,fontWeight:600,fontSize:13}}>
            Cancelar
          </button>
          <button onClick={save} disabled={s||!v} style={{flex:1,padding:'10px 0',borderRadius:9,
            border:'none',cursor:'pointer',background:LIME2,color:SIDEBAR,
            fontWeight:700,fontFamily:F,fontSize:13,opacity:(s||!v)?.5:1}}>
            {s?'Guardando…':'Guardar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   DETAIL DRAWER — panel lateral con todos los campos
════════════════════════════════════════════════════════ */
function DetailDrawer({row,onClose}:{row:any;onClose:()=>void}) {
  const col  = STAGE_COLOR[row.etapa_codigo] || LIME
  const dtFmt= (s:string|null)=> s ? new Date(s).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'2-digit'}) : '—'
  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',
        backdropFilter:'blur(4px)',zIndex:40}}/>
      <div style={{
        position:'fixed',right:0,top:0,bottom:0,width:440,maxWidth:'95vw',zIndex:41,
        background:'linear-gradient(180deg,#0d1829 0%,#0B1120 100%)',
        borderLeft:'1px solid rgba(161,216,26,.15)',
        display:'flex',flexDirection:'column',fontFamily:F,
        boxShadow:'-20px 0 60px rgba(0,0,0,.5)',
      }}>
        {/* Header */}
        <div style={{padding:'18px 20px 14px',borderBottom:'1px solid rgba(161,216,26,.08)'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:col,
                  boxShadow:`0 0 6px ${col}`}}/>
                <span style={{fontSize:11,fontWeight:600,color:col,letterSpacing:'.04em',
                  textTransform:'uppercase'}}>
                  {STAGE_LABEL[row.etapa_codigo]||row.etapa_codigo}
                </span>
              </div>
              <h3 style={{fontSize:15,fontWeight:700,color:'#f1f5f9',lineHeight:1.3,
                wordBreak:'break-word'}}>
                {row.nombre_legalizacion||`Legalización #${row.hs_object_id}`}
              </h3>
              <p style={{fontSize:11,color:SLATE,marginTop:4}}>
                {row.proyecto} · {row.ciudad} · ID {row.hs_object_id}
              </p>
            </div>
            <button onClick={onClose} style={{background:'rgba(226,232,240,.06)',
              border:'1px solid rgba(226,232,240,.1)',borderRadius:8,
              color:SLATE,cursor:'pointer',width:30,height:30,
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              ✕
            </button>
          </div>
          {/* Link HubSpot destacado */}
          {row.hubspot_url && (
            <a href={row.hubspot_url} target="_blank" rel="noopener noreferrer"
              style={{display:'flex',alignItems:'center',gap:8,marginTop:12,
                padding:'8px 12px',borderRadius:8,background:'rgba(161,216,26,.08)',
                border:'1px solid rgba(161,216,26,.2)',textDecoration:'none',
                transition:'all .15s'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                  stroke={LIME} strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <span style={{fontSize:12,fontWeight:600,color:LIME}}>
                Abrir en HubSpot
              </span>
              <span style={{fontSize:10,color:'rgba(161,216,26,.5)',marginLeft:'auto'}}>
                → CRM
              </span>
            </a>
          )}
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:16}}>

          {/* Métricas rápidas */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[
              ['Valor',       fM(row.valor_del_inmueble), LIME],
              ['Lead time',   fD(row.dias_lead_time), row.dias_lead_time>30?'#f87171':row.dias_lead_time>15?'#fbbf24':'#4ade80'],
              ['Aging',       fD(row.aging_dias), '#94a3b8'],
            ].map(([l,v,c])=>(
              <div key={l as string} style={{background:'rgba(15,23,42,.6)',borderRadius:8,
                padding:'10px 12px',border:'1px solid rgba(226,232,240,.06)'}}>
                <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',
                  color:'rgba(148,163,184,.6)',marginBottom:4}}>{l}</p>
                <p style={{fontSize:16,fontWeight:700,color:c as string}}>{v}</p>
              </div>
            ))}
          </div>

          {/* Semáforo de venta — Motivo de Observación */}
          <div style={{background:'rgba(15,23,42,.6)',borderRadius:10,padding:'12px 14px',
            border:'1px solid rgba(226,232,240,.06)'}}>
            <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',
              color:'rgba(148,163,184,.5)',marginBottom:8}}>
              🚦 Semáforo de venta
            </p>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <SemaforoIcon s={row.motivo_semaforo}/>
              <p style={{fontSize:13,color:'#cbd5e1',lineHeight:1.4}}>
                {row.motivo_de_observacion || <span style={{opacity:.35}}>Sin observación</span>}
              </p>
            </div>
          </div>

          {/* Comprador */}
          <div style={{background:'rgba(15,23,42,.6)',borderRadius:10,padding:'12px 14px',
            border:'1px solid rgba(226,232,240,.06)'}}>
            <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',
              color:'rgba(148,163,184,.5)',marginBottom:8}}>
              👤 Comprador
            </p>
            <p style={{fontSize:13,fontWeight:600,color:'#f1f5f9',marginBottom:2}}>
              {row.nombrecomprador||'—'}
            </p>
            <p style={{fontSize:11,color:SLATE}}>CC {row.documento_comprador_1||'—'}</p>
          </div>

          {/* Unidad */}
          {(row.invdescunidad||row.numero_unidad||row.torre) && (
            <div style={{background:'rgba(15,23,42,.6)',borderRadius:10,padding:'12px 14px',
              border:'1px solid rgba(226,232,240,.06)'}}>
              <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',
                color:'rgba(148,163,184,.5)',marginBottom:8}}>🏢 Unidad</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {[
                  ['Descripción', row.invdescunidad],
                  ['Número', row.numero_unidad],
                  ['Torre', row.torre],
                  ['Director', row.director],
                ].filter(([,v])=>v).map(([l,v])=>(
                  <div key={l as string}>
                    <p style={{fontSize:9,color:'rgba(148,163,184,.5)',marginBottom:1}}>{l}</p>
                    <p style={{fontSize:12,fontWeight:500,color:'#cbd5e1'}}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Canal */}
          <div style={{background:'rgba(15,23,42,.6)',borderRadius:10,padding:'12px 14px',
            border:'1px solid rgba(226,232,240,.06)'}}>
            <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',
              color:'rgba(148,163,184,.5)',marginBottom:8}}>📡 Canal</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[
                ['Atribución', row.canal_atribucion],
                ['Gestión', row.canal_gestion_original],
              ].map(([l,v])=>(
                <div key={l as string}>
                  <p style={{fontSize:9,color:'rgba(148,163,184,.5)',marginBottom:1}}>{l}</p>
                  <p style={{fontSize:12,color:'#cbd5e1'}}>{v||'—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Estados */}
          <div style={{background:'rgba(15,23,42,.6)',borderRadius:10,padding:'12px 14px',
            border:'1px solid rgba(226,232,240,.06)'}}>
            <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',
              color:'rgba(148,163,184,.5)',marginBottom:8}}>⚙️ Estados</p>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {[
                ['SARLAFT',           row.estado_sarlaft],
                ['Verificación doc.', row.verificacion_documental],
                ['Decisión final',    row.decision_final],
              ].map(([l,v])=>(
                <div key={l as string} style={{display:'flex',justifyContent:'space-between',
                  alignItems:'center',padding:'4px 0',borderBottom:'1px solid rgba(226,232,240,.04)'}}>
                  <span style={{fontSize:11,color:SLATE}}>{l}</span>
                  <span style={{fontSize:11,fontWeight:600,color:'#e2e8f0'}}>{v||'—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fechas */}
          <div style={{background:'rgba(15,23,42,.6)',borderRadius:10,padding:'12px 14px',
            border:'1px solid rgba(226,232,240,.06)'}}>
            <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',
              color:'rgba(148,163,184,.5)',marginBottom:8}}>📅 Fechas</p>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {[
                ['Creación',     row.fecha_creacion],
                ['Aprobación',   row.fecha_aprobacion_final],
                ['Ventana cierre', row.en_ventana_cierre ? 'Sí — en ventana' : 'No'],
              ].map(([l,v])=>(
                <div key={l as string} style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:11,color:SLATE}}>{l}</span>
                  <span style={{fontSize:11,fontWeight:600,
                    color: l==='Ventana cierre'&&v==='Sí — en ventana' ? LIME : '#e2e8f0'}}>
                    {typeof v === 'string' && v.includes('-') ? dtFmt(v) : (v as string)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ════════════════════════════════════════════════════════
   MAIN DASHBOARD
════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const hoy=now()
  const [anio,setAnio]=useState(hoy.y)
  const [mes, setMes] =useState(hoy.mo)
  const [ciudad,   setCiudad]  =useState('')
  const [director, setDir]     =useState('')
  const [showMeta, setMeta]    =useState(false)
  const [pagina,   setPagina]  =useState(1)
  const [search,   setSearch]  =useState('')
  const [sortK,    setSortK]   =useState('proyecto')
  const [sortD,    setSortD]   =useState<'asc'|'desc'>('asc')
  const [selected, setSelected]=useState<any>(null)   // fila del drawer
  const [tabDet,   setTabDet]  =useState<'todos'|'pipeline'|'resolucion'|'caida'>('todos')

  const [kpis,    setK] =useState<any>(null)
  const [pipe,    setP] =useState<any>(null)
  const [tend,    setT] =useState<any>(null)
  const [times,   setTi]=useState<any>(null)
  const [proy,    setPr]=useState<any>(null)
  const [cana,    setCa]=useState<any>(null)
  const [det,     setDe]=useState<any>(null)
  const [ldDet,   setLd]=useState(false)
  const [loading, setLoading]=useState(true)

  const qs=useCallback(()=>{
    const p=new URLSearchParams({anio:String(anio),mes:String(mes)})
    if(ciudad)   p.set('ciudad',ciudad)
    if(director) p.set('director',director)
    return p.toString()
  },[anio,mes,ciudad,director])

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
    }finally{setLoading(false)}
  },[qs])

  const fetchDet=useCallback(async(pg=1,grupo=tabDet)=>{
    setLd(true)
    const q=qs()
    const p=new URLSearchParams(q)
    p.set('pagina',String(pg)); p.set('por_pagina','50')
    if(grupo!=='todos') p.set('grupo',grupo)
    try{ setDe(await fetch(`/api/detalle?${p.toString()}`).then(r=>r.json())); setPagina(pg) }
    finally{setLd(false)}
  },[qs,tabDet])

  useEffect(()=>{fetchAll()},[fetchAll])
  useEffect(()=>{fetchDet(1)},[fetchDet])

  const periodos:any[]=[]
  let pa=hoy.y,pm=hoy.mo
  for(let i=0;i<18;i++){periodos.push({y:pa,m:pm,l:`${MES[pm]} ${pa}`});pm--;if(pm<1){pm=12;pa--}}

  const proyRows=(()=>{
    if(!proy?.proyectos)return[]
    let r=[...proy.proyectos]
    if(search) r=r.filter((x:any)=>x.proyecto?.toLowerCase().includes(search.toLowerCase())||x.director?.toLowerCase().includes(search.toLowerCase()))
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

  const Sk=({h=100}:{h?:number})=><div className="shimmer" style={{height:h,borderRadius:10}}/>

  // ─── RENDER ─────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',fontFamily:F,color:'#e2e8f0',
      background:'linear-gradient(135deg,#050b14 0%,#0a192f 100%)'}}>

      {/* ── Drawer de detalle ─────────────────────────────────────── */}
      {selected && <DetailDrawer row={selected} onClose={()=>setSelected(null)}/>}
      {showMeta && kpis && (
        <MetaModal anio={anio} mes={mes} actual={kpis.meta_negocios}
          onClose={()=>setMeta(false)}
          onSaved={x=>{setK((p:any)=>p?{...p,meta_negocios:x,
            pct_cumplimiento:x>0?parseFloat(((p.aprobadas_exitoso+p.aprobadas_novedades)/x*100).toFixed(1)):0}:p);setMeta(false)}}/>
      )}

      {/* ══ SIDEBAR ══════════════════════════════════════════════════ */}
      <aside style={{width:220,flexShrink:0,display:'flex',flexDirection:'column',
        background:SIDEBAR,borderRight:'1px solid rgba(161,216,26,.1)',
        overflowY:'auto',zIndex:20}}>

        {/* Brand */}
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid rgba(161,216,26,.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:9,flexShrink:0,
              background:'linear-gradient(135deg,#003945,#A1D81A)',
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:'0 0 14px rgba(161,216,26,.35)'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke={LIME} strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{fontSize:13,fontWeight:700,color:'#f1f5f9',margin:0,letterSpacing:'-.01em'}}>
                Conaltura <span style={{color:LIME}}>·</span> BI
              </p>
              <p style={{fontSize:9,color:'rgba(161,216,26,.5)',letterSpacing:'.1em',
                textTransform:'uppercase',marginTop:1}}>Legalizaciones</p>
            </div>
          </div>
        </div>

        {/* Período */}
        <div style={{padding:'12px 14px 10px',borderBottom:'1px solid rgba(161,216,26,.06)'}}>
          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',
            color:'rgba(161,216,26,.45)',marginBottom:7}}>Período</p>
          <select value={`${anio}-${mes}`}
            onChange={e=>{const[a,mo]=e.target.value.split('-').map(Number);setAnio(a);setMes(mo)}}
            className="inp" style={{fontSize:12,fontWeight:600}}>
            {periodos.map(o=>(
              <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{o.l}</option>
            ))}
          </select>
        </div>

        {/* Filtros */}
        <div style={{padding:'12px 14px',flex:1,display:'flex',flexDirection:'column',gap:12,overflowY:'auto'}}>
          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',
            color:'rgba(161,216,26,.45)',margin:0}}>Filtros</p>

          {/* Ciudad chips */}
          <div>
            <p style={{fontSize:10,color:'rgba(148,163,184,.6)',marginBottom:6,fontWeight:500}}>Ciudad</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {CITIES.map(c=>{
                const active=ciudad===c
                return (
                  <button key={c} onClick={()=>setCiudad(active?'':c)} style={{
                    padding:'4px 8px',borderRadius:6,fontSize:10,cursor:'pointer',fontFamily:F,
                    fontWeight:active?700:400,
                    background:active?LIME2:'rgba(255,255,255,.06)',
                    color:active?SIDEBAR:'rgba(148,163,184,.8)',
                    border:`1px solid ${active?'rgba(161,216,26,.4)':'rgba(255,255,255,.08)'}`,
                    transition:'all .14s',
                  }}>{c}</button>
                )
              })}
            </div>
          </div>

          {/* Director */}
          <div>
            <p style={{fontSize:10,color:'rgba(148,163,184,.6)',marginBottom:6,fontWeight:500}}>Director</p>
            <select value={director} onChange={e=>setDir(e.target.value)}
              className="inp" style={{fontSize:11}}>
              <option value="">Todos</option>
              {DIRS.map(x=>(
                <option key={x} value={x}>{x.split(' ')[0]} {x.split(' ').slice(-1)[0]}</option>
              ))}
            </select>
          </div>

          {(ciudad||director)&&(
            <button onClick={()=>{setCiudad('');setDir('')}} style={{
              padding:'6px 0',borderRadius:7,border:'1px solid rgba(255,121,90,.25)',
              cursor:'pointer',background:'rgba(255,121,90,.08)',
              color:'#ff795a',fontSize:11,fontWeight:600,fontFamily:F}}>
              ✕ Limpiar filtros
            </button>
          )}

          <button onClick={()=>{fetchAll();fetchDet(1)}} style={{
            padding:'7px 0',borderRadius:8,border:'1px solid rgba(161,216,26,.2)',
            cursor:'pointer',background:'rgba(161,216,26,.06)',
            color:'rgba(161,216,26,.8)',fontSize:11,fontWeight:500,fontFamily:F}}>
            {loading?'⏳ Cargando…':'↺ Actualizar'}
          </button>
        </div>

        {/* Footer */}
        <div style={{padding:'10px 14px',borderTop:'1px solid rgba(161,216,26,.06)'}}>
          {kpis?.ultima_actualizacion&&(
            <p style={{fontSize:9,color:'rgba(148,163,184,.35)',marginBottom:5}}>
              ETL {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO',
                {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            </p>
          )}
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div className="live-dot"/>
            <span style={{fontSize:10,color:'rgba(161,216,26,.5)'}}>Live · cada 2h</span>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Topbar */}
        <header style={{
          flexShrink:0,display:'flex',alignItems:'center',
          justifyContent:'space-between',padding:'0 22px',height:52,
          background:'rgba(11,17,32,0.8)',backdropFilter:'blur(14px)',
          borderBottom:'1px solid rgba(161,216,26,.1)',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <h1 style={{fontSize:15,fontWeight:700,color:'#f1f5f9',margin:0,letterSpacing:'-.01em'}}>
              BI Legalizaciones
            </h1>
            <span style={{padding:'2px 9px',borderRadius:99,background:'rgba(161,216,26,.12)',
              border:'1px solid rgba(161,216,26,.3)',fontSize:10,fontWeight:600,
              color:LIME,display:'flex',alignItems:'center',gap:4,
              boxShadow:'0 0 8px rgba(161,216,26,.2)'}}>
              <div className="live-dot"/>LIVE
            </span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:12,color:'rgba(148,163,184,.6)'}}>
              {MESF[mes]} {anio}{ciudad?` · ${ciudad}`:''}{director?` · ${director.split(' ')[0]}`:''}
            </span>
            <select value={`${anio}-${mes}`}
              onChange={e=>{const[a,mo]=e.target.value.split('-').map(Number);setAnio(a);setMes(mo)}}
              style={{fontSize:12,fontWeight:600,padding:'5px 9px',borderRadius:7,
                border:'1px solid rgba(161,216,26,.2)',background:'rgba(15,23,42,.6)',
                color:'rgba(226,232,240,.9)',outline:'none',cursor:'pointer',fontFamily:F}}>
              {periodos.map(o=>(
                <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{o.l}</option>
              ))}
            </select>
            {loading&&(
              <div style={{width:8,height:8,borderRadius:'50%',
                border:`2px solid rgba(161,216,26,.25)`,borderTopColor:LIME,
                animation:'spin 1s linear infinite'}}/>
            )}
          </div>
        </header>

        {/* Scrollable content */}
        <main style={{flex:1,overflowY:'auto',padding:'18px 20px 60px',
          display:'flex',flexDirection:'column',gap:20}}>

          {/* ══ ROW 1: GAUGE + 6 KPIs ═══════════════════════════════ */}
          <section style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:14}}>

            {/* Gauge */}
            <div className="glass glow-border" style={{padding:'16px 14px',
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',left:0,top:0,bottom:0,width:3,
                background:LIME,boxShadow:`0 0 14px ${LIME}`}}/>
              <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',
                color:'rgba(161,216,26,.5)',textAlign:'center',marginBottom:8}}>
                Rendimiento General
              </p>
              {!kpis ? <Sk h={90}/> : (
                <Gauge pct={kpis.pct_cumplimiento} meta={kpis.meta_negocios} onEdit={()=>setMeta(true)}/>
              )}
            </div>

            {/* 6 KPI cards */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
              {!kpis ? Array(6).fill(0).map((_,i)=><Sk key={i} h={100}/>) : (()=>{
                const apr=kpis.aprobadas_exitoso+kpis.aprobadas_novedades
                const cards:{l:string;v:any;border:string;sub?:string}[] = [
                  {l:'Total del mes',        v:kpis.total_resolucion,    border:'#38bdf8',
                    sub:`${apr} aprobadas · ${kpis.rechazadas} rechazadas`},
                  {l:'Aprobadas sin novedad',v:kpis.aprobadas_exitoso,   border:'#4ade80',
                    sub:apr>0?`${((kpis.aprobadas_exitoso/apr)*100).toFixed(0)}% de aprobadas`:undefined},
                  {l:'Aprobadas con novedad',v:kpis.aprobadas_novedades, border:'#fbbf24',
                    sub:apr>0?`${((kpis.aprobadas_novedades/apr)*100).toFixed(0)}% de aprobadas`:undefined},
                  {l:'Rechazadas',           v:kpis.rechazadas,          border:kpis.rechazadas>0?'#f87171':'#475569',sub:undefined},
                  {l:'Ventas caídas',        v:kpis.ventas_caidas,       border:kpis.ventas_caidas>0?'#e11d48':'#475569',sub:undefined},
                  {l:'Ventana de cierre',    v:`${kpis.pct_ventana_cierre}%`, border:kpis.pct_ventana_cierre>40?'#fbbf24':LIME,
                    sub:`${kpis.en_ventana_cierre} en días límite`},
                ]
                return cards.map(k=>(
                  <div key={k.l} className="kpi"
                    style={{borderLeftColor:k.border}}>
                    <p className="kpi-label">{k.l}</p>
                    <p className="kpi-value">{typeof k.v==='number'?fN(k.v):k.v}</p>
                    {k.sub&&<p className="kpi-sub">{k.sub}</p>}
                  </div>
                ))
              })()}
            </div>
          </section>

          {/* ══ ROW 2: TABLA PROYECTOS ══════════════════════════════ */}
          <section>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div className="sec-bar"/>
                <div>
                  <h2 style={{fontSize:14,fontWeight:700,color:'#f1f5f9',margin:0}}>
                    Flujo de Proyectos
                  </h2>
                  <p style={{fontSize:10,color:SLATE,marginTop:1}}>
                    Resultados por proyecto · valor · lead time · sorteable
                  </p>
                </div>
              </div>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Buscar proyecto…"
                style={{padding:'5px 11px',borderRadius:7,border:'1px solid rgba(161,216,26,.2)',
                  background:'rgba(15,23,42,.6)',color:'#e2e8f0',fontSize:12,fontFamily:F,
                  outline:'none',width:170}}/>
            </div>

            <div className="glass" style={{overflow:'hidden'}}>
              <div style={{overflowX:'auto',maxHeight:360,overflowY:'auto',background:'rgba(11,17,32,.4)'}}>
                {!proy ? <div style={{padding:14}}><Sk h={200}/></div> : (
                  <table className="bi-table" style={{minWidth:980}}>
                    <thead>
                      <tr>
                        <th colSpan={3} style={{textAlign:'left'}}>Identificación</th>
                        <th colSpan={3} style={{textAlign:'center',color:'rgba(74,222,128,.6)'}}>Aprobadas</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(251,191,36,.6)'}}>Proceso</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(248,113,113,.6)'}}>Alertas</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(161,216,26,.4)'}}>Valor · Tiempo</th>
                      </tr>
                      <tr>
                        <th className={sortK==='proyecto'?'sorted':''} onClick={()=>srt('proyecto')}>Proyecto{arr('proyecto')}</th>
                        <th className={sortK==='director'?'sorted':''} onClick={()=>srt('director')}>Director{arr('director')}</th>
                        <th>Ciudad</th>
                        <th className={sortK==='aprobadas'?'sorted':''} onClick={()=>srt('aprobadas')} style={{textAlign:'right'}}>Total{arr('aprobadas')}</th>
                        <th style={{textAlign:'right'}}>Sin novedad</th>
                        <th style={{textAlign:'right'}}>Con novedad</th>
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
                        const pct=proy.total_aprobadas>0?(apr/proy.total_aprobadas*100).toFixed(1):'0.0'
                        return (
                          <tr key={r.proyecto||i}>
                            <td style={{fontWeight:600,color:'#f1f5f9',maxWidth:150,
                              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {r.proyecto||'—'}
                            </td>
                            <td style={{color:SLATE,fontSize:12}}>{r.director||'—'}</td>
                            <td style={{color:SLATE,fontSize:12}}>{r.ciudad||'—'}</td>
                            <td style={{textAlign:'right'}}>
                              <div style={{display:'flex',alignItems:'center',
                                justifyContent:'flex-end',gap:6}}>
                                <div style={{width:28,height:2.5,borderRadius:99,
                                  background:'rgba(255,255,255,.06)',overflow:'hidden'}}>
                                  <div style={{width:`${Math.min(Number(pct),100)}%`,
                                    height:'100%',background:LIME,borderRadius:99}}/>
                                </div>
                                <span style={{fontWeight:700,color:'#4ade80',fontSize:13}}>{fN(apr)}</span>
                              </div>
                            </td>
                            <td style={{textAlign:'right'}}>
                              <span style={{background:'rgba(74,222,128,.1)',color:'#4ade80',
                                padding:'1px 7px',borderRadius:5,fontWeight:600,fontSize:11}}>
                                {fN(r.exitosas)}
                              </span>
                            </td>
                            <td style={{textAlign:'right'}}>
                              <span style={{background:'rgba(251,191,36,.1)',color:'#fbbf24',
                                padding:'1px 7px',borderRadius:5,fontWeight:600,fontSize:11}}>
                                {fN(r.con_novedades)}
                              </span>
                            </td>
                            <td style={{textAlign:'right',color:'#fb923c',fontWeight:500,fontSize:12}}>
                              {fN(r.pipeline_activo)}
                            </td>
                            <td style={{textAlign:'right',fontSize:11,color:SLATE}}>{pct}%</td>
                            <td style={{textAlign:'right'}}>
                              {(r.rechazadas||0)>0
                                ? <span style={{background:'rgba(248,113,113,.1)',color:'#f87171',padding:'1px 7px',borderRadius:5,fontWeight:600,fontSize:11}}>{fN(r.rechazadas)}</span>
                                : <span style={{color:'rgba(148,163,184,.25)',fontSize:11}}>—</span>}
                            </td>
                            <td style={{textAlign:'right'}}>
                              {(r.ventas_caidas||0)>0
                                ? <span style={{background:'rgba(225,29,72,.12)',color:'#f43f5e',padding:'1px 7px',borderRadius:5,fontWeight:600,fontSize:11}}>{fN(r.ventas_caidas)}</span>
                                : <span style={{color:'rgba(148,163,184,.25)',fontSize:11}}>—</span>}
                            </td>
                            <td style={{textAlign:'right',fontWeight:600,color:LIME,fontSize:12}}>
                              {fM(r.suma_valor_inmueble)}
                            </td>
                            <td style={{textAlign:'right',fontSize:11,color:SLATE}}>
                              {fD(r.avg_lead_time)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{letterSpacing:'.04em',color:'rgba(161,216,26,.7)'}}>
                          TOTAL — {proy.proyectos?.length||0} proyectos
                        </td>
                        <td style={{textAlign:'right',color:'#4ade80',fontSize:14,fontWeight:700}}>
                          {fN(proy.total_aprobadas)}
                        </td>
                        <td colSpan={8}/>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* ══ ROW 3: PIPELINE + TENDENCIA ═════════════════════════ */}
          <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

            {/* Pipeline */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div className="sec-bar"/>
                <h2 style={{fontSize:14,fontWeight:700,color:'#f1f5f9',margin:0}}>
                  Pipeline Activo — {pipe?fN(pipe.total_pipeline):'…'}
                </h2>
              </div>
              <div className="glass" style={{padding:18}}>
                {!pipe ? <Sk h={160}/> : (()=>{
                  return (
                    <>
                      {pipe.caidas_del_mes>0&&(
                        <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 11px',
                          borderRadius:99,background:'rgba(225,29,72,.1)',
                          border:'1px solid rgba(225,29,72,.25)',marginBottom:12}}>
                          <span style={{fontWeight:700,fontSize:13,color:'#f43f5e'}}>{pipe.caidas_del_mes}</span>
                          <span style={{fontSize:11,color:'#f43f5e'}}>ventas caídas este mes</span>
                        </div>
                      )}
                      {/* Barra */}
                      <div style={{display:'flex',height:36,borderRadius:7,overflow:'hidden',gap:1.5,marginBottom:14}}>
                        {(pipe.stages||[]).map((s:any,i:number)=>{
                          const colors=['#125160','#1a6b7a','#1a7d6e','#279752']
                          if(!s.count)return null
                          return (
                            <div key={s.etapa_codigo} style={{flex:s.count,
                              background:colors[i]||'#125160',minWidth:4,
                              display:'flex',alignItems:'center',justifyContent:'center'}}>
                              {s.pct_del_total>9&&<span style={{color:'white',fontSize:12,fontWeight:700}}>{s.count}</span>}
                            </div>
                          )
                        })}
                      </div>
                      {/* Leyenda */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        {(pipe.stages||[]).map((s:any,i:number)=>{
                          const colors=['#125160','#1a6b7a','#1a7d6e','#279752']
                          return (
                            <div key={s.etapa_codigo} style={{display:'flex',gap:7,alignItems:'flex-start'}}>
                              <div style={{width:7,height:7,borderRadius:2,
                                background:colors[i]||'#125160',marginTop:3,flexShrink:0}}/>
                              <div>
                                <p style={{fontSize:11,fontWeight:600,color:'#e2e8f0',margin:0}}>{s.etapa_label}</p>
                                <p style={{fontSize:10,color:SLATE,margin:'1px 0 0'}}>
                                  {fN(s.count)} · {s.pct_del_total}%{s.aging_promedio!=null?` · ${s.aging_promedio}d`:''}
                                </p>
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

            {/* Tendencia */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div className="sec-bar"/>
                <h2 style={{fontSize:14,fontWeight:700,color:'#f1f5f9',margin:0}}>
                  Tendencia 14 meses
                </h2>
              </div>
              <div className="glass" style={{padding:18}}>
                {!tend ? <Sk h={190}/> : (
                  <>
                    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:10}}>
                      {[{c:LIME,l:'Aprobadas'},{c:'#f87171',l:'Rechazadas'},{c:'#e11d48',l:'Caídas'},{c:'rgba(161,216,26,.4)',l:'Meta',d:true}].map(({c,l,d})=>(
                        <div key={l} style={{display:'flex',alignItems:'center',gap:4}}>
                          <div style={{width:16,height:d?0:1.5,
                            borderTop:d?`1.5px dashed ${c}`:undefined,
                            background:d?undefined:c,borderRadius:99}}/>
                          <span style={{fontSize:10,color:SLATE}}>{l}</span>
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={tend.meses} margin={{top:4,right:4,left:-26,bottom:0}}>
                        <defs>
                          <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={LIME} stopOpacity={.15}/>
                            <stop offset="95%" stopColor={LIME} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/>
                        <XAxis dataKey="label" tick={{fontSize:9,fill:SLATE,fontFamily:F}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fill:SLATE,fontFamily:F}} axisLine={false} tickLine={false}/>
                        <Tooltip {...TT} formatter={(v:any,name:any)=>[fN(v),name==='aprobadas'?'Aprobadas':name==='rechazadas'?'Rechazadas':name==='ventas_caidas'?'Caídas':'Meta']}/>
                        <Area type="monotone" dataKey="meta" stroke="rgba(161,216,26,.35)" strokeWidth={1.5} strokeDasharray="4 3" fill="none" dot={false} connectNulls/>
                        <Area type="monotone" dataKey="aprobadas" stroke={LIME} strokeWidth={2} fill="url(#gL)" dot={{fill:LIME,r:2.5,strokeWidth:0}} activeDot={{r:4}}/>
                        <Area type="monotone" dataKey="rechazadas" stroke="#f87171" strokeWidth={1.5} fill="none" dot={{fill:'#f87171',r:2,strokeWidth:0}}/>
                        <Area type="monotone" dataKey="ventas_caidas" stroke="#e11d48" strokeWidth={1.5} fill="none" dot={{fill:'#e11d48',r:2,strokeWidth:0}}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ══ ROW 4: VELOCIDAD ════════════════════════════════════ */}
          <section>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div className="sec-bar"/>
              <h2 style={{fontSize:14,fontWeight:700,color:'#f1f5f9',margin:0}}>
                Velocidad del Proceso
              </h2>
            </div>
            <div className="glass" style={{padding:18}}>
              {!times ? <Sk h={160}/> : (()=>{
                const g=times.global
                return (
                  <>
                    {g?.p50_lead_time!=null&&(
                      <div style={{display:'flex',flexWrap:'wrap',gap:24,marginBottom:18,
                        padding:'14px 18px',borderRadius:9,background:'rgba(161,216,26,.05)',
                        border:'1px solid rgba(161,216,26,.12)'}}>
                        <div>
                          <p style={{fontSize:10,color:SLATE,marginBottom:3}}>La mitad se aprueba en menos de</p>
                          <p style={{fontSize:32,fontWeight:700,color:'#f1f5f9',margin:0,lineHeight:1,
                            textShadow:`0 0 20px ${LIME}33`}}>
                            {g.p50_lead_time}
                            <span style={{fontSize:14,fontWeight:400,color:SLATE,marginLeft:5}}>días</span>
                          </p>
                        </div>
                        {([['Promedio',g.avg_lead_time],['9 de cada 10',g.p90_lead_time]] as const).map(([l,v])=>(
                          <div key={l}><p style={{fontSize:10,color:SLATE,marginBottom:3}}>{l}</p>
                          <p style={{fontSize:18,fontWeight:700,color:'#e2e8f0',margin:0}}>{fD(v)}</p></div>
                        ))}
                      </div>
                    )}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                      {(times.por_stage||[]).filter((s:any)=>s.n>0).map((s:any)=>{
                        const col=!s.p50_dias?SLATE:s.p50_dias<=15?'#4ade80':s.p50_dias<=30?'#fbbf24':'#f87171'
                        return (
                          <div key={s.stage}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                              <span style={{fontSize:12,fontWeight:600,color:'#e2e8f0'}}>{s.label}</span>
                              <span style={{fontSize:14,fontWeight:700,color:'#f1f5f9'}}>{fD(s.avg_dias)}</span>
                            </div>
                            <div style={{height:6,borderRadius:99,background:'rgba(255,255,255,.06)',position:'relative',overflow:'hidden'}}>
                              <div style={{position:'absolute',inset:'0 auto 0 0',width:'25%',background:'#4ade80',opacity:.2}}/>
                              <div style={{position:'absolute',left:'25%',top:0,bottom:0,width:'25%',background:'#fbbf24',opacity:.2}}/>
                              {s.avg_dias!=null&&<div style={{position:'absolute',top:'50%',
                                left:`${Math.min((s.avg_dias/60)*100,96)}%`,
                                width:11,height:11,borderRadius:'50%',background:col,
                                border:'2px solid rgba(15,23,42,.8)',transform:'translate(-50%,-50%)'}}/>}
                            </div>
                            <div style={{display:'flex',gap:8,marginTop:3}}>
                              <span style={{fontSize:9,color:'rgba(148,163,184,.4)'}}>Med. {fD(s.p50_dias)}</span>
                              <span style={{fontSize:9,color:'rgba(148,163,184,.4)'}}>P90 {fD(s.p90_dias)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Ranking */}
                    {(times.por_proyecto||[]).length>0&&(
                      <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid rgba(255,255,255,.06)'}}>
                        <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',
                          color:'rgba(161,216,26,.4)',marginBottom:10}}>Ranking por proyecto</p>
                        <div style={{display:'flex',flexDirection:'column',gap:7}}>
                          {times.por_proyecto.slice(0,6).map((p:any)=>{
                            const maxLt=times.por_proyecto[0]?.avg_lead_time||1
                            const col=p.semaforo==='verde'?'#4ade80':p.semaforo==='amarillo'?'#fbbf24':'#f87171'
                            return (
                              <div key={p.proyecto}>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                                    <div style={{width:5,height:5,borderRadius:'50%',background:col,
                                      boxShadow:`0 0 4px ${col}`}}/>
                                    <span style={{fontSize:11,maxWidth:180,overflow:'hidden',
                                      textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#cbd5e1'}}>
                                      {p.proyecto}
                                    </span>
                                  </div>
                                  <span style={{fontSize:12,fontWeight:700,color:'#f1f5f9'}}>{fD(p.avg_lead_time)}</span>
                                </div>
                                <div style={{height:3,borderRadius:99,background:'rgba(255,255,255,.05)'}}>
                                  <div style={{height:'100%',borderRadius:99,background:col,opacity:.6,
                                    width:`${((p.avg_lead_time||0)/maxLt)*100}%`}}/>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </section>

          {/* ══ ROW 5: TABLA DETALLE CON SEMÁFORO ═══════════════════ */}
          <section>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div className="sec-bar"/>
                <div>
                  <h2 style={{fontSize:14,fontWeight:700,color:'#f1f5f9',margin:0}}>
                    Trazabilidad Individual
                  </h2>
                  <p style={{fontSize:10,color:SLATE,marginTop:1}}>
                    Clic en una fila para ver detalle · link directo a HubSpot · semáforo de venta
                  </p>
                </div>
              </div>
              {/* Tabs de grupo */}
              <div style={{display:'flex',gap:4,background:'rgba(15,23,42,.6)',
                borderRadius:8,padding:3,border:'1px solid rgba(161,216,26,.1)'}}>
                {([['todos','Todos'],['pipeline','Pipeline'],['resolucion','Aprobadas'],['caida','Caídas']] as const).map(([g,l])=>(
                  <button key={g} onClick={()=>{setTabDet(g);fetchDet(1,g)}}
                    style={{padding:'4px 10px',borderRadius:6,fontSize:11,fontWeight:600,
                      cursor:'pointer',border:'none',fontFamily:F,transition:'all .15s',
                      background:tabDet===g?LIME2:'transparent',
                      color:tabDet===g?SIDEBAR:'rgba(148,163,184,.7)'}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass" style={{overflow:'hidden'}}>
              <div style={{overflowX:'auto',maxHeight:340,overflowY:'auto',background:'rgba(11,17,32,.4)'}}>
                {!det ? <div style={{padding:14}}><Sk h={200}/></div> : (
                  <table className="bi-table" style={{minWidth:920}}>
                    <thead>
                      <tr>
                        <th style={{width:28}}></th>
                        <th colSpan={3} style={{textAlign:'left'}}>Legalización</th>
                        <th style={{textAlign:'center'}}>🚦</th>
                        <th colSpan={2} style={{textAlign:'center'}}>Estado</th>
                        <th style={{textAlign:'right'}}>Valor</th>
                        <th style={{textAlign:'right'}}>Lead</th>
                        <th style={{textAlign:'center'}}>CRM</th>
                      </tr>
                      <tr>
                        <th></th>
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
                          <tr key={i}>
                            {Array(10).fill(0).map((_,j)=>(
                              <td key={j}><div className="shimmer" style={{height:10,borderRadius:4}}/></td>
                            ))}
                          </tr>
                        ))
                        : (det.rows||[]).map((r:any)=>{
                          const col=STAGE_COLOR[r.etapa_codigo]||LIME
                          const ltCol=r.dias_lead_time==null?SLATE:r.dias_lead_time>30?'#f87171':r.dias_lead_time>15?'#fbbf24':'#4ade80'
                          return (
                            <tr key={r.hs_object_id}
                              onClick={()=>setSelected(r)}
                              style={{cursor:'pointer'}}>
                              {/* Stage dot */}
                              <td style={{textAlign:'center',paddingRight:4}}>
                                <div style={{width:7,height:7,borderRadius:'50%',background:col,
                                  margin:'0 auto',boxShadow:`0 0 5px ${col}88`}}/>
                              </td>
                              <td>
                                <p style={{fontWeight:600,fontSize:12,color:'#f1f5f9',margin:0,
                                  maxWidth:170,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                  {r.nombre_legalizacion||`#${r.hs_object_id}`}
                                </p>
                                <p style={{fontSize:9,color:'rgba(148,163,184,.4)',margin:0}}>
                                  ID {r.hs_object_id}
                                </p>
                              </td>
                              <td style={{fontSize:11,color:'#94a3b8',maxWidth:120,
                                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                {r.proyecto||'—'}
                              </td>
                              <td style={{fontSize:11,color:'#94a3b8'}}>
                                {r.nombrecomprador||'—'}
                              </td>
                              {/* Semáforo */}
                              <td style={{textAlign:'center'}}>
                                <SemaforoIcon s={r.motivo_semaforo}/>
                              </td>
                              <td>
                                <span style={{background:`${col}18`,color:col,
                                  padding:'2px 8px',borderRadius:99,
                                  fontSize:10,fontWeight:600,whiteSpace:'nowrap',display:'inline-block',
                                  border:`1px solid ${col}33`}}>
                                  {STAGE_LABEL[r.etapa_codigo]||r.etapa_codigo}
                                </span>
                              </td>
                              <td style={{fontSize:11,color:SLATE}}>
                                {r.canal_atribucion||'—'}
                              </td>
                              <td style={{textAlign:'right',fontSize:11,fontWeight:600,color:LIME}}>
                                {fM(r.valor_del_inmueble)}
                              </td>
                              <td style={{textAlign:'right',fontSize:12,fontWeight:700,color:ltCol}}>
                                {fD(r.dias_lead_time)}
                              </td>
                              {/* HubSpot */}
                              <td style={{textAlign:'center'}}>
                                <a href={r.hubspot_url} target="_blank" rel="noopener noreferrer"
                                  onClick={e=>e.stopPropagation()}
                                  title="Abrir en HubSpot"
                                  style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                                    width:27,height:27,borderRadius:6,
                                    background:'rgba(161,216,26,.08)',
                                    border:'1px solid rgba(161,216,26,.2)',
                                    textDecoration:'none',transition:'all .15s'}}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                                      stroke={LIME} strokeWidth="2.5" strokeLinecap="round"/>
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

              {/* Paginación */}
              {det?.total>50&&(
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'10px 14px',borderTop:'1px solid rgba(161,216,26,.08)',
                  background:'rgba(11,17,32,.4)'}}>
                  <button onClick={()=>fetchDet(pagina-1)} disabled={pagina<=1}
                    style={{fontSize:11,fontWeight:500,padding:'4px 12px',borderRadius:6,
                      border:'1px solid rgba(161,216,26,.15)',cursor:'pointer',
                      background:'transparent',color:SLATE,fontFamily:F,opacity:pagina<=1?.35:1}}>
                    ← Anterior
                  </button>
                  <span style={{fontSize:11,color:SLATE}}>
                    Pág. {pagina} · {fN(det.total)} registros
                  </span>
                  <button onClick={()=>fetchDet(pagina+1)}
                    disabled={pagina>=Math.ceil(det.total/50)}
                    style={{fontSize:11,fontWeight:500,padding:'4px 12px',borderRadius:6,
                      border:'1px solid rgba(161,216,26,.15)',cursor:'pointer',
                      background:'transparent',color:SLATE,fontFamily:F,
                      opacity:pagina>=Math.ceil(det.total/50)?.35:1}}>
                    Siguiente →
                  </button>
                </div>
              )}
            </div>

            {/* Instrucción de uso */}
            <p style={{fontSize:10,color:'rgba(148,163,184,.3)',marginTop:8,textAlign:'center'}}>
              Clic en cualquier fila para ver todos los campos · 🚦 = semáforo de motivo de observación
            </p>
          </section>

        </main>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
