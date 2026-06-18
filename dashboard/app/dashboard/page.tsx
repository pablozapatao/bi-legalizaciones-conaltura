'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import toast from 'react-hot-toast'

/* ═══════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Conaltura × Stitch
   system-ui en todos los contextos, sin dependencias externas
═══════════════════════════════════════════════════════════════════════ */
const C = {
  primary:  '#125160',
  dark:     '#003945',
  beige:    '#F4F0E5',
  beigeDk:  '#EDE9DC',
  accent:   '#A1D81A',
  accentLt: '#b9f23a',
  green:    '#166534',
  amber:    '#92400E',
  coral:    '#FF795A',
  red:      '#991B1B',
  white:    '#ffffff',
  stage:    ['#125160','#1a6b7a','#1a7d6e','#279752'],
} as const

const F = `system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`

/* ═══════════════════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════════════════ */
const MES  = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESF = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const n    = (v:any,d=0)=> v==null?'—':Number(v).toLocaleString('es-CO',{maximumFractionDigits:d})
const m    = (v:any)    => !v||!Number(v)?'—':`$${(Number(v)/1e6).toLocaleString('es-CO',{maximumFractionDigits:1})}M`
const d    = (v:any)    => v==null?'—':`${Number(v).toFixed(1)} d`
const now  = ()=>{ const x=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Bogota'})); return {y:x.getFullYear(),mo:x.getMonth()+1} }

const STAGES: Record<string,string> = {
  consignacion:'Consignación', legal_espera:'En Espera Dir.',
  legal_aprobada_dir:'Aprobada Dir.', revision_sinco:'Rev. SINCO',
  aprobado_exitoso:'Aprobado', aprobado_novedades:'Con Novedades',
  negocio_rechazado:'Rechazado', venta_caida:'Venta Caída',
}
// KPI left-border variant class
const kpiVar = (v:string) => ({
  teal:'kpi-teal', ok:'kpi-green', warn:'kpi-amber',
  coral:'kpi-coral', red:'kpi-red',
}[v] ?? 'kpi-teal')

const TT = {
  contentStyle:{ background:'#fff', border:'1px solid rgba(18,81,96,.1)', borderRadius:10, fontSize:12, fontFamily:F },
  labelStyle:{ color:C.primary, fontWeight:700, marginBottom:4 },
}

/* ═══════════════════════════════════════════════════════════════════════
   GAUGE — semicircular, estilo Stitch
═══════════════════════════════════════════════════════════════════════ */
function Gauge({ pct, meta, onEdit }:{ pct:number; meta:number; onEdit:()=>void }) {
  const [v,setV]=useState(0)
  const raf=useRef<number>()
  useEffect(()=>{
    const t=Math.min(pct,150),t0=performance.now(),dur=1200
    const go=(ts:number)=>{ const p=Math.min((ts-t0)/dur,1); setV(Math.round((1-Math.pow(1-p,3))*t)); if(p<1)raf.current=requestAnimationFrame(go) }
    raf.current=requestAnimationFrame(go)
    return ()=>{ if(raf.current)cancelAnimationFrame(raf.current) }
  },[pct])

  const R=62, cx=80, cy=74, start=-210, sw=240
  const arc=(sd:number,s:number)=>{
    const r=(x:number)=>x*Math.PI/180
    const [a,b]=[r(sd),r(sd+s)]
    return `M${cx+R*Math.cos(a)} ${cy+R*Math.sin(a)} A${R} ${R} 0 ${s>180?1:0} 1 ${cx+R*Math.cos(b)} ${cy+R*Math.sin(b)}`
  }
  const fill=Math.min(v,100)/100*sw
  const col=v>=90?C.green:v>=60?C.amber:C.coral

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
      <svg width="160" height="94" viewBox="0 0 160 94" style={{overflow:'visible'}}>
        {/* Track */}
        <path d={arc(start,sw)} fill="none" stroke="rgba(18,81,96,.08)" strokeWidth="10" strokeLinecap="round"/>
        {/* Fill */}
        {fill>0 && <path d={arc(start,fill)} fill="none" stroke={col} strokeWidth="10" strokeLinecap="round"/>}
        {/* Value */}
        <text x={cx} y={cy+2} textAnchor="middle" fontSize="28" fontWeight="700"
          fontFamily={F} fill={col} style={{letterSpacing:'-.02em'}}>{v}%</text>
        {/* Status */}
        <text x={cx} y={cy+18} textAnchor="middle" fontSize="10" fontWeight="500"
          fontFamily={F} fill={col} opacity=".8">
          {v>=90?'En meta':v>=60?'En riesgo':'Crítico'}
        </text>
        {/* Meta */}
        {meta>0 && <text x={cx} y={cy+32} textAnchor="middle" fontSize="9.5"
          fontFamily={F} fill="rgba(18,81,96,.4)">meta {n(meta)}</text>}
      </svg>
      <button onClick={onEdit} style={{
        fontSize:11,fontWeight:500,padding:'4px 14px',borderRadius:8,fontFamily:F,
        border:'1px solid rgba(18,81,96,.18)',background:'transparent',
        color:'rgba(18,81,96,.55)',cursor:'pointer',letterSpacing:'.01em',
      }}>
        {meta>0?'Editar meta':'+ Fijar meta'}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   META MODAL
═══════════════════════════════════════════════════════════════════════ */
function MetaModal({ anio,mes,actual,onClose,onSaved }:{
  anio:number;mes:number;actual:number;onClose:()=>void;onSaved:(n:number)=>void
}) {
  const [v,setV]=useState(actual>0?String(actual):'')
  const [s,setS]=useState(false)
  async function save(){
    const x=parseInt(v,10); if(isNaN(x)||x<0)return
    setS(true)
    try{
      await fetch('/api/metas/upsert',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({anio,mes,meta_negocios:x})})
      onSaved(x); onClose()
      toast.success(`Meta ${MESF[mes]} ${anio} → ${n(x)}`)
    }finally{setS(false)}
  }
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{
      position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',
      justifyContent:'center',padding:16,background:'rgba(0,57,69,.45)',backdropFilter:'blur(6px)',
    }}>
      <div style={{background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:360,
        boxShadow:'0 20px 60px rgba(0,57,69,.18)',border:'1px solid rgba(18,81,96,.1)',fontFamily:F}}>
        <h3 style={{fontSize:18,fontWeight:700,color:C.primary,marginBottom:4}}>
          Meta de legalizaciones
        </h3>
        <p style={{fontSize:12,color:'rgba(18,81,96,.5)',marginBottom:20,lineHeight:1.5}}>
          {MESF[mes]} {anio} · número objetivo de aprobaciones
        </p>
        <label style={{display:'block',fontSize:11,fontWeight:600,textTransform:'uppercase',
          letterSpacing:'.06em',color:'rgba(18,81,96,.45)',marginBottom:7}}>
          Número objetivo
        </label>
        <input type="number" min="0" value={v}
          onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()}
          autoFocus placeholder="ej. 150"
          style={{width:'100%',padding:'11px 14px',borderRadius:9,
            border:'1.5px solid rgba(18,81,96,.18)',fontSize:22,fontWeight:700,
            color:C.primary,fontFamily:F,marginBottom:16,outline:'none',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:'10px 0',borderRadius:9,
            border:'1px solid rgba(18,81,96,.14)',cursor:'pointer',fontFamily:F,
            background:'transparent',color:'rgba(18,81,96,.55)',fontWeight:600,fontSize:13}}>
            Cancelar
          </button>
          <button onClick={save} disabled={s||!v} style={{flex:1,padding:'10px 0',borderRadius:9,
            border:'none',cursor:'pointer',background:C.accentLt,color:C.primary,
            fontWeight:700,fontFamily:F,fontSize:13,opacity:(s||!v)?.5:1}}>
            {s?'Guardando…':'Guardar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION HEADER
═══════════════════════════════════════════════════════════════════════ */
function SH({ title, sub }:{ title:string; sub?:string }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
      <div className="sec-bar"/>
      <div>
        <h2 style={{fontSize:16,fontWeight:700,color:C.primary,margin:0,fontFamily:F,letterSpacing:'-.01em'}}>
          {title}
        </h2>
        {sub && <p style={{fontSize:11,color:'rgba(18,81,96,.5)',marginTop:2,fontFamily:F}}>{sub}</p>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const hoy=now()
  const [anio,setAnio]=useState(hoy.y)
  const [mes, setMes] =useState(hoy.mo)
  const [ciudad,  setCiudad] =useState('')
  const [director,setDir]    =useState('')
  const [showMeta,setMeta]   =useState(false)
  const [pagina,  setPagina] =useState(1)
  const [search,  setSearch] =useState('')
  const [sortK,   setSortK]  =useState('proyecto')
  const [sortD,   setSortD]  =useState<'asc'|'desc'>('asc')

  const [kpis,  setK] =useState<any>(null)
  const [pipe,  setP] =useState<any>(null)
  const [tend,  setT] =useState<any>(null)
  const [times, setTi]=useState<any>(null)
  const [mapa,  setMa]=useState<any>(null)
  const [proy,  setPr]=useState<any>(null)
  const [cana,  setCa]=useState<any>(null)
  const [det,   setDe]=useState<any>(null)
  const [ldDet, setLd]=useState(false)
  const [loading,setLoading]=useState(true)

  const qs=useCallback(()=>{
    const p=new URLSearchParams({anio:String(anio),mes:String(mes)})
    if(ciudad)   p.set('ciudad',ciudad)
    if(director) p.set('director',director)
    return p.toString()
  },[anio,mes,ciudad,director])

  const fetchAll=useCallback(async()=>{
    setLoading(true)
    setK(null);setP(null);setTi(null);setMa(null);setPr(null);setCa(null)
    const q=qs()
    const tq=new URLSearchParams({meses:'14',...Object.fromEntries(new URLSearchParams(q))}).toString()
    try{
      const [k,p,t,ti,ma,pr,ca]=await Promise.all([
        fetch(`/api/kpis?${q}`).then(r=>r.json()),
        fetch(`/api/pipeline?${q}`).then(r=>r.json()),
        fetch(`/api/tendencia?${tq}`).then(r=>r.json()),
        fetch(`/api/tiempos?${q}`).then(r=>r.json()),
        fetch(`/api/mapa?${q}`).then(r=>r.json()),
        fetch(`/api/proyectos?${q}`).then(r=>r.json()),
        fetch(`/api/canales?${q}`).then(r=>r.json()),
      ])
      setK(k);setP(p);setT(t);setTi(ti);setMa(ma);setPr(pr);setCa(ca)
    }finally{setLoading(false)}
  },[qs])

  const fetchDet=useCallback(async(pg=1)=>{
    setLd(true)
    try{ setDe(await fetch(`/api/detalle?${qs()}&pagina=${pg}&por_pagina=50`).then(r=>r.json())); setPagina(pg) }
    finally{setLd(false)}
  },[qs])

  useEffect(()=>{fetchAll()},[fetchAll])
  useEffect(()=>{fetchDet(1)},[fetchDet])

  // Período
  const periodos:any[]=[]
  let pa=hoy.y,pm=hoy.mo
  for(let i=0;i<18;i++){periodos.push({y:pa,m:pm,l:`${MES[pm]} ${pa}`});pm--;if(pm<1){pm=12;pa--}}

  // Proyectos table
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
  const chanColors=['#125160','#1a6b7a','#1a7d6e','#279752','#4d7c0f','#166534']

  // ── Skeleton ──────────────────────────────────────────────────────────
  const Sk=({h=120}:{h?:number})=><div className="shimmer" style={{height:h,borderRadius:14}}/>

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',fontFamily:F,color:C.primary,background:C.beige}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ══════════════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════════════ */}
      <aside style={{
        width:224,flexShrink:0,display:'flex',flexDirection:'column',
        background:C.primary,borderRight:'1px solid rgba(255,255,255,.08)',
        overflowY:'auto',zIndex:20,
      }}>
        {/* Brand */}
        <div style={{padding:'18px 16px 16px',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{
              width:38,height:38,borderRadius:10,flexShrink:0,
              background:'linear-gradient(135deg,#003945,#A1D81A)',
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:'0 3px 10px rgba(161,216,26,.22)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="#A1D81A" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{fontSize:14,fontWeight:700,color:'rgba(255,255,255,.9)',margin:0,letterSpacing:'-.01em'}}>
                Conaltura <span style={{color:C.accent}}>·</span> BI
              </p>
              <p style={{fontSize:9,color:'rgba(255,255,255,.4)',letterSpacing:'.1em',
                textTransform:'uppercase',marginTop:2}}>
                Legalizaciones
              </p>
            </div>
          </div>
        </div>

        {/* Período */}
        <div style={{padding:'14px 14px 12px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
          <p style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'.1em',
            color:'rgba(255,255,255,.4)',marginBottom:8}}>Período</p>
          <select value={`${anio}-${mes}`}
            onChange={e=>{const[a,mo]=e.target.value.split('-').map(Number);setAnio(a);setMes(mo)}}
            className="inp" style={{fontWeight:600,fontSize:13}}>
            {periodos.map(o=>(
              <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}
                style={{background:'#003945'}}>{o.l}</option>
            ))}
          </select>
        </div>

        {/* Filtros */}
        <div style={{padding:'14px',flex:1,display:'flex',flexDirection:'column',gap:14,overflowY:'auto'}}>
          <p style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'.1em',
            color:'rgba(255,255,255,.4)',margin:0}}>Filtros</p>

          {/* Chips de ciudad */}
          <div>
            <p style={{fontSize:10,color:'rgba(255,255,255,.55)',marginBottom:7,fontWeight:500}}>Ciudad</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {CITIES.map(c=>{
                const active=ciudad===c
                return (
                  <button key={c} onClick={()=>setCiudad(active?'':c)} style={{
                    padding:'5px 9px',borderRadius:8,fontSize:10,cursor:'pointer',
                    fontFamily:F,fontWeight:active?600:400,
                    background:active?C.accentLt:'rgba(255,255,255,.1)',
                    color:active?C.primary:'rgba(255,255,255,.7)',
                    border:'none',transition:'all .14s',
                  }}>
                    {active&&'✓ '}{c}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Director */}
          <div>
            <p style={{fontSize:10,color:'rgba(255,255,255,.55)',marginBottom:7,fontWeight:500}}>Director</p>
            <select value={director} onChange={e=>setDir(e.target.value)} className="inp" style={{fontSize:12}}>
              <option value="" style={{background:'#003945'}}>Todos</option>
              {DIRS.map(x=>(
                <option key={x} value={x} style={{background:'#003945'}}>
                  {x.split(' ')[0]} {x.split(' ').slice(-1)[0]}
                </option>
              ))}
            </select>
          </div>

          {(ciudad||director)&&(
            <button onClick={()=>{setCiudad('');setDir('')}} style={{
              padding:'7px 0',borderRadius:8,border:'1px solid rgba(255,121,90,.3)',
              cursor:'pointer',background:'rgba(255,121,90,.12)',
              color:C.coral,fontSize:11,fontWeight:600,fontFamily:F,
            }}>✕ Limpiar filtros</button>
          )}

          <button onClick={()=>{fetchAll();fetchDet(1)}} style={{
            padding:'8px 0',borderRadius:9,border:'1px solid rgba(255,255,255,.14)',
            cursor:'pointer',background:'rgba(255,255,255,.08)',
            color:'rgba(255,255,255,.75)',fontSize:11,fontWeight:500,fontFamily:F,
          }}>
            {loading?'⏳ Cargando…':'↺ Actualizar'}
          </button>
        </div>

        {/* Footer */}
        <div style={{padding:'12px 14px',borderTop:'1px solid rgba(255,255,255,.06)'}}>
          {kpis?.ultima_actualizacion&&(
            <p style={{fontSize:10,color:'rgba(255,255,255,.3)',marginBottom:5,fontFamily:F}}>
              ETL {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO',
                {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            </p>
          )}
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div className="live-dot"/>
            <span style={{fontSize:10,color:'rgba(255,255,255,.38)',fontFamily:F}}>
              Live · cada 2h
            </span>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════════════════════════ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Topbar */}
        <header style={{
          flexShrink:0,display:'flex',alignItems:'center',
          justifyContent:'space-between',padding:'0 22px',height:56,
          background:C.primary,borderBottom:'1px solid rgba(255,255,255,.07)',
        }}>
          <div>
            <h1 style={{fontSize:15,fontWeight:700,color:'rgba(255,255,255,.92)',
              margin:0,fontFamily:F,letterSpacing:'-.01em'}}>
              BI Legalizaciones <span style={{color:C.accent,fontWeight:400,fontSize:13}}>/ Principal</span>
            </h1>
            <p style={{fontSize:10,color:'rgba(255,255,255,.45)',marginTop:1,fontFamily:F}}>
              {MESF[mes]} {anio}{ciudad?` · ${ciudad}`:''}{director?` · ${director.split(' ')[0]}`:''} 
            </p>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {/* Selector rápido */}
            <select value={`${anio}-${mes}`}
              onChange={e=>{const[a,mo]=e.target.value.split('-').map(Number);setAnio(a);setMes(mo)}}
              style={{
                fontSize:12,fontWeight:600,padding:'6px 10px',borderRadius:8,
                border:'1px solid rgba(255,255,255,.18)',background:'rgba(255,255,255,.1)',
                color:'rgba(255,255,255,.9)',outline:'none',cursor:'pointer',fontFamily:F,
              }}>
              {periodos.map(o=>(
                <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}
                  style={{background:'#003945'}}>{o.l}</option>
              ))}
            </select>

            {/* Loading */}
            {loading&&(
              <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',
                borderRadius:8,background:'rgba(255,255,255,.1)'}}>
                <div style={{width:8,height:8,borderRadius:'50%',
                  border:'2px solid rgba(161,216,26,.3)',borderTopColor:C.accent,
                  animation:'spin 1s linear infinite'}}/>
                <span style={{fontSize:11,color:'rgba(255,255,255,.75)',fontFamily:F}}>Cargando</span>
              </div>
            )}

            {/* Live badge */}
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',
              borderRadius:8,background:'rgba(161,216,26,.1)',
              border:'1px solid rgba(161,216,26,.2)'}}>
              <div className="live-dot"/>
              <span style={{fontSize:11,fontWeight:600,color:C.accent,fontFamily:F}}>LIVE</span>
            </div>
          </div>
        </header>

        {/* ── Scrollable content ──────────────────────────────────────── */}
        <main style={{flex:1,overflowY:'auto',padding:'24px 22px 60px',
          display:'flex',flexDirection:'column',gap:28}}>

          {/* ╔══════════════════════════════════════════════════╗
              ║  1. KPIs                                        ║
              ╚══════════════════════════════════════════════════╝ */}
          <section>
            <SH title="Rendimiento General"
              sub={`Legalizaciones aprobadas en ${MESF[mes]} ${anio}`}/>
            {!kpis ? <Sk h={220}/> : (()=>{
              const apr=kpis.aprobadas_exitoso+kpis.aprobadas_novedades
              return (
                <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:14}}>

                  {/* Gauge card */}
                  <div className="card" style={{
                    padding:'20px 14px',display:'flex',flexDirection:'column',
                    alignItems:'center',justifyContent:'center',
                  }}>
                    <p style={{fontSize:9,fontWeight:600,textTransform:'uppercase',
                      letterSpacing:'.1em',color:'rgba(18,81,96,.38)',textAlign:'center',
                      marginBottom:8,fontFamily:F}}>
                      Cumplimiento vs meta
                    </p>
                    <Gauge pct={kpis.pct_cumplimiento} meta={kpis.meta_negocios}
                      onEdit={()=>setMeta(true)}/>
                  </div>

                  {/* 6 KPI cards */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                    {([
                      {l:'Total del mes',         v:kpis.total_resolucion,    var:'teal',
                        sub:`${apr} aprobadas · ${kpis.rechazadas} rechazadas`},
                      {l:'Aprobadas sin novedad', v:kpis.aprobadas_exitoso,   var:'ok',
                        sub:apr>0?`${((kpis.aprobadas_exitoso/apr)*100).toFixed(0)}% de las aprobadas`:undefined},
                      {l:'Aprobadas con novedad', v:kpis.aprobadas_novedades, var:'warn',
                        sub:apr>0?`${((kpis.aprobadas_novedades/apr)*100).toFixed(0)}% de las aprobadas`:undefined},
                      {l:'Rechazadas',            v:kpis.rechazadas,           var:'coral', sub:undefined},
                      {l:'Ventas caídas',          v:kpis.ventas_caidas,        var:'red',   sub:undefined},
                      {l:'En ventana de cierre',   v:`${kpis.pct_ventana_cierre}%`, var:'teal',
                        sub:`${kpis.en_ventana_cierre} aprobadas en días límite`},
                    ] as const).map(k=>(
                      <div key={k.l} className={`kpi-card ${kpiVar(k.var)}`}>
                        <p className="kpi-label">{k.l}</p>
                        <p className="kpi-value">{typeof k.v==='number'?n(k.v):k.v}</p>
                        {k.sub&&<p className="kpi-sub">{k.sub}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </section>

          {/* ╔══════════════════════════════════════════════════╗
              ║  2. FLUJO DE PROYECTOS                          ║
              ╚══════════════════════════════════════════════════╝ */}
          <section>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="sec-bar"/>
                <div>
                  <h2 style={{fontSize:16,fontWeight:700,color:C.primary,margin:0,fontFamily:F,letterSpacing:'-.01em'}}>
                    Flujo de Proyectos
                  </h2>
                  <p style={{fontSize:11,color:'rgba(18,81,96,.5)',marginTop:2,fontFamily:F}}>
                    Unidades · valor en COP · lead time · sorteable por columna
                  </p>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Buscar proyecto…"
                  style={{padding:'6px 12px',borderRadius:8,border:'1px solid rgba(18,81,96,.14)',
                    background:'white',color:C.primary,fontSize:12,fontFamily:F,outline:'none',width:180}}/>
                <span style={{fontSize:11,color:'rgba(18,81,96,.4)',fontFamily:F}}>
                  {proy?.proyectos?.length||0} proyectos
                </span>
              </div>
            </div>

            <div style={{borderRadius:14,overflow:'hidden',border:'1px solid rgba(18,81,96,.08)'}}>
              <div style={{overflowX:'auto',maxHeight:400,overflowY:'auto',background:C.beigeDk}}>
                {!proy ? <div style={{padding:16}}><Sk h={200}/></div> : (
                  <table className="bi-table" style={{minWidth:1060}}>
                    <thead>
                      <tr>
                        <th colSpan={3} style={{textAlign:'left'}}>Identificación</th>
                        <th colSpan={3} style={{textAlign:'center',color:'rgba(186,242,58,.7)'}}>Aprobadas</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(255,179,130,.7)'}}>Proceso</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(255,150,130,.7)'}}>Alertas</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(255,255,255,.4)'}}>Valor · Tiempo</th>
                      </tr>
                      <tr>
                        <th className={sortK==='proyecto'?'sorted':''} onClick={()=>srt('proyecto')}>Proyecto{arr('proyecto')}</th>
                        <th className={sortK==='director'?'sorted':''} onClick={()=>srt('director')}>Director{arr('director')}</th>
                        <th className={sortK==='ciudad'?'sorted':''} onClick={()=>srt('ciudad')}>Ciudad{arr('ciudad')}</th>
                        <th className={sortK==='aprobadas'?'sorted':''} onClick={()=>srt('aprobadas')} style={{textAlign:'right'}}>Total{arr('aprobadas')}</th>
                        <th style={{textAlign:'right'}}>Sin novedad</th>
                        <th style={{textAlign:'right'}}>Con novedad</th>
                        <th className={sortK==='pipeline_activo'?'sorted':''} onClick={()=>srt('pipeline_activo')} style={{textAlign:'right'}}>Pipeline{arr('pipeline_activo')}</th>
                        <th style={{textAlign:'right'}}>% total</th>
                        <th className={sortK==='rechazadas'?'sorted':''} onClick={()=>srt('rechazadas')} style={{textAlign:'right'}}>Rechazadas{arr('rechazadas')}</th>
                        <th className={sortK==='ventas_caidas'?'sorted':''} onClick={()=>srt('ventas_caidas')} style={{textAlign:'right'}}>Caídas{arr('ventas_caidas')}</th>
                        <th className={sortK==='suma_valor_inmueble'?'sorted':''} onClick={()=>srt('suma_valor_inmueble')} style={{textAlign:'right'}}>Valor{arr('suma_valor_inmueble')}</th>
                        <th className={sortK==='avg_lead_time'?'sorted':''} onClick={()=>srt('avg_lead_time')} style={{textAlign:'right'}}>Lead time{arr('avg_lead_time')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proyRows.map((r:any,i:number)=>{
                        const apr=(r.exitosas||0)+(r.con_novedades||0)
                        const pct=proy.total_aprobadas>0?(apr/proy.total_aprobadas*100).toFixed(1):'0.0'
                        return (
                          <tr key={r.proyecto||i}>
                            <td style={{fontWeight:600,maxWidth:155,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {r.proyecto||'Sin asignar'}
                            </td>
                            <td style={{fontSize:11,color:'rgba(18,81,96,.6)'}}>{r.director||'—'}</td>
                            <td style={{fontSize:11,color:'rgba(18,81,96,.6)'}}>{r.ciudad||'—'}</td>
                            <td style={{textAlign:'right'}}>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:7}}>
                                <div style={{width:30,height:3,borderRadius:99,
                                  background:'rgba(18,81,96,.1)',overflow:'hidden'}}>
                                  <div style={{width:`${Math.min(Number(pct),100)}%`,height:'100%',
                                    background:C.primary,borderRadius:99}}/>
                                </div>
                                <span style={{fontWeight:700,color:C.green,fontSize:13}}>{n(apr)}</span>
                              </div>
                            </td>
                            <td style={{textAlign:'right'}}>
                              <span style={{padding:'2px 8px',borderRadius:6,
                                background:'rgba(22,101,52,.1)',color:C.green,fontWeight:600,fontSize:11}}>
                                {n(r.exitosas)}
                              </span>
                            </td>
                            <td style={{textAlign:'right'}}>
                              <span style={{padding:'2px 8px',borderRadius:6,
                                background:'rgba(146,64,14,.1)',color:C.amber,fontWeight:600,fontSize:11}}>
                                {n(r.con_novedades)}
                              </span>
                            </td>
                            <td style={{textAlign:'right',color:'#C2410C',fontWeight:500,fontSize:12}}>
                              {n(r.pipeline_activo)}
                            </td>
                            <td style={{textAlign:'right',fontSize:11,color:'rgba(18,81,96,.5)'}}>
                              {pct}%
                            </td>
                            <td style={{textAlign:'right'}}>
                              {(r.rechazadas||0)>0
                                ? <span style={{padding:'2px 8px',borderRadius:6,background:'rgba(255,121,90,.1)',color:C.coral,fontWeight:600,fontSize:11}}>{n(r.rechazadas)}</span>
                                : <span style={{color:'rgba(18,81,96,.3)',fontSize:11}}>—</span>}
                            </td>
                            <td style={{textAlign:'right'}}>
                              {(r.ventas_caidas||0)>0
                                ? <span style={{padding:'2px 8px',borderRadius:6,background:'rgba(153,27,27,.1)',color:C.red,fontWeight:600,fontSize:11}}>{n(r.ventas_caidas)}</span>
                                : <span style={{color:'rgba(18,81,96,.3)',fontSize:11}}>—</span>}
                            </td>
                            <td style={{textAlign:'right',fontWeight:600,fontSize:12}}>
                              {m(r.suma_valor_inmueble)}
                            </td>
                            <td style={{textAlign:'right',fontSize:11,color:'rgba(18,81,96,.55)'}}>
                              {d(r.avg_lead_time)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{fontWeight:700,letterSpacing:'.03em'}}>
                          TOTAL — {proy.proyectos?.length||0} proyectos
                        </td>
                        <td style={{textAlign:'right',color:'rgba(186,242,58,.9)',fontSize:13,fontWeight:700}}>
                          {n(proy.total_aprobadas)}
                        </td>
                        <td colSpan={8}/>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* ╔══════════════════════════════════════════════════╗
              ║  3. PIPELINE + TENDENCIA                        ║
              ╚══════════════════════════════════════════════════╝ */}
          <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

            {/* Pipeline */}
            <div>
              <SH title={`Estado del Pipeline — ${pipe?n(pipe.total_pipeline):'…'} activas`}
                sub="Legalizaciones sin fecha de aprobación"/>
              <div className="card" style={{padding:20}}>
                {!pipe ? <Sk h={180}/> : (()=>{
                  const tot=pipe.total_pipeline||1
                  return (
                    <>
                      {pipe.caidas_del_mes>0&&(
                        <div style={{display:'inline-flex',alignItems:'center',gap:6,
                          padding:'5px 12px',borderRadius:99,
                          background:'rgba(153,27,27,.08)',
                          border:'1px solid rgba(153,27,27,.15)',
                          marginBottom:14}}>
                          <span style={{fontWeight:700,fontSize:13,color:C.red}}>
                            {pipe.caidas_del_mes}
                          </span>
                          <span style={{fontSize:11,color:C.red}}>ventas caídas este mes</span>
                        </div>
                      )}
                      <p style={{fontSize:13,lineHeight:1.6,marginBottom:14,
                        color:'rgba(18,81,96,.65)',fontFamily:F}}>
                        <strong style={{color:C.primary,fontWeight:700}}>{n(pipe.total_pipeline)}</strong>
                        {' '}legalizaciones activas en{' '}
                        {pipe.stages?.filter((s:any)=>s.count>0).length} etapas del proceso.
                      </p>

                      {/* Barra proporcional */}
                      <div style={{display:'flex',height:40,borderRadius:8,overflow:'hidden',
                        gap:2,marginBottom:16}}>
                        {(pipe.stages||[]).map((s:any,i:number)=>{
                          if(!s.count)return null
                          return (
                            <div key={s.etapa_codigo} title={`${s.etapa_label}: ${s.count}`}
                              style={{flex:s.count,background:C.stage[i]||C.primary,minWidth:4,
                                display:'flex',alignItems:'center',justifyContent:'center',
                                transition:'flex .7s'}}>
                              {s.pct_del_total>9&&(
                                <span style={{color:'white',fontSize:12,fontWeight:700,fontFamily:F}}>
                                  {s.count}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Leyenda */}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
                        {(pipe.stages||[]).map((s:any,i:number)=>(
                          <div key={s.etapa_codigo} style={{display:'flex',alignItems:'flex-start',gap:8}}>
                            <div style={{width:8,height:8,borderRadius:2,
                              background:C.stage[i]||C.primary,marginTop:3,flexShrink:0}}/>
                            <div>
                              <p style={{fontSize:11,fontWeight:600,margin:0,fontFamily:F}}>
                                {s.etapa_label}
                              </p>
                              <p style={{fontSize:10,color:'rgba(18,81,96,.45)',
                                margin:'1px 0 0',fontFamily:F}}>
                                {n(s.count)} · {s.pct_del_total}%
                                {s.aging_promedio!=null?` · ${s.aging_promedio}d`:''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Tendencia */}
            <div>
              <SH title="Tendencia Mensual" sub="Últimos 14 meses · aprobadas · meta · rechazadas"/>
              <div className="card" style={{padding:20}}>
                {!tend ? <Sk h={200}/> : (
                  <>
                    <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:14}}>
                      {[
                        {c:C.primary,l:'Aprobadas'},
                        {c:C.coral,  l:'Rechazadas'},
                        {c:C.red,    l:'Caídas'},
                        {c:C.accent, l:'Meta',dashed:true},
                      ].map(({c,l,dashed})=>(
                        <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                          <div style={{width:18,height:dashed?0:2,
                            borderTop:dashed?`2px dashed ${c}`:undefined,
                            background:dashed?undefined:c,borderRadius:99}}/>
                          <span style={{fontSize:11,color:'rgba(18,81,96,.55)',fontFamily:F}}>{l}</span>
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart data={tend.meses}
                        margin={{top:4,right:6,left:-24,bottom:0}}>
                        <defs>
                          <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={C.primary} stopOpacity={.1}/>
                            <stop offset="95%" stopColor={C.primary} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,81,96,.05)"/>
                        <XAxis dataKey="label"
                          tick={{fontSize:9,fill:'rgba(18,81,96,.45)',fontFamily:F}}
                          axisLine={false} tickLine={false}/>
                        <YAxis
                          tick={{fontSize:9,fill:'rgba(18,81,96,.4)',fontFamily:F}}
                          axisLine={false} tickLine={false}/>
                        <Tooltip {...TT}
                          formatter={(v:any,name:any)=>[n(v),
                            name==='aprobadas'?'Aprobadas':
                            name==='rechazadas'?'Rechazadas':
                            name==='ventas_caidas'?'Caídas':'Meta']}/>
                        <Area type="monotone" dataKey="meta"
                          stroke={C.accent} strokeWidth={1.5} strokeDasharray="5 3"
                          fill="none" dot={false} connectNulls/>
                        <Area type="monotone" dataKey="aprobadas"
                          stroke={C.primary} strokeWidth={2} fill="url(#gA)"
                          dot={{fill:C.primary,r:2.5,strokeWidth:0}} activeDot={{r:4}}/>
                        <Area type="monotone" dataKey="rechazadas"
                          stroke={C.coral} strokeWidth={1.5} fill="none"
                          dot={{fill:C.coral,r:2,strokeWidth:0}}/>
                        <Area type="monotone" dataKey="ventas_caidas"
                          stroke={C.red} strokeWidth={1.5} fill="none"
                          dot={{fill:C.red,r:2,strokeWidth:0}}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ╔══════════════════════════════════════════════════╗
              ║  4. VELOCIDAD                                    ║
              ╚══════════════════════════════════════════════════╝ */}
          <section>
            <SH title="Velocidad del Proceso"
              sub="Lead time · duración por etapa · semáforo por proyecto"/>
            <div className="card" style={{padding:22}}>
              {!times ? <Sk h={200}/> : (()=>{
                const g=times.global
                return (
                  <>
                    {/* Hero stat */}
                    {g?.p50_lead_time!=null&&(
                      <div style={{display:'flex',flexWrap:'wrap',gap:28,marginBottom:22,
                        padding:'16px 20px',borderRadius:10,background:C.beigeDk}}>
                        <div>
                          <p style={{fontSize:11,color:'rgba(18,81,96,.45)',
                            marginBottom:4,fontFamily:F}}>
                            La mitad se aprueba en menos de
                          </p>
                          <p style={{fontSize:36,fontWeight:700,color:C.primary,
                            margin:0,lineHeight:1,fontFamily:F,letterSpacing:'-.02em'}}>
                            {g.p50_lead_time}
                            <span style={{fontSize:16,fontWeight:400,
                              color:'rgba(18,81,96,.5)',marginLeft:6}}>días</span>
                          </p>
                        </div>
                        {([['Promedio',g.avg_lead_time],['9 de cada 10',g.p90_lead_time]] as const).map(([l,v])=>(
                          <div key={l}>
                            <p style={{fontSize:11,color:'rgba(18,81,96,.45)',marginBottom:4,fontFamily:F}}>{l}</p>
                            <p style={{fontSize:20,fontWeight:700,color:C.primary,margin:0,fontFamily:F}}>{d(v)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Por stage */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:20}}>
                      {(times.por_stage||[]).filter((s:any)=>s.n>0).map((s:any)=>{
                        const col=!s.p50_dias?'rgba(18,81,96,.3)':
                          s.p50_dias<=15?C.green:s.p50_dias<=30?C.amber:C.coral
                        const lbl=!s.p50_dias?'':
                          s.p50_dias<=15?'Rápido':s.p50_dias<=30?'Normal':'Lento'
                        return (
                          <div key={s.stage}>
                            <div style={{display:'flex',justifyContent:'space-between',
                              alignItems:'center',marginBottom:7}}>
                              <span style={{fontSize:12,fontWeight:600,fontFamily:F}}>{s.label}</span>
                              <div style={{display:'flex',alignItems:'center',gap:8}}>
                                {lbl&&<span style={{fontSize:10,fontWeight:500,color:col,fontFamily:F}}>
                                  {lbl}
                                </span>}
                                <span style={{fontSize:15,fontWeight:700,
                                  color:C.primary,fontFamily:F}}>{d(s.avg_dias)}</span>
                              </div>
                            </div>
                            {/* Barra con zonas */}
                            <div style={{height:8,borderRadius:99,
                              background:'rgba(18,81,96,.07)',position:'relative',overflow:'hidden'}}>
                              <div style={{position:'absolute',inset:'0 auto 0 0',
                                width:'25%',background:C.green,opacity:.15}}/>
                              <div style={{position:'absolute',left:'25%',top:0,bottom:0,
                                width:'25%',background:C.amber,opacity:.15}}/>
                              {s.avg_dias!=null&&(
                                <div style={{
                                  position:'absolute',top:'50%',
                                  left:`${Math.min((s.avg_dias/60)*100,96)}%`,
                                  width:12,height:12,borderRadius:'50%',
                                  background:col,border:'2px solid white',
                                  transform:'translate(-50%,-50%)',
                                }}/>
                              )}
                            </div>
                            <div style={{display:'flex',gap:10,marginTop:4}}>
                              {[['Med.',d(s.p50_dias)],['P90',d(s.p90_dias)],[`n=${n(s.n)}`,'']]
                                .map(([lk,lv])=>(
                                <span key={lk} style={{fontSize:9,
                                  color:'rgba(18,81,96,.35)',fontFamily:F}}>
                                  {lk}{lv?' '+lv:''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Ranking proyectos */}
                    {(times.por_proyecto||[]).length>0&&(
                      <>
                        <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',
                          letterSpacing:'.07em',color:'rgba(18,81,96,.35)',
                          marginBottom:12,fontFamily:F}}>
                          Velocidad por proyecto
                        </p>
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                          {times.por_proyecto.slice(0,8).map((p:any)=>{
                            const maxLt=times.por_proyecto[0]?.avg_lead_time||1
                            const col=p.semaforo==='verde'?C.green:
                              p.semaforo==='amarillo'?C.amber:
                              p.semaforo==='rojo'?C.coral:'rgba(18,81,96,.3)'
                            return (
                              <div key={p.proyecto}>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                                    <div style={{width:6,height:6,borderRadius:'50%',
                                      background:col,flexShrink:0}}/>
                                    <span style={{fontSize:11,fontWeight:500,maxWidth:190,
                                      overflow:'hidden',textOverflow:'ellipsis',
                                      whiteSpace:'nowrap',fontFamily:F}}>
                                      {p.proyecto}
                                    </span>
                                    <span style={{fontSize:10,color:'rgba(18,81,96,.35)',fontFamily:F}}>
                                      ({n(p.n)})
                                    </span>
                                  </div>
                                  <span style={{fontSize:12,fontWeight:700,
                                    color:C.primary,fontFamily:F}}>
                                    {d(p.avg_lead_time)}
                                  </span>
                                </div>
                                <div style={{height:4,borderRadius:99,
                                  background:'rgba(18,81,96,.07)'}}>
                                  <div style={{height:'100%',borderRadius:99,background:col,
                                    opacity:.65,
                                    width:`${((p.avg_lead_time||0)/maxLt)*100}%`,
                                    transition:'width .6s'}}/>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{display:'flex',gap:14,marginTop:12,paddingTop:10,
                          borderTop:'1px solid rgba(18,81,96,.07)'}}>
                          {([{c:C.green,l:'Rápido (≤15d)'},{c:C.amber,l:'Normal (16–30d)'},{c:C.coral,l:'Lento (>30d)'}]).map(({c,l})=>(
                            <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                              <div style={{width:6,height:6,borderRadius:'50%',background:c}}/>
                              <span style={{fontSize:10,color:'rgba(18,81,96,.45)',fontFamily:F}}>{l}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )
              })()}
            </div>
          </section>

          {/* ╔══════════════════════════════════════════════════╗
              ║  5. CANALES + CIUDADES                          ║
              ╚══════════════════════════════════════════════════╝ */}
          <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

            {/* Canales */}
            <div>
              <SH title="Canales de Atribución" sub="Aprobaciones por canal de origen"/>
              <div className="card" style={{padding:18}}>
                {!cana ? <Sk h={160}/> : (()=>{
                  const rows=(cana.por_atribucion||[]).filter((r:any)=>r.canal&&r.canal!=='')
                  if(!rows.length) return (
                    <p style={{fontSize:12,color:'rgba(18,81,96,.4)',fontFamily:F,padding:'20px 0',textAlign:'center'}}>
                      Sin datos de canal para este período
                    </p>
                  )
                  const maxA=Math.max(...rows.map((r:any)=>r.aprobadas),1)
                  return (
                    <div style={{display:'flex',flexDirection:'column',gap:9}}>
                      {rows.map((r:any,i:number)=>(
                        <div key={r.canal} style={{display:'flex',alignItems:'center',gap:10}}>
                          <span style={{fontSize:11,fontWeight:500,width:155,flexShrink:0,
                            overflow:'hidden',textOverflow:'ellipsis',
                            whiteSpace:'nowrap',fontFamily:F}}>
                            {r.canal}
                          </span>
                          <div style={{flex:1,height:22,borderRadius:6,
                            background:'rgba(18,81,96,.06)',overflow:'hidden',position:'relative'}}>
                            <div style={{position:'absolute',inset:'0 auto 0 0',
                              background:chanColors[i%chanColors.length],
                              width:`${(r.aprobadas/maxA)*100}%`,
                              borderRadius:6,opacity:.8,transition:'width .6s'}}/>
                            {(r.aprobadas/maxA)>0.14&&(
                              <span style={{position:'absolute',left:8,top:'50%',
                                transform:'translateY(-50%)',fontSize:11,
                                fontWeight:700,color:'white',fontFamily:F}}>
                                {n(r.aprobadas)}
                              </span>
                            )}
                          </div>
                          <span style={{fontSize:11,fontWeight:600,
                            width:36,textAlign:'right',flexShrink:0,
                            color:'rgba(18,81,96,.6)',fontFamily:F}}>
                            {r.pct_del_total}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Ciudades */}
            <div>
              <SH title="Distribución Geográfica" sub="Aprobaciones por ciudad"/>
              <div style={{borderRadius:14,overflow:'hidden',border:'1px solid rgba(18,81,96,.08)'}}>
                {!mapa ? <Sk h={160}/> : (
                  <table className="bi-table">
                    <thead>
                      <tr>
                        <th colSpan={5} style={{textAlign:'left'}}>Ciudad · Resultados</th>
                      </tr>
                      <tr>
                        <th>Ciudad</th>
                        <th style={{textAlign:'right',color:'rgba(186,242,58,.8)'}}>Aprobadas</th>
                        <th style={{textAlign:'right',color:'rgba(255,179,130,.8)'}}>En proceso</th>
                        <th style={{textAlign:'right',color:'rgba(255,150,130,.8)'}}>Caídas</th>
                        <th style={{textAlign:'right'}}>Lead time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(mapa.ciudades||[])].sort((a:any,b:any)=>b.aprobadas-a.aprobadas).map((c:any)=>(
                        <tr key={c.ciudad}>
                          <td style={{fontWeight:600}}>{c.ciudad}</td>
                          <td style={{textAlign:'right',fontWeight:700,color:C.green}}>
                            {n(c.aprobadas)}
                          </td>
                          <td style={{textAlign:'right',color:'#C2410C'}}>
                            {n(c.pipeline_activo)}
                          </td>
                          <td style={{textAlign:'right',
                            color:(c.ventas_caidas||0)>0?C.red:'rgba(18,81,96,.3)'}}>
                            {n(c.ventas_caidas)}
                          </td>
                          <td style={{textAlign:'right',color:'rgba(18,81,96,.5)',fontSize:11}}>
                            {d(c.avg_lead_time)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* ╔══════════════════════════════════════════════════╗
              ║  6. TABLA DETALLE                               ║
              ╚══════════════════════════════════════════════════╝ */}
          <section>
            <div style={{display:'flex',alignItems:'center',
              justifyContent:'space-between',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="sec-bar"/>
                <div>
                  <h2 style={{fontSize:16,fontWeight:700,color:C.primary,
                    margin:0,fontFamily:F,letterSpacing:'-.01em'}}>
                    Trazabilidad Individual
                  </h2>
                  <p style={{fontSize:11,color:'rgba(18,81,96,.5)',marginTop:2,fontFamily:F}}>
                    Acceso directo a cada legalización en HubSpot
                  </p>
                </div>
              </div>
              {det&&(
                <span style={{fontSize:11,color:'rgba(18,81,96,.4)',fontFamily:F}}>
                  {n(det.total)} registros
                </span>
              )}
            </div>

            <div style={{borderRadius:14,overflow:'hidden',border:'1px solid rgba(18,81,96,.08)'}}>
              <div style={{overflowX:'auto',maxHeight:380,overflowY:'auto',background:C.beigeDk}}>
                {!det ? <div style={{padding:16}}><Sk h={200}/></div> : (
                  <table className="bi-table" style={{minWidth:1000}}>
                    <thead>
                      <tr>
                        <th colSpan={3} style={{textAlign:'left'}}>Legalización</th>
                        <th colSpan={2} style={{textAlign:'center'}}>Estado</th>
                        <th colSpan={2} style={{textAlign:'center',
                          color:'rgba(255,255,255,.4)'}}>Valor · Tiempo</th>
                        <th style={{textAlign:'center'}}>Acceso</th>
                      </tr>
                      <tr>
                        <th>Nombre / ID</th>
                        <th>Proyecto</th>
                        <th>Director</th>
                        <th>Etapa</th>
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
                            {Array(8).fill(0).map((_,j)=>(
                              <td key={j}><div className="shimmer" style={{height:11,borderRadius:4}}/></td>
                            ))}
                          </tr>
                        ))
                        : (det.rows||[]).map((r:any)=>{
                          const sc=({
                            aprobado_exitoso:   {bg:'rgba(22,101,52,.1)', c:C.green},
                            aprobado_novedades: {bg:'rgba(146,64,14,.1)', c:C.amber},
                            negocio_rechazado:  {bg:'rgba(255,121,90,.1)',c:C.coral},
                            venta_caida:        {bg:'rgba(153,27,27,.1)', c:C.red},
                          } as any)[r.etapa_codigo] || {bg:'rgba(18,81,96,.07)',c:C.primary}

                          const ltCol=r.dias_lead_time==null?undefined:
                            r.dias_lead_time>30?C.coral:
                            r.dias_lead_time>15?C.amber:C.green

                          return (
                            <tr key={r.hs_object_id}>
                              <td>
                                <p style={{fontWeight:600,fontSize:12,margin:0,
                                  overflow:'hidden',textOverflow:'ellipsis',
                                  whiteSpace:'nowrap',maxWidth:180}}>
                                  {r.nombre_legalizacion||`#${r.hs_object_id}`}
                                </p>
                                <p style={{fontSize:9,color:'rgba(18,81,96,.35)',
                                  margin:0,fontFamily:F}}>
                                  ID {r.hs_object_id}
                                </p>
                              </td>
                              <td style={{fontSize:11,maxWidth:130,overflow:'hidden',
                                textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                {r.proyecto||'—'}
                              </td>
                              <td style={{fontSize:11,color:'rgba(18,81,96,.55)'}}>
                                {r.director||'—'}
                              </td>
                              <td>
                                <span style={{...sc,padding:'2px 8px',borderRadius:99,
                                  fontSize:10,fontWeight:600,
                                  whiteSpace:'nowrap',display:'inline-block'}}>
                                  {STAGES[r.etapa_codigo]||r.etapa_codigo}
                                </span>
                              </td>
                              <td style={{fontSize:11,color:'rgba(18,81,96,.55)'}}>
                                {r.canal_atribucion||'—'}
                              </td>
                              <td style={{textAlign:'right',fontSize:11,fontWeight:600}}>
                                {m(r.valor_del_inmueble)}
                              </td>
                              <td style={{textAlign:'right',fontSize:12,fontWeight:700,color:ltCol}}>
                                {d(r.dias_lead_time)}
                              </td>
                              <td style={{textAlign:'center'}}>
                                <a href={r.hubspot_url} target="_blank" rel="noopener noreferrer"
                                  title="Ver en HubSpot"
                                  style={{display:'inline-flex',alignItems:'center',
                                    justifyContent:'center',width:28,height:28,
                                    borderRadius:7,background:C.primary,
                                    textDecoration:'none'}}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                                      stroke="#A1D81A" strokeWidth="2.5" strokeLinecap="round"/>
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
                <div style={{display:'flex',alignItems:'center',
                  justifyContent:'space-between',padding:'10px 14px',
                  borderTop:'1px solid rgba(18,81,96,.07)',background:'white'}}>
                  <button onClick={()=>fetchDet(pagina-1)} disabled={pagina<=1}
                    style={{fontSize:11,fontWeight:500,padding:'5px 12px',borderRadius:7,
                      border:'1px solid rgba(18,81,96,.14)',cursor:'pointer',
                      background:'transparent',color:C.primary,fontFamily:F,
                      opacity:pagina<=1?.35:1}}>
                    ← Anterior
                  </button>
                  <span style={{fontSize:11,color:'rgba(18,81,96,.4)',fontFamily:F}}>
                    Pág. {pagina} · {n(det.total)} registros
                  </span>
                  <button onClick={()=>fetchDet(pagina+1)}
                    disabled={pagina>=Math.ceil(det.total/50)}
                    style={{fontSize:11,fontWeight:500,padding:'5px 12px',borderRadius:7,
                      border:'1px solid rgba(18,81,96,.14)',cursor:'pointer',
                      background:'transparent',color:C.primary,fontFamily:F,
                      opacity:pagina>=Math.ceil(det.total/50)?.35:1}}>
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
          </section>

        </main>
      </div>

      {/* Meta modal */}
      {showMeta&&kpis&&(
        <MetaModal anio={anio} mes={mes} actual={kpis.meta_negocios}
          onClose={()=>setMeta(false)}
          onSaved={x=>{
            setK((prev:any)=>prev?{...prev,meta_negocios:x,
              pct_cumplimiento:x>0
                ?parseFloat(((prev.aprobadas_exitoso+prev.aprobadas_novedades)/x*100).toFixed(1))
                :0}:prev)
            setMeta(false)
          }}/>
      )}
    </div>
  )
}
