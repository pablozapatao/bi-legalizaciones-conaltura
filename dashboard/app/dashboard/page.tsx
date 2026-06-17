'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import toast from 'react-hot-toast'

// ══════════════════════════════════════════════════════════════════════════
// TOKENS
// ══════════════════════════════════════════════════════════════════════════
const P = {
  teal:    '#125160',
  dark:    '#0a3340',
  beige:   '#F4F0E5',
  beigeDk: '#EDE9DC',
  accent:  '#A1D81A',
  accentL: '#DBFF69',
  coral:   '#FF795A',
  green:   '#166534',
  amber:   '#92400E',
  red:     '#991B1B',
  white:   '#ffffff',
  stage:   ['#125160','#1a6b7a','#1a7d6e','#279752'],
}
const FD = `-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif`
const FB = `var(--font-inter,'Inter',-apple-system,sans-serif)`

// ══════════════════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════════════════
const MES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MES_F = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const fmt  = (n: any) => n == null ? '—' : Number(n).toLocaleString('es-CO')
const fmtM = (n: any) => n == null || !Number(n) ? '—' : `$${(Number(n)/1e6).toLocaleString('es-CO',{maximumFractionDigits:1})}M`
const fmtD = (n: any) => n == null ? '—' : `${Number(n).toFixed(1)}d`
const pctC = (p: number) => p >= 90 ? P.green : p >= 60 ? P.amber : P.coral
const pctB = (p: number) => p >= 90 ? 'rgba(22,101,52,.12)' : p >= 60 ? 'rgba(146,64,14,.12)' : 'rgba(255,121,90,.12)'
const nowCOL = () => { const d = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Bogota'})); return {y:d.getFullYear(),m:d.getMonth()+1} }

const STAGE_L: Record<string,string> = {
  consignacion:'Consignación', legal_espera:'En Espera Dir.',
  legal_aprobada_dir:'Aprobada Dir.', revision_sinco:'Rev. SINCO',
  aprobado_exitoso:'Aprobado ✓', aprobado_novedades:'Con Novedades',
  negocio_rechazado:'Rechazado', venta_caida:'Venta Caída',
}
const STAGE_C: Record<string,{bg:string;c:string}> = {
  aprobado_exitoso:   {bg:'rgba(22,101,52,.12)',  c:P.green},
  aprobado_novedades: {bg:'rgba(146,64,14,.12)',  c:P.amber},
  negocio_rechazado:  {bg:'rgba(255,121,90,.15)', c:P.coral},
  venta_caida:        {bg:'rgba(153,27,27,.12)',  c:P.red},
  consignacion:       {bg:'rgba(18,81,96,.09)',   c:P.teal},
  legal_espera:       {bg:'rgba(26,107,122,.1)',  c:'#1a6b7a'},
  legal_aprobada_dir: {bg:'rgba(26,125,110,.1)',  c:'#1a7d6e'},
  revision_sinco:     {bg:'rgba(39,151,82,.1)',   c:'#279752'},
}

const TT_STYLE = {
  contentStyle:{background:'white',border:'1px solid rgba(18,81,96,.12)',borderRadius:10,fontSize:11,fontFamily:FB,boxShadow:'0 4px 16px rgba(18,81,96,.1)'},
  labelStyle:{color:P.teal,fontWeight:700,marginBottom:4},
}

// ══════════════════════════════════════════════════════════════════════════
// GAUGE
// ══════════════════════════════════════════════════════════════════════════
function Gauge({pct,meta,onEdit}:{pct:number;meta:number;onEdit:()=>void}) {
  const [v,setV] = useState(0)
  const raf = useRef<number>()
  useEffect(()=>{
    const target=Math.min(pct,150),t0=performance.now(),dur=1300
    const go=(now:number)=>{const p=Math.min((now-t0)/dur,1);setV(Math.round((1-Math.pow(1-p,3))*target));if(p<1)raf.current=requestAnimationFrame(go)}
    raf.current=requestAnimationFrame(go)
    return ()=>{if(raf.current)cancelAnimationFrame(raf.current)}
  },[pct])
  const R=66,cx=84,cy=80,start=-210,sw=240
  const arc=(sd:number,s:number)=>{const r=(d:number)=>d*Math.PI/180;const[a,b]=[r(sd),r(sd+s)];return `M${cx+R*Math.cos(a)} ${cy+R*Math.sin(a)} A${R} ${R} 0 ${s>180?1:0} 1 ${cx+R*Math.cos(b)} ${cy+R*Math.sin(b)}`}
  const fill=Math.min(v,100)/100*sw
  const col=v>=90?P.green:v>=60?P.amber:P.coral
  const lbl=v>=90?'En meta ✓':v>=60?'En riesgo':'Crítico'
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
      <svg width="168" height="104" viewBox="0 0 168 104" style={{overflow:'visible'}}>
        <path d={arc(start,sw)} fill="none" stroke="rgba(18,81,96,.1)" strokeWidth="11" strokeLinecap="round"/>
        {fill>0&&<path d={arc(start,fill)} fill="none" stroke={col} strokeWidth="11" strokeLinecap="round"/>}
        <text x={cx} y={cy+2} textAnchor="middle" fontSize="30" fontWeight="800" fontFamily={FD} fill={col}>{v}%</text>
        <text x={cx} y={cy+19} textAnchor="middle" fontSize="10" fontWeight="600" fontFamily={FB} fill={col} opacity=".85">{lbl}</text>
        {meta>0&&<text x={cx} y={cy+34} textAnchor="middle" fontSize="9.5" fontFamily={FB} fill="rgba(18,81,96,.45)">meta: {fmt(meta)}</text>}
      </svg>
      <button onClick={onEdit} style={{fontSize:10,fontWeight:600,padding:'4px 14px',borderRadius:99,border:'none',cursor:'pointer',fontFamily:FB,background:meta>0?'rgba(18,81,96,.08)':P.accentL,color:P.teal,transition:'all .15s'}}>
        {meta>0?'Editar meta':'+ Fijar meta'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// META MODAL
// ══════════════════════════════════════════════════════════════════════════
function MetaModal({anio,mes,actual,onClose,onSaved}:{anio:number;mes:number;actual:number;onClose:()=>void;onSaved:(n:number)=>void}) {
  const [v,setV]=useState(actual>0?String(actual):'')
  const [s,setS]=useState(false)
  async function save(){const n=parseInt(v,10);if(isNaN(n)||n<0)return;setS(true);try{await fetch('/api/metas/upsert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({anio,mes,meta_negocios:n})});onSaved(n);onClose();toast.success(`Meta ${MES[mes]} ${anio} → ${fmt(n)}`)}finally{setS(false)}}
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:'rgba(10,51,64,.5)',backdropFilter:'blur(6px)'}}>
      <div style={{background:'white',borderRadius:18,padding:28,width:'100%',maxWidth:360,boxShadow:'0 24px 60px rgba(0,0,0,.18)',border:'1px solid rgba(18,81,96,.1)'}}>
        <h3 style={{fontFamily:FD,fontSize:17,fontWeight:700,color:P.teal,marginBottom:4}}>Meta de legalizaciones</h3>
        <p style={{fontSize:11,opacity:.5,marginBottom:18,fontFamily:FB}}>{MES_F[mes]} {anio} · aprobaciones objetivo</p>
        <label style={{display:'block',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',opacity:.5,marginBottom:7,fontFamily:FB}}>Número objetivo</label>
        <input type="number" min="0" value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} autoFocus placeholder="ej. 150" style={{width:'100%',padding:'11px 14px',borderRadius:9,border:'1.5px solid rgba(18,81,96,.18)',fontSize:20,fontWeight:700,color:P.teal,fontFamily:FD,marginBottom:14,outline:'none',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:'10px 0',borderRadius:9,border:'1px solid rgba(18,81,96,.14)',cursor:'pointer',background:'rgba(18,81,96,.05)',color:'rgba(18,81,96,.6)',fontWeight:600,fontFamily:FB,fontSize:12}}>Cancelar</button>
          <button onClick={save} disabled={s||!v} style={{flex:1,padding:'10px 0',borderRadius:9,border:'none',cursor:'pointer',background:P.accentL,color:P.teal,fontWeight:700,fontFamily:FB,fontSize:12,opacity:(s||!v)?.5:1}}>
            {s?'Guardando…':'Guardar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const hoy = nowCOL()
  const [anio,setAnio]=useState(hoy.y)
  const [mes, setMes] =useState(hoy.m)
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
  const [loadDet,setLd]=useState(false)
  const [loading,setLoading]=useState(true)

  const qs = useCallback(()=>{
    const p=new URLSearchParams({anio:String(anio),mes:String(mes)})
    if(ciudad)   p.set('ciudad',ciudad)
    if(director) p.set('director',director)
    return p.toString()
  },[anio,mes,ciudad,director])

  const fetchAll = useCallback(async()=>{
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

  const fetchDet = useCallback(async(pg=1)=>{
    setLd(true)
    try{setDe(await fetch(`/api/detalle?${qs()}&pagina=${pg}&por_pagina=50`).then(r=>r.json()));setPagina(pg)}
    finally{setLd(false)}
  },[qs])

  useEffect(()=>{fetchAll()},[fetchAll])
  useEffect(()=>{fetchDet(1)},[fetchDet])

  // Período opciones
  const periodos:any[]=[]
  let pa=hoy.y,pm=hoy.m
  for(let i=0;i<18;i++){periodos.push({y:pa,m:pm,l:`${MES[pm]} ${pa}`});pm--;if(pm<1){pm=12;pa--}}

  // Tabla proyectos — sort + search
  const proyRows = (() => {
    if(!proy?.proyectos) return []
    let rows = [...proy.proyectos]
    if(search) rows = rows.filter((r:any) => r.proyecto?.toLowerCase().includes(search.toLowerCase()) || r.director?.toLowerCase().includes(search.toLowerCase()))
    rows.sort((a:any,b:any) => {
      const av=a[sortK],bv=b[sortK]
      const c = typeof av==='string' ? av.localeCompare(bv) : (Number(av)||0)-(Number(bv)||0)
      return sortD==='asc'?c:-c
    })
    return rows
  })()

  function srt(k:string){if(sortK===k)setSortD(d=>d==='asc'?'desc':'asc');else{setSortK(k);setSortD('desc')}}
  function thS(k:string){return `${sortK===k?'sorted':''}`}
  function arrow(k:string){return sortK===k?(sortD==='asc'?' ↑':' ↓'):''}

  const DIRECTORES = ['Alba Luz Consuegra','Carolina Cárdenas','Ingrid Marcela Matta','Leonardo Villegas','Natalia Giraldo','Patricia Herrera']
  const CIUDADES   = ['Medellín','Bogotá','Barranquilla','Cartagena','Cali']

  const canalColors = ['#125160','#1a6b7a','#1a7d6e','#279752','#4d7c0f','#166534']

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',fontFamily:FB,color:P.teal,background:P.beige}}>

      {/* ══ SIDEBAR ════════════════════════════════════════════════════════ */}
      <aside style={{width:224,flexShrink:0,display:'flex',flexDirection:'column',overflowY:'auto',background:P.teal,borderRight:'1px solid rgba(255,255,255,.08)',zIndex:20}}>

        {/* Brand */}
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
          <div style={{display:'flex',alignItems:'center',gap:11}}>
            <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#0a3340,#A1D81A)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 3px 12px rgba(161,216,26,.25)'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#A1D81A" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </div>
            <div>
              <p style={{fontFamily:FD,fontSize:13,fontWeight:700,color:P.beige,margin:0,lineHeight:1.1}}>conaltura <span style={{color:P.accent}}>·</span> BI</p>
              <p style={{fontSize:9,color:'rgba(244,240,229,.45)',letterSpacing:'.1em',textTransform:'uppercase',marginTop:2}}>Legalizaciones v1.0</p>
            </div>
          </div>
        </div>

        {/* Período */}
        <div style={{padding:'14px 14px 12px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(244,240,229,.5)',marginBottom:8}}>Período</p>
          <select value={`${anio}-${mes}`} onChange={e=>{const[a,m]=e.target.value.split('-').map(Number);setAnio(a);setMes(m)}}
            className="inp" style={{background:'rgba(255,255,255,.09)',color:P.beige,fontFamily:FD,fontWeight:600,fontSize:12}}>
            {periodos.map(o=><option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`} style={{background:'#0a3340'}}>{o.l}</option>)}
          </select>
        </div>

        {/* Filtros */}
        <div style={{padding:'14px',flex:1,display:'flex',flexDirection:'column',gap:14,overflowY:'auto'}}>
          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(244,240,229,.5)'}}>Filtros</p>

          {/* Ciudad */}
          <div>
            <p style={{fontSize:10,color:'rgba(244,240,229,.6)',marginBottom:6,fontWeight:500}}>Ciudad</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {CIUDADES.map(c=>{const active=ciudad===c;return(
                <button key={c} onClick={()=>setCiudad(active?'':c)} style={{padding:'5px 9px',borderRadius:7,fontSize:10,cursor:'pointer',border:'none',fontFamily:FB,background:active?P.accentL:'rgba(255,255,255,.1)',color:active?P.teal:'rgba(244,240,229,.75)',fontWeight:active?700:400,transition:'all .15s'}}>
                  {active&&'✓ '}{c}
                </button>
              )})}
            </div>
          </div>

          {/* Director */}
          <div>
            <p style={{fontSize:10,color:'rgba(244,240,229,.6)',marginBottom:6,fontWeight:500}}>Director</p>
            <select value={director} onChange={e=>setDir(e.target.value)}
              className="inp" style={{background:'rgba(255,255,255,.09)',color:P.beige,fontSize:11}}>
              <option value="" style={{background:'#0a3340'}}>Todos</option>
              {DIRECTORES.map(d=><option key={d} value={d} style={{background:'#0a3340'}}>{d.split(' ')[0]} {d.split(' ').slice(-1)[0]}</option>)}
            </select>
          </div>

          {(ciudad||director)&&(
            <button onClick={()=>{setCiudad('');setDir('')}} style={{padding:'7px 0',borderRadius:8,border:'none',cursor:'pointer',background:'rgba(255,121,90,.18)',color:P.coral,fontSize:11,fontWeight:600,fontFamily:FB}}>
              ✕ Limpiar filtros
            </button>
          )}

          {/* Refresh */}
          <button onClick={()=>{fetchAll();fetchDet(1)}} style={{padding:'8px 0',borderRadius:9,border:'1px solid rgba(255,255,255,.15)',cursor:'pointer',background:'rgba(255,255,255,.09)',color:'rgba(244,240,229,.8)',fontSize:11,fontWeight:600,fontFamily:FB}}>
            {loading?'⏳ Cargando…':'🔄 Actualizar'}
          </button>
        </div>

        {/* Footer */}
        <div style={{padding:'10px 14px',borderTop:'1px solid rgba(255,255,255,.06)'}}>
          {kpis?.ultima_actualizacion&&<p style={{color:'rgba(244,240,229,.3)',fontSize:10,marginBottom:4,fontFamily:FB}}>ETL: {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>}
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div className="live-dot"/>
            <span style={{color:'rgba(244,240,229,.35)',fontSize:10,fontFamily:FB}}>Live · cada 2h</span>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ════════════════════════════════════════════════════════════ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Topbar */}
        <header style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 22px',borderBottom:'1px solid rgba(18,81,96,.1)',background:P.teal,backdropFilter:'blur(14px)'}}>
          <div>
            <h1 style={{fontFamily:FD,fontSize:14,fontWeight:700,color:P.beige,margin:0,lineHeight:1}}>
              Dashboard <span style={{color:P.accent}}>Legalizaciones</span>
            </h1>
            <p style={{fontSize:10,color:'rgba(244,240,229,.6)',marginTop:2,fontFamily:FB}}>
              {MES_F[mes]} {anio}{ciudad?` · ${ciudad}`:''}{director?` · ${director.split(' ')[0]}`:''} 
            </p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {/* Selector rápido */}
            <select value={`${anio}-${mes}`} onChange={e=>{const[a,m]=e.target.value.split('-').map(Number);setAnio(a);setMes(m)}}
              style={{fontSize:12,fontWeight:600,padding:'6px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.12)',color:P.beige,outline:'none',cursor:'pointer',fontFamily:FD}}>
              {periodos.map(o=><option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`} style={{background:'#0a3340'}}>{o.l}</option>)}
            </select>
            {loading&&<div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:8,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.15)'}}>
              <div style={{width:8,height:8,borderRadius:'50%',border:'2px solid rgba(161,216,26,.3)',borderTopColor:P.accent,animation:'spin 1s linear infinite'}}/>
              <span style={{fontSize:11,color:'rgba(244,240,229,.8)',fontFamily:FB}}>Cargando</span>
            </div>}
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:8,background:'rgba(161,216,26,.1)',border:'1px solid rgba(161,216,26,.22)'}}>
              <div className="live-dot"/>
              <span style={{fontSize:11,fontWeight:700,color:P.accent,fontFamily:FB}}>LIVE</span>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main style={{flex:1,overflowY:'auto',padding:'20px 22px',display:'flex',flexDirection:'column',gap:22}}>

          {/* ╔══════════════════════════════════════════════════════╗
              ║ 1. KPI CARDS                                        ║
              ╚══════════════════════════════════════════════════════╝ */}
          <section>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <div className="sec-bar"/>
              <div>
                <h2 style={{fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',fontSize:14,fontWeight:700,color:P.teal,margin:0,letterSpacing:'-.01em'}}>Resolución del mes</h2>
                <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:2}}>Legalizaciones con fecha de aprobación en {MES_F[mes]} {anio}</p>
              </div>
            </div>

            {!kpis
              ? <div className="shimmer" style={{height:230,borderRadius:14}}/>
              : (()=>{
                  const apr = kpis.aprobadas_exitoso + kpis.aprobadas_novedades
                  const cards = [
                    {l:'Total del mes',       v:kpis.total_resolucion,    col:P.teal,  sub:`${apr} aprobadas · ${kpis.rechazadas} rechazadas`},
                    {l:'Aprobadas sin novedad',v:kpis.aprobadas_exitoso,  col:P.green, sub:apr>0?`${((kpis.aprobadas_exitoso/apr)*100).toFixed(0)}% de las aprobadas`:undefined},
                    {l:'Aprobadas con novedad',v:kpis.aprobadas_novedades,col:P.amber, sub:apr>0?`${((kpis.aprobadas_novedades/apr)*100).toFixed(0)}% de las aprobadas`:undefined},
                    {l:'Rechazadas',           v:kpis.rechazadas,          col:kpis.rechazadas>0?P.coral:P.teal, sub:undefined},
                    {l:'Ventas caídas',         v:kpis.ventas_caidas,       col:kpis.ventas_caidas>0?P.red:P.teal, sub:undefined},
                    {l:'En ventana de cierre',  v:`${kpis.pct_ventana_cierre}%`, col:kpis.pct_ventana_cierre>40?P.amber:P.teal, sub:`${kpis.en_ventana_cierre} aprobadas en últimos días del mes`},
                  ]
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'210px 1fr',gap:14}}>

                      {/* ── GAUGE ─────────────────────────────────── */}
                      <div className="card" style={{padding:'20px 16px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:0}}>
                        <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.09em',color:'rgba(18,81,96,.4)',textAlign:'center',marginBottom:8}}>
                          Cumplimiento vs meta
                        </p>
                        <Gauge pct={kpis.pct_cumplimiento} meta={kpis.meta_negocios} onEdit={()=>setMeta(true)}/>
                      </div>

                      {/* ── 6 KPI CARDS ───────────────────────────── */}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                        {cards.map(k=>(
                          <div key={k.l} style={{
                            background:'white',
                            borderRadius:14,
                            border:'1px solid rgba(18,81,96,.08)',
                            boxShadow:'0 1px 3px rgba(18,81,96,.06)',
                            padding:'16px 18px',
                            position:'relative',
                            overflow:'hidden',
                            transition:'box-shadow .2s, transform .2s',
                          }}>
                            {/* Accent line top */}
                            <div style={{position:'absolute',top:0,left:0,right:0,height:3,borderRadius:'14px 14px 0 0',background:`linear-gradient(90deg,${k.col},transparent)`}}/>
                            {/* Label */}
                            <p style={{
                              fontSize:10,
                              fontWeight:600,
                              textTransform:'uppercase',
                              letterSpacing:'.07em',
                              color:'rgba(18,81,96,.45)',
                              marginBottom:10,
                              marginTop:4,
                              lineHeight:1.35,
                              fontFamily:'Inter,var(--font-inter),-apple-system,sans-serif',
                            }}>{k.l}</p>
                            {/* Number — Syne 800 forzado */}
                            <p style={{
                              fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
                              fontSize:38,
                              fontWeight:800,
                              color:k.col,
                              margin:0,
                              lineHeight:1,
                              letterSpacing:'-.03em',
                              fontVariantNumeric:'tabular-nums',
                            }}>
                              {typeof k.v==='number' ? fmt(k.v) : k.v}
                            </p>
                            {/* Subtext */}
                            {k.sub && (
                              <p style={{
                                fontSize:10,
                                marginTop:8,
                                color:'rgba(18,81,96,.5)',
                                lineHeight:1.45,
                                fontFamily:'Inter,var(--font-inter),-apple-system,sans-serif',
                              }}>{k.sub}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()
            }
          </section>

          {/* ╔══════════════════════════════════════════════════════╗
              ║ 2. TABLA PROYECTOS — principal                      ║
              ╚══════════════════════════════════════════════════════╝ */}
          <section>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div className="sec-bar"/>
              <div style={{flex:1}}>
                <h2 style={{fontFamily:FD,fontSize:13,fontWeight:700,color:P.teal,margin:0}}>Resultados por proyecto</h2>
                <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:2,fontFamily:FB}}>Unidades y valor · ordenar por columna · lead time promedio</p>
              </div>
              <span style={{padding:'3px 10px',borderRadius:7,fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',background:'rgba(18,81,96,.1)',color:P.teal}}>
                {proy?.proyectos?.length||0} proyectos
              </span>
            </div>
            <div style={{marginBottom:8}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar proyecto o director…" className="inp" style={{maxWidth:280,fontSize:11,background:'rgba(18,81,96,.05)',color:P.teal,border:'1px solid rgba(18,81,96,.14)'}}/>
            </div>
            <div style={{borderRadius:14,overflow:'hidden',border:'1px solid rgba(18,81,96,.08)'}}>
              <div style={{overflowX:'auto',maxHeight:420,overflowY:'auto',background:P.beigeDk}}>
                {!proy?<div style={{padding:16}}><div className="shimmer" style={{height:200}}/></div>:(
                  <table className="bi-table" style={{minWidth:1100}}>
                    <thead>
                      <tr>
                        <th colSpan={3} style={{textAlign:'left'}}>IDENTIFICACIÓN</th>
                        <th colSpan={3} style={{textAlign:'center',color:'rgba(134,239,172,.8)'}}>APROBADAS</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(254,215,170,.8)'}}>PROCESO</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(252,165,165,.8)'}}>ALERTAS</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(255,255,255,.4)'}}>VALOR · TIEMPO</th>
                      </tr>
                      <tr>
                        <th className={thS('proyecto')} onClick={()=>srt('proyecto')}>Proyecto{arrow('proyecto')}</th>
                        <th className={thS('director')} onClick={()=>srt('director')}>Director{arrow('director')}</th>
                        <th className={thS('ciudad')} onClick={()=>srt('ciudad')}>Ciudad{arrow('ciudad')}</th>
                        <th className={thS('aprobadas')} onClick={()=>srt('aprobadas')} style={{textAlign:'right'}}>Total Aprobadas{arrow('aprobadas')}</th>
                        <th style={{textAlign:'right',color:'rgba(134,239,172,.8)'}}>Sin novedades</th>
                        <th style={{textAlign:'right',color:'rgba(254,215,170,.8)'}}>Con novedades</th>
                        <th className={thS('pipeline_activo')} onClick={()=>srt('pipeline_activo')} style={{textAlign:'right'}}>Pipeline{arrow('pipeline_activo')}</th>
                        <th style={{textAlign:'right',color:'rgba(255,255,255,.5)'}}>% del total</th>
                        <th className={thS('rechazadas')} onClick={()=>srt('rechazadas')} style={{textAlign:'right',color:'rgba(252,165,165,.8)'}}>Rechazadas{arrow('rechazadas')}</th>
                        <th className={thS('ventas_caidas')} onClick={()=>srt('ventas_caidas')} style={{textAlign:'right',color:'rgba(252,165,165,.8)'}}>Caídas{arrow('ventas_caidas')}</th>
                        <th className={thS('suma_valor_inmueble')} onClick={()=>srt('suma_valor_inmueble')} style={{textAlign:'right'}}>Valor total{arrow('suma_valor_inmueble')}</th>
                        <th className={thS('avg_lead_time')} onClick={()=>srt('avg_lead_time')} style={{textAlign:'right'}}>Lead time{arrow('avg_lead_time')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proyRows.map((r:any,i:number)=>{
                        const apr=(r.exitosas||0)+(r.con_novedades||0)
                        const pct=proy.total_aprobadas>0?(apr/proy.total_aprobadas*100).toFixed(1):'0.0'
                        return (
                          <tr key={r.proyecto||i}>
                            <td style={{fontWeight:700,color:P.dark,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.proyecto||'Sin asignar'}</td>
                            <td style={{fontSize:11,opacity:.65}}>{r.director||'—'}</td>
                            <td style={{fontSize:11,opacity:.65}}>{r.ciudad||'—'}</td>
                            <td style={{textAlign:'right'}}>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:7}}>
                                <div style={{width:32,height:3.5,borderRadius:99,background:'rgba(18,81,96,.1)',overflow:'hidden'}}>
                                  <div style={{width:`${Math.min(Number(pct),100)}%`,height:'100%',background:P.teal,borderRadius:99}}/>
                                </div>
                                <span style={{fontWeight:700,color:P.green,fontSize:12}}>{fmt(apr)}</span>
                              </div>
                            </td>
                            <td style={{textAlign:'right'}}><span style={{padding:'2px 8px',borderRadius:6,background:'rgba(22,101,52,.12)',color:P.green,fontWeight:700,fontSize:11}}>{fmt(r.exitosas)}</span></td>
                            <td style={{textAlign:'right'}}><span style={{padding:'2px 8px',borderRadius:6,background:'rgba(146,64,14,.12)',color:P.amber,fontWeight:700,fontSize:11}}>{fmt(r.con_novedades)}</span></td>
                            <td style={{textAlign:'right',color:'#C2410C',fontWeight:600,fontSize:11}}>{fmt(r.pipeline_activo)}</td>
                            <td style={{textAlign:'right',fontSize:11,opacity:.55}}>{pct}%</td>
                            <td style={{textAlign:'right'}}>{(r.rechazadas||0)>0?<span style={{padding:'2px 7px',borderRadius:6,background:'rgba(255,121,90,.15)',color:P.coral,fontWeight:700,fontSize:11}}>{fmt(r.rechazadas)}</span>:<span style={{opacity:.3}}>—</span>}</td>
                            <td style={{textAlign:'right'}}>{(r.ventas_caidas||0)>0?<span style={{padding:'2px 7px',borderRadius:6,background:'rgba(153,27,27,.12)',color:P.red,fontWeight:700,fontSize:11}}>{fmt(r.ventas_caidas)}</span>:<span style={{opacity:.3}}>—</span>}</td>
                            <td style={{textAlign:'right',fontWeight:600,fontSize:11}}>{fmtM(r.suma_valor_inmueble)}</td>
                            <td style={{textAlign:'right',opacity:.65,fontSize:11}}>{fmtD(r.avg_lead_time)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{fontFamily:FD,fontWeight:900,color:'rgba(244,240,229,.9)',fontSize:11}}>TOTAL — {proy.proyectos?.length||0} proyectos</td>
                        <td style={{textAlign:'right',color:'rgba(134,239,172,.9)',fontWeight:900,fontSize:12}}>{fmt(proy.total_aprobadas)}</td>
                        <td colSpan={8}/>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* ╔══════════════════════════════════════════════════════╗
              ║ 3. PIPELINE + TENDENCIA (2 col)                     ║
              ╚══════════════════════════════════════════════════════╝ */}
          <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

            {/* Pipeline */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div className="sec-bar" style={{height:18}}/>
                <div>
                  <h2 style={{fontFamily:FD,fontSize:13,fontWeight:700,color:P.teal,margin:0}}>Pipeline activo — {pipe?fmt(pipe.total_pipeline):'…'}</h2>
                  <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:2,fontFamily:FB}}>Legalizaciones en proceso sin fecha de aprobación</p>
                </div>
              </div>
              <div className="card" style={{padding:18}}>
                {!pipe?<div className="shimmer" style={{height:180}}/>:(()=>{
                  const tot = pipe.total_pipeline||1
                  return (
                    <>
                      {pipe.caidas_del_mes>0&&<div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:99,background:'rgba(153,27,27,.1)',marginBottom:14}}>
                        <span style={{fontWeight:700,fontSize:12,color:P.red}}>{pipe.caidas_del_mes}</span>
                        <span style={{fontSize:11,color:P.red}}>ventas caídas este mes</span>
                      </div>}
                      <p style={{fontSize:12,lineHeight:1.65,marginBottom:14,opacity:.7,fontFamily:FB}}>
                        <strong style={{color:P.teal,fontFamily:FD}}>{fmt(pipe.total_pipeline)}</strong> legalizaciones activas en {pipe.stages?.filter((s:any)=>s.count>0).length} etapas.
                      </p>
                      {/* Barras proporcionales */}
                      <div style={{display:'flex',gap:3,height:52,borderRadius:10,overflow:'hidden',marginBottom:14}}>
                        {(pipe.stages||[]).map((s:any,i:number)=>{
                          if(s.count===0)return null
                          return(
                            <div key={s.etapa_codigo} title={`${s.etapa_label}: ${s.count}`}
                              style={{flex:s.count,background:P.stage[i]||P.teal,minWidth:4,display:'flex',alignItems:'center',justifyContent:'center',transition:'flex .7s cubic-bezier(.4,0,.2,1)'}}>
                              {s.pct_del_total>9&&<span style={{color:'white',fontSize:13,fontFamily:FD,fontWeight:700}}>{s.count}</span>}
                            </div>
                          )
                        })}
                      </div>
                      {/* Leyenda */}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
                        {(pipe.stages||[]).map((s:any,i:number)=>(
                          <div key={s.etapa_codigo} style={{display:'flex',alignItems:'flex-start',gap:7}}>
                            <div style={{width:9,height:9,borderRadius:2,background:P.stage[i]||P.teal,marginTop:2,flexShrink:0}}/>
                            <div>
                              <p style={{fontSize:11,fontWeight:600,margin:0,lineHeight:1.3,fontFamily:FB}}>{s.etapa_label}</p>
                              <p style={{fontSize:10,opacity:.45,margin:0,marginTop:1,fontFamily:FB}}>{fmt(s.count)} · {s.pct_del_total}%{s.aging_promedio!=null?` · ${s.aging_promedio}d`:''}</p>
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
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div className="sec-bar" style={{height:18}}/>
                <div>
                  <h2 style={{fontFamily:FD,fontSize:13,fontWeight:700,color:P.teal,margin:0}}>Tendencia mensual</h2>
                  <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:2,fontFamily:FB}}>Últimos 14 meses · aprobadas · rechazadas · meta</p>
                </div>
              </div>
              <div className="card" style={{padding:18}}>
                {!tend?<div className="shimmer" style={{height:200}}/>:(
                  <>
                    <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:12}}>
                      {[{c:P.teal,l:'Aprobadas'},{c:P.coral,l:'Rechazadas'},{c:P.red,l:'Caídas'},{c:P.accent,l:'Meta',d:true}].map(({c,l,d})=>(
                        <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                          <div style={{width:18,height:d?0:2,borderTop:d?`2px dashed ${c}`:undefined,background:d?undefined:c,borderRadius:99}}/>
                          <span style={{fontSize:11,opacity:.6,fontFamily:FB}}>{l}</span>
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart data={tend.meses} margin={{top:4,right:6,left:-24,bottom:0}}>
                        <defs>
                          <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={P.teal} stopOpacity={.13}/>
                            <stop offset="95%" stopColor={P.teal} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,81,96,.06)"/>
                        <XAxis dataKey="label" tick={{fontSize:9,fill:'rgba(18,81,96,.5)',fontFamily:FB}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fill:'rgba(18,81,96,.4)',fontFamily:FB}} axisLine={false} tickLine={false}/>
                        <Tooltip {...TT_STYLE} formatter={(v:any,n:any)=>[fmt(v),n==='aprobadas'?'Aprobadas':n==='rechazadas'?'Rechazadas':n==='ventas_caidas'?'Caídas':'Meta']}/>
                        <Area type="monotone" dataKey="meta" stroke={P.accent} strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} connectNulls/>
                        <Area type="monotone" dataKey="aprobadas" stroke={P.teal} strokeWidth={2.5} fill="url(#gA)" dot={{fill:P.teal,r:2.5,strokeWidth:0}} activeDot={{r:4}}/>
                        <Area type="monotone" dataKey="rechazadas" stroke={P.coral} strokeWidth={1.5} fill="none" dot={{fill:P.coral,r:2,strokeWidth:0}}/>
                        <Area type="monotone" dataKey="ventas_caidas" stroke={P.red} strokeWidth={1.5} fill="none" dot={{fill:P.red,r:2,strokeWidth:0}}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ╔══════════════════════════════════════════════════════╗
              ║ 4. TIEMPOS (velocidad del proceso)                  ║
              ╚══════════════════════════════════════════════════════╝ */}
          <section>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div className="sec-bar"/>
              <div>
                <h2 style={{fontFamily:FD,fontSize:13,fontWeight:700,color:P.teal,margin:0}}>Velocidad del proceso</h2>
                <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:2,fontFamily:FB}}>Lead time y duración por etapa · semáforo por proyecto</p>
              </div>
            </div>
            <div className="card" style={{padding:20}}>
              {!times?<div className="shimmer" style={{height:180}}/>:(()=>{
                const g=times.global
                return (
                  <>
                    {g?.p50_lead_time!=null&&(
                      <div style={{display:'flex',gap:28,flexWrap:'wrap',marginBottom:20,padding:'16px 20px',borderRadius:10,background:P.beigeDk}}>
                        <div>
                          <p style={{fontSize:10,opacity:.45,marginBottom:4,fontFamily:FB}}>La mitad se aprueba en menos de</p>
                          <p style={{fontFamily:FD,fontSize:36,fontWeight:800,color:P.teal,margin:0,lineHeight:1}}>{g.p50_lead_time}<span style={{fontSize:16,fontWeight:400,opacity:.5,marginLeft:5,fontFamily:FB}}>días</span></p>
                        </div>
                        {[['Promedio',g.avg_lead_time],['9 de cada 10 en',g.p90_lead_time]].map(([l,v])=>(
                          <div key={l as string}>
                            <p style={{fontSize:10,opacity:.45,marginBottom:4,fontFamily:FB}}>{l}</p>
                            <p style={{fontFamily:FD,fontSize:20,fontWeight:700,color:P.teal,margin:0}}>{fmtD(v as number)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                      {(times.por_stage||[]).filter((s:any)=>s.n>0).map((s:any)=>{
                        const col=!s.p50_dias?'rgba(18,81,96,.3)':s.p50_dias<=15?P.green:s.p50_dias<=30?P.amber:P.coral
                        return (
                          <div key={s.stage}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                              <span style={{fontSize:12,fontWeight:600,fontFamily:FB}}>{s.label}</span>
                              <div style={{display:'flex',alignItems:'center',gap:8}}>
                                <span style={{fontSize:10,fontWeight:600,color:col,fontFamily:FB}}>{!s.p50_dias?'':s.p50_dias<=15?'● Rápido':s.p50_dias<=30?'● Normal':'● Lento'}</span>
                                <span style={{fontFamily:FD,fontSize:16,fontWeight:700,color:P.teal}}>{fmtD(s.avg_dias)}</span>
                              </div>
                            </div>
                            <div style={{height:8,borderRadius:99,background:'rgba(18,81,96,.08)',position:'relative',overflow:'hidden'}}>
                              <div style={{position:'absolute',inset:'0 auto 0 0',width:'25%',background:P.green,opacity:.18}}/>
                              <div style={{position:'absolute',left:'25%',top:0,bottom:0,width:'25%',background:P.amber,opacity:.18}}/>
                              {s.avg_dias!=null&&<div style={{position:'absolute',top:'50%',transform:'translate(-50%,-50%)',left:`${Math.min((s.avg_dias/60)*100,96)}%`,width:13,height:13,borderRadius:'50%',background:col,border:'2px solid white'}}/>}
                            </div>
                            <div style={{display:'flex',gap:10,marginTop:4}}>
                              <span style={{fontSize:9,opacity:.35,fontFamily:FB}}>Med. {fmtD(s.p50_dias)}</span>
                              <span style={{fontSize:9,opacity:.35,fontFamily:FB}}>P90: {fmtD(s.p90_dias)}</span>
                              <span style={{fontSize:9,opacity:.35,fontFamily:FB}}>n={fmt(s.n)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Ranking proyectos velocidad */}
                    {(times.por_proyecto||[]).length>0&&(
                      <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid rgba(18,81,96,.07)'}}>
                        <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',opacity:.38,marginBottom:12,fontFamily:FB}}>Ranking velocidad por proyecto</p>
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                          {times.por_proyecto.slice(0,8).map((p:any)=>{
                            const maxLt=times.por_proyecto[0]?.avg_lead_time||1
                            const col=p.semaforo==='verde'?P.green:p.semaforo==='amarillo'?P.amber:p.semaforo==='rojo'?P.coral:'rgba(18,81,96,.3)'
                            return (
                              <div key={p.proyecto}>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                                    <div style={{width:7,height:7,borderRadius:'50%',background:col,flexShrink:0}}/>
                                    <span style={{fontSize:11,fontWeight:600,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:FB}}>{p.proyecto}</span>
                                    <span style={{fontSize:10,opacity:.38,fontFamily:FB}}>({fmt(p.n)})</span>
                                  </div>
                                  <span style={{fontSize:12,fontWeight:700,fontFamily:FD}}>{fmtD(p.avg_lead_time)}</span>
                                </div>
                                <div style={{height:4,borderRadius:99,background:'rgba(18,81,96,.07)'}}>
                                  <div style={{height:'100%',borderRadius:99,background:col,opacity:.7,width:`${((p.avg_lead_time||0)/maxLt)*100}%`,transition:'width .6s'}}/>
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

          {/* ╔══════════════════════════════════════════════════════╗
              ║ 5. CANALES + CIUDADES (2 col)                       ║
              ╚══════════════════════════════════════════════════════╝ */}
          <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

            {/* Canales */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div className="sec-bar" style={{height:18}}/>
                <h2 style={{fontFamily:FD,fontSize:13,fontWeight:700,color:P.teal,margin:0}}>Canales de atribución</h2>
              </div>
              <div className="card" style={{padding:18}}>
                {!cana?<div className="shimmer" style={{height:160}}/>:(()=>{
                  const rows=(cana.por_atribucion||[]).filter((r:any)=>r.canal&&r.canal!=='')
                  if(!rows.length) return <p style={{opacity:.4,fontSize:12,fontFamily:FB}}>Sin datos de canal</p>
                  const maxA=Math.max(...rows.map((r:any)=>r.aprobadas),1)
                  return (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {rows.map((r:any,i:number)=>(
                        <div key={r.canal} style={{display:'flex',alignItems:'center',gap:10}}>
                          <span style={{fontSize:11,fontWeight:600,width:160,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:FB}}>{r.canal}</span>
                          <div style={{flex:1,height:24,borderRadius:6,background:'rgba(18,81,96,.06)',overflow:'hidden',position:'relative'}}>
                            <div style={{position:'absolute',inset:'0 auto 0 0',background:canalColors[i%canalColors.length],width:`${(r.aprobadas/maxA)*100}%`,borderRadius:6,opacity:.82,transition:'width .6s'}}/>
                            {(r.aprobadas/maxA)>0.15&&<span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:11,fontWeight:700,color:'white',fontFamily:FD}}>{fmt(r.aprobadas)}</span>}
                          </div>
                          <span style={{fontSize:10,fontWeight:600,width:36,textAlign:'right',flexShrink:0,fontFamily:FB}}>{r.pct_del_total}%</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Ciudades */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div className="sec-bar" style={{height:18}}/>
                <h2 style={{fontFamily:FD,fontSize:13,fontWeight:700,color:P.teal,margin:0}}>Por ciudad</h2>
              </div>
              <div style={{borderRadius:14,overflow:'hidden',border:'1px solid rgba(18,81,96,.08)'}}>
                {!mapa?<div className="shimmer" style={{height:160}}/>:(
                  <table className="bi-table">
                    <thead>
                      <tr><th colSpan={5} style={{textAlign:'left'}}>DISTRIBUCIÓN GEOGRÁFICA</th></tr>
                      <tr>
                        <th>Ciudad</th>
                        <th style={{textAlign:'right',color:'rgba(134,239,172,.8)'}}>Aprobadas</th>
                        <th style={{textAlign:'right',color:'rgba(254,215,170,.8)'}}>En proceso</th>
                        <th style={{textAlign:'right',color:'rgba(252,165,165,.8)'}}>Caídas</th>
                        <th style={{textAlign:'right'}}>Lead time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(mapa.ciudades||[])].sort((a:any,b:any)=>b.aprobadas-a.aprobadas).map((c:any)=>(
                        <tr key={c.ciudad}>
                          <td style={{fontWeight:700}}>{c.ciudad}</td>
                          <td style={{textAlign:'right',fontWeight:700,color:P.green}}>{fmt(c.aprobadas)}</td>
                          <td style={{textAlign:'right',color:'#C2410C'}}>{fmt(c.pipeline_activo)}</td>
                          <td style={{textAlign:'right',color:(c.ventas_caidas||0)>0?P.red:undefined}}>{fmt(c.ventas_caidas)}</td>
                          <td style={{textAlign:'right',opacity:.6,fontSize:11}}>{fmtD(c.avg_lead_time)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* ╔══════════════════════════════════════════════════════╗
              ║ 6. TABLA DETALLE — trazabilidad a HubSpot           ║
              ╚══════════════════════════════════════════════════════╝ */}
          <section>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div className="sec-bar"/>
              <div style={{flex:1}}>
                <h2 style={{fontFamily:FD,fontSize:13,fontWeight:700,color:P.teal,margin:0}}>Legalizaciones individuales</h2>
                <p style={{fontSize:10,color:'rgba(18,81,96,.5)',marginTop:2,fontFamily:FB}}>Trazabilidad directa a HubSpot · lead time por registro · paginado</p>
              </div>
              {det&&<span style={{fontSize:11,opacity:.45,fontFamily:FB}}>{fmt(det.total)} registros</span>}
            </div>
            <div style={{borderRadius:14,overflow:'hidden',border:'1px solid rgba(18,81,96,.08)'}}>
              <div style={{overflowX:'auto',maxHeight:400,overflowY:'auto',background:P.beigeDk}}>
                {!det?<div style={{padding:16}}><div className="shimmer" style={{height:200}}/></div>:(
                  <table className="bi-table" style={{minWidth:1080}}>
                    <thead>
                      <tr>
                        <th colSpan={3} style={{textAlign:'left'}}>LEGALIZACIÓN</th>
                        <th colSpan={2} style={{textAlign:'center'}}>ESTADO</th>
                        <th colSpan={2} style={{textAlign:'center',color:'rgba(255,255,255,.4)'}}>VALORES</th>
                        <th colSpan={2} style={{textAlign:'center'}}>TIEMPO</th>
                        <th/>
                      </tr>
                      <tr>
                        <th>Nombre / ID</th>
                        <th>Proyecto</th>
                        <th>Director</th>
                        <th>Stage</th>
                        <th>Canal</th>
                        <th style={{textAlign:'right'}}>Valor</th>
                        <th>Fecha aprobación</th>
                        <th style={{textAlign:'right'}}>Lead time</th>
                        <th style={{textAlign:'center'}}>Ventana</th>
                        <th style={{textAlign:'center'}}>HubSpot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadDet?Array(6).fill(0).map((_,i)=>(
                        <tr key={i}>{Array(10).fill(0).map((_,j)=>(
                          <td key={j}><div className="shimmer" style={{height:11,borderRadius:4}}/></td>
                        ))}</tr>
                      )):(det.rows||[]).map((r:any)=>{
                        const sc=STAGE_C[r.etapa_codigo]||{bg:'rgba(18,81,96,.08)',c:P.teal}
                        const ltCol=!r.dias_lead_time?undefined:r.dias_lead_time>30?P.coral:r.dias_lead_time>15?P.amber:P.green
                        return (
                          <tr key={r.hs_object_id}>
                            <td>
                              <p style={{fontWeight:600,fontSize:11,marginBottom:1,whiteSpace:'nowrap'}}>{r.nombre_legalizacion||`#${r.hs_object_id}`}</p>
                              <p style={{fontSize:9,opacity:.38,fontFamily:FB}}>ID {r.hs_object_id}</p>
                            </td>
                            <td>
                              <p style={{fontSize:11,fontWeight:500}}>{r.proyecto||'—'}</p>
                              <p style={{fontSize:10,opacity:.4}}>{r.director||''}</p>
                            </td>
                            <td style={{fontSize:11,opacity:.6,whiteSpace:'nowrap'}}>{r.director||'—'}</td>
                            <td><span style={{...sc,padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:600,whiteSpace:'nowrap',display:'inline-block'}}>{STAGE_L[r.etapa_codigo]||r.etapa_codigo}</span></td>
                            <td style={{fontSize:11,opacity:.6}}>{r.canal_atribucion||'—'}</td>
                            <td style={{textAlign:'right',fontSize:11,fontWeight:600}}>{fmtM(r.valor_del_inmueble)}</td>
                            <td style={{fontSize:11,opacity:.6}}>{r.fecha_aprobacion_final?new Date(r.fecha_aprobacion_final).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'2-digit'}):<span style={{opacity:.35}}>En proceso</span>}</td>
                            <td style={{textAlign:'right',fontSize:11,fontWeight:700,color:ltCol}}>{fmtD(r.dias_lead_time)}</td>
                            <td style={{textAlign:'center'}}>{r.en_ventana_cierre?<span style={{padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:600,background:'rgba(161,216,26,.18)',color:'#4d7c0f'}}>Ventana</span>:<span style={{opacity:.25,fontSize:11}}>—</span>}</td>
                            <td style={{textAlign:'center'}}>
                              <a href={r.hubspot_url} target="_blank" rel="noopener noreferrer"
                                style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:7,background:P.teal,textDecoration:'none'}} title="Ver en HubSpot">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="#A1D81A" strokeWidth="2.5" strokeLinecap="round"/></svg>
                              </a>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {det?.total>50&&(
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderTop:'1px solid rgba(18,81,96,.07)',background:'white'}}>
                  <button onClick={()=>fetchDet(pagina-1)} disabled={pagina<=1} style={{fontSize:11,fontWeight:600,padding:'5px 13px',borderRadius:7,border:'1px solid rgba(18,81,96,.14)',cursor:'pointer',background:'rgba(18,81,96,.05)',color:P.teal,opacity:pagina<=1?.35:1,fontFamily:FB}}>← Anterior</button>
                  <span style={{fontSize:11,opacity:.45,fontFamily:FB}}>Pág. {pagina} · {fmt(det.total)} total</span>
                  <button onClick={()=>fetchDet(pagina+1)} disabled={pagina>=Math.ceil(det.total/50)} style={{fontSize:11,fontWeight:600,padding:'5px 13px',borderRadius:7,border:'1px solid rgba(18,81,96,.14)',cursor:'pointer',background:'rgba(18,81,96,.05)',color:P.teal,opacity:pagina>=Math.ceil(det.total/50)?.35:1,fontFamily:FB}}>Siguiente →</button>
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
          onSaved={n=>{setK((prev:any)=>prev?{...prev,meta_negocios:n,pct_cumplimiento:n>0?parseFloat(((prev.aprobadas_exitoso+prev.aprobadas_novedades)/n*100).toFixed(1)):0}:prev);setMeta(false)}}/>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
