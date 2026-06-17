'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ══════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — Paleta Conaltura estricta
// ══════════════════════════════════════════════════════════════════════
const T = {
  teal:    '#125160',
  teal2:   '#1a6b7a',
  teal3:   '#1a7d6e',
  teal4:   '#279752',
  beige:   '#F4F0E5',
  beigeD:  '#E8E3D4',
  accent:  '#A1D81A',
  accentL: '#DBFF69',
  coral:   '#FF795A',
  green:   '#166534',
  amber:   '#92400E',
  red:     '#991B1B',
  white:   '#ffffff',
  ink:     '#0f3340',
}

// Tipografía: Syne para display, Inter para cuerpo
const FONT_D = `var(--font-syne), 'Syne', -apple-system, sans-serif`
const FONT_B = `var(--font-inter), 'Inter', -apple-system, sans-serif`

// Sombra card estándar
const shadow = '0 1px 3px rgba(15,51,64,0.07), 0 1px 2px rgba(15,51,64,0.04)'

// ══════════════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════════════
const MES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const fN  = (n: any, d = 0) => n == null ? '—' : Number(n).toLocaleString('es-CO', { maximumFractionDigits: d })
const fM  = (n: any) => n == null || Number(n) === 0 ? '—' : `$${(Number(n)/1_000_000).toLocaleString('es-CO',{maximumFractionDigits:1})}M`
const fD  = (n: any) => n == null ? '—' : `${Number(n).toFixed(1)} d`
const fP  = (n: any) => n == null ? '—' : `${Number(n).toFixed(1)}%`
const now = () => { const d = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Bogota'})); return {y:d.getFullYear(),m:d.getMonth()+1} }

// ══════════════════════════════════════════════════════════════════════
// GAUGE — corazón del dashboard
// ══════════════════════════════════════════════════════════════════════
function Gauge({ pct, meta, onEdit }: { pct: number; meta: number; onEdit: () => void }) {
  const [v, setV] = useState(0)
  const raf = useRef<number>()
  useEffect(() => {
    const target = Math.min(pct, 150), t0 = performance.now(), dur = 1400
    const go = (now: number) => {
      const p = Math.min((now-t0)/dur,1), ease = 1-Math.pow(1-p,3)
      setV(Math.round(ease*target))
      if (p < 1) raf.current = requestAnimationFrame(go)
    }
    raf.current = requestAnimationFrame(go)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [pct])

  const R=72, cx=90, cy=86, start=-210, sweep=240
  const arc = (sd:number,sw:number) => {
    const r=(d:number)=>d*Math.PI/180
    const [s,e]=[r(sd),r(sd+sw)]
    const [x1,y1,x2,y2]=[cx+R*Math.cos(s),cy+R*Math.sin(s),cx+R*Math.cos(e),cy+R*Math.sin(e)]
    return `M${x1} ${y1} A${R} ${R} 0 ${sw>180?1:0} 1 ${x2} ${y2}`
  }
  const fill = Math.min(v,100)/100*sweep
  const col  = v>=90?T.green:v>=60?T.amber:T.coral
  const lbl  = v>=90?'En meta':'En riesgo'
  if (v>=90 && pct>=90) {} // noop
  const lbl2 = pct>=90?'En meta ✓':pct>=60?'En riesgo':'Crítico'
  const col2 = pct>=90?T.green:pct>=60?T.amber:T.coral

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
      <svg width="180" height="110" viewBox="0 0 180 110" style={{overflow:'visible'}}>
        <path d={arc(start,sweep)} fill="none" stroke="rgba(18,81,96,0.1)" strokeWidth="12" strokeLinecap="round"/>
        {fill>0 && <path d={arc(start,fill)} fill="none" stroke={col2} strokeWidth="12" strokeLinecap="round"/>}
        <text x={cx} y={cy+2} textAnchor="middle" fontSize="32" fontWeight="800" fontFamily={FONT_D} fill={col2}>{v}%</text>
        <text x={cx} y={cy+20} textAnchor="middle" fontSize="11" fontWeight="600" fontFamily={FONT_B} fill={col2} opacity=".8">{lbl2}</text>
        {meta>0 && <text x={cx} y={cy+36} textAnchor="middle" fontSize="10" fontFamily={FONT_B} fill="rgba(18,81,96,0.45)">meta: {fN(meta)}</text>}
      </svg>
      <button onClick={onEdit} style={{
        fontSize:11,fontWeight:600,padding:'5px 14px',borderRadius:99,border:'none',cursor:'pointer',
        background: meta>0 ? 'rgba(18,81,96,0.08)' : T.accentL,
        color:T.teal, fontFamily:FONT_B,
      }}>{meta>0?'Editar meta':'+ Fijar meta del mes'}</button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// BADGE STAGE
// ══════════════════════════════════════════════════════════════════════
const STAGE_LABELS: Record<string,string> = {
  consignacion:'Consignación', legal_espera:'Espera Director',
  legal_aprobada_dir:'Aprobada Dir.', revision_sinco:'Rev. SINCO',
  aprobado_exitoso:'Aprobado ✓', aprobado_novedades:'Con novedades',
  negocio_rechazado:'Rechazado', venta_caida:'Caída',
}
const STAGE_STYLE: Record<string,{bg:string;color:string}> = {
  aprobado_exitoso:   {bg:'rgba(22,101,52,.12)',  color:T.green},
  aprobado_novedades: {bg:'rgba(146,64,14,.12)',  color:T.amber},
  negocio_rechazado:  {bg:'rgba(255,121,90,.15)', color:T.coral},
  venta_caida:        {bg:'rgba(153,27,27,.12)',  color:T.red},
  consignacion:       {bg:'rgba(18,81,96,.09)',   color:T.teal},
  legal_espera:       {bg:'rgba(26,107,122,.09)', color:T.teal2},
  legal_aprobada_dir: {bg:'rgba(26,125,110,.09)', color:T.teal3},
  revision_sinco:     {bg:'rgba(39,151,82,.09)',  color:T.teal4},
}
function Badge({c}:{c:string}) {
  const s = STAGE_STYLE[c]||{bg:'rgba(18,81,96,.08)',color:T.teal}
  return <span style={{...s,padding:'2px 9px',borderRadius:99,fontSize:11,fontWeight:600,whiteSpace:'nowrap',display:'inline-block',fontFamily:FONT_B}}>{STAGE_LABELS[c]||c}</span>
}

// ══════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
// TABLA DE CIUDADES — reemplaza el mapa eliminado
// ══════════════════════════════════════════════════════════════════════
function TablaCiudades({ ciudades }: { ciudades: any[] }) {
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,fontFamily:FONT_B}}>
        <thead>
          <tr style={{background:T.beigeD}}>
            {['Ciudad','Aprobadas','En proceso','Caídas','Lead time'].map(h=>(
              <th key={h} style={{padding:'10px 14px',textAlign:h==='Ciudad'?'left':'right',
                fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',
                opacity:.55,borderBottom:`1.5px solid rgba(18,81,96,0.1)`,color:T.teal}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...ciudades].sort((a,b)=>b.aprobadas-a.aprobadas).map((c,i)=>(
            <tr key={c.ciudad} style={{borderBottom:`1px solid rgba(18,81,96,0.055)`,
              background:i%2===0?T.white:'rgba(244,240,229,0.35)'}}>
              <td style={{padding:'11px 14px',fontWeight:700}}>{c.ciudad}</td>
              <td style={{padding:'11px 14px',textAlign:'right',fontWeight:700,color:T.green}}>{fN(c.aprobadas)}</td>
              <td style={{padding:'11px 14px',textAlign:'right',color:T.teal2}}>{fN(c.pipeline_activo)}</td>
              <td style={{padding:'11px 14px',textAlign:'right',color:c.ventas_caidas>0?T.red:undefined}}>{fN(c.ventas_caidas)}</td>
              <td style={{padding:'11px 14px',textAlign:'right',opacity:.65}}>{fD(c.avg_lead_time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// MODAL META
// ══════════════════════════════════════════════════════════════════════
function MetaModal({anio,mes,actual,onClose,onSaved}:{anio:number;mes:number;actual:number;onClose:()=>void;onSaved:(n:number)=>void}) {
  const [v,setV]=useState(actual>0?String(actual):'')
  const [s,setS]=useState(false)
  async function save() {
    const n=parseInt(v,10); if(isNaN(n)||n<0) return
    setS(true)
    await fetch('/api/metas/upsert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({anio,mes,meta_negocios:n})})
    onSaved(n); onClose()
  }
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{
      position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',
      padding:20,background:'rgba(15,51,64,0.45)',backdropFilter:'blur(6px)'}}>
      <div style={{background:T.white,borderRadius:16,padding:32,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(15,51,64,0.2)'}}>
        <h3 style={{fontFamily:FONT_D,fontSize:20,fontWeight:700,color:T.teal,marginBottom:4}}>Meta de legalizaciones</h3>
        <p style={{fontSize:12,opacity:.5,marginBottom:20,fontFamily:FONT_B}}>{MES[mes]} {anio} · aprobaciones objetivo</p>
        <label style={{display:'block',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',opacity:.5,marginBottom:8,fontFamily:FONT_B}}>Número objetivo</label>
        <input type="number" min="0" value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} autoFocus placeholder="ej. 150"
          style={{width:'100%',padding:'12px 16px',borderRadius:10,border:`1.5px solid rgba(18,81,96,0.2)`,
            fontSize:22,fontWeight:700,color:T.teal,fontFamily:FONT_D,marginBottom:16,outline:'none',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:'11px 0',borderRadius:10,border:'none',cursor:'pointer',background:T.beigeD,color:'rgba(18,81,96,0.6)',fontWeight:600,fontFamily:FONT_B}}>Cancelar</button>
          <button onClick={save} disabled={s||!v} style={{flex:1,padding:'11px 0',borderRadius:10,border:'none',cursor:'pointer',background:T.accentL,color:T.teal,fontWeight:700,fontFamily:FONT_B,opacity:(s||!v)?0.5:1}}>
            {s?'Guardando…':'Guardar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ══════════════════════════════════════════════════════════════════════
function SH({title,sub,right}:{title:string;sub?:string;right?:React.ReactNode}) {
  return (
    <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:16}}>
      <div>
        {sub&&<p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.09em',opacity:.38,marginBottom:3,fontFamily:FONT_B}}>{sub}</p>}
        <h2 style={{fontFamily:FONT_D,fontSize:22,fontWeight:700,color:T.teal,margin:0,lineHeight:1.2}}>{title}</h2>
      </div>
      {right}
    </div>
  )
}

// Card wrapper
function Card({children,p=24}:{children:React.ReactNode;p?:number}) {
  return <div style={{background:T.white,borderRadius:14,border:`1px solid rgba(18,81,96,0.08)`,boxShadow:shadow,overflow:'hidden',padding:p}}>{children}</div>
}

// Skeleton
function Sk({h=120}:{h?:number}) {
  return <div style={{height:h,borderRadius:14,background:`linear-gradient(90deg,rgba(18,81,96,0.05) 25%,rgba(18,81,96,0.09) 50%,rgba(18,81,96,0.05) 75%)`,backgroundSize:'200% 100%',animation:'shimmer 1.6s ease infinite'}}/>
}

const TT = {
  contentStyle:{background:T.white,border:`1px solid rgba(18,81,96,0.1)`,borderRadius:10,fontSize:12,fontFamily:FONT_B,boxShadow:shadow},
  labelStyle:{color:T.teal,fontWeight:700,marginBottom:4},
}

// ══════════════════════════════════════════════════════════════════════
// DASHBOARD PRINCIPAL
// ══════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const h = now()
  const [anio,setAnio]=useState(h.y)
  const [mes, setMes] =useState(h.m)
  const [ciudad,  setCiudad] =useState('')
  const [director,setDir]    =useState('')
  const [showMeta,setMeta]   =useState(false)
  const [sidebar, setSidebar]=useState(false)
  const [pagina,  setPagina] =useState(1)

  const [kpis,   setK]=useState<any>(null)
  const [pipe,   setP]=useState<any>(null)
  const [tend,   setT]=useState<any>(null)
  const [times,  setTi]=useState<any>(null)
  const [mapa,   setMa]=useState<any>(null)
  const [proy,   setPr]=useState<any>(null)
  const [cana,   setCa]=useState<any>(null)
  const [det,    setDe]=useState<any>(null)
  const [ldDet,  setLd]=useState(false)

  const qs = useCallback(()=>{
    const p=new URLSearchParams({anio:String(anio),mes:String(mes)})
    if(ciudad)   p.set('ciudad',ciudad)
    if(director) p.set('director',director)
    return p.toString()
  },[anio,mes,ciudad,director])

  const fetchAll = useCallback(async()=>{
    setK(null);setP(null);setTi(null);setMa(null);setPr(null);setCa(null)
    const q=qs()
    const tq=new URLSearchParams({meses:'14',...Object.fromEntries(new URLSearchParams(q))}).toString()
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
  },[qs])

  const fetchDet = useCallback(async(pg=1)=>{
    setLd(true)
    try { setDe(await fetch(`/api/detalle?${qs()}&pagina=${pg}&por_pagina=50`).then(r=>r.json())); setPagina(pg) }
    finally { setLd(false) }
  },[qs])

  useEffect(()=>{fetchAll()},[fetchAll])
  useEffect(()=>{fetchDet(1)},[fetchDet])

  const periodos:any[]=[]
  let pa=h.y,pm=h.m
  for(let i=0;i<18;i++){periodos.push({y:pa,m:pm,l:`${MES[pm]} ${pa}`});pm--;if(pm<1){pm=12;pa--}}

  const STAGE_COLORS = [T.teal, T.teal2, T.teal3, T.teal4]
  const canalColors=['#125160','#1a6b7a','#1a7d6e','#279752','#4d7c0f','#166534']

  return (
    <div style={{minHeight:'100vh',background:T.beige,fontFamily:FONT_B,color:T.teal}}>
      <style>{`
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(18,81,96,0.2);border-radius:99px}
      `}</style>

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      {sidebar&&<div onClick={()=>setSidebar(false)} style={{position:'fixed',inset:0,zIndex:20,background:'rgba(0,0,0,0.22)'}}/>}
      <aside style={{position:'fixed',inset:'0 auto 0 0',width:248,zIndex:30,
        background:T.ink,display:'flex',flexDirection:'column',
        transform:sidebar?'translateX(0)':'translateX(-100%)',
        transition:'transform .28s cubic-bezier(.4,0,.2,1)'}}>

        {/* Logo */}
        <div style={{padding:'22px 20px 18px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:'rgba(161,216,26,0.14)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <p style={{color:T.white,fontFamily:FONT_D,fontWeight:700,fontSize:14,margin:0,lineHeight:1.2}}>BI Legalizaciones</p>
            <p style={{color:'rgba(255,255,255,0.35)',fontSize:11,margin:0}}>Conaltura</p>
          </div>
          <button onClick={()=>setSidebar(false)} style={{color:'rgba(255,255,255,0.3)',background:'none',border:'none',cursor:'pointer',fontSize:18,lineHeight:1,padding:4}}>✕</button>
        </div>

        {/* Período */}
        <div style={{padding:'16px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
          <p style={{color:'rgba(255,255,255,0.35)',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Período</p>
          <select value={`${anio}-${mes}`} onChange={e=>{const[a,m]=e.target.value.split('-').map(Number);setAnio(a);setMes(m)}}
            style={{width:'100%',background:'rgba(255,255,255,0.09)',color:T.white,border:'none',borderRadius:9,padding:'8px 11px',fontSize:13,fontWeight:600,outline:'none',cursor:'pointer',fontFamily:FONT_D}}>
            {periodos.map(o=><option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`} style={{background:'#1a3d4c',color:T.white}}>{o.l}</option>)}
          </select>
        </div>

        {/* Filtros */}
        <div style={{padding:'16px 18px',flex:1,overflowY:'auto'}}>
          <p style={{color:'rgba(255,255,255,0.35)',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:14}}>Filtros</p>
          {([
            {l:'Ciudad',v:ciudad,s:setCiudad,opts:['Medellín','Bogotá','Barranquilla','Cartagena','Cali']},
            {l:'Director',v:director,s:setDir,opts:['Alba Luz Consuegra','Carolina Cárdenas','Ingrid Marcela Matta','Leonardo Villegas','Natalia Giraldo','Patricia Herrera']},
          ] as any[]).map((f:any)=>(
            <div key={f.l} style={{marginBottom:14}}>
              <label style={{display:'block',color:'rgba(255,255,255,0.4)',fontSize:11,marginBottom:6,fontWeight:500}}>{f.l}</label>
              <select value={f.v} onChange={(e:any)=>f.s(e.target.value)}
                style={{width:'100%',background:'rgba(255,255,255,0.08)',color:T.white,border:'none',borderRadius:9,padding:'8px 11px',fontSize:12,outline:'none',cursor:'pointer',fontFamily:FONT_B}}>
                <option value="" style={{background:'#1a3d4c'}}>Todos</option>
                {f.opts.map((o:string)=><option key={o} value={o} style={{background:'#1a3d4c'}}>{o}</option>)}
              </select>
            </div>
          ))}
          {(ciudad||director)&&(
            <button onClick={()=>{setCiudad('');setDir('')}} style={{
              width:'100%',padding:'8px 0',borderRadius:9,border:'none',cursor:'pointer',marginTop:4,
              background:'rgba(255,121,90,0.16)',color:T.coral,fontSize:12,fontWeight:600,fontFamily:FONT_B}}>
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'14px 18px',borderTop:'1px solid rgba(255,255,255,0.05)'}}>
          {kpis?.ultima_actualizacion&&(
            <p style={{color:'rgba(255,255,255,0.25)',fontSize:11,marginBottom:4,fontFamily:FONT_B}}>
              ETL: {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            </p>
          )}
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:T.accent,boxShadow:`0 0 6px ${T.accent}`}}/>
            <span style={{color:'rgba(255,255,255,0.3)',fontSize:11,fontFamily:FONT_B}}>Live · actualización cada 2h</span>
          </div>
        </div>
      </aside>

      {/* ── TOPBAR ───────────────────────────────────────────────── */}
      <header style={{position:'sticky',top:0,zIndex:10,display:'flex',alignItems:'center',gap:12,
        padding:'11px 24px',background:'rgba(244,240,229,0.95)',backdropFilter:'blur(12px)',
        borderBottom:`1px solid rgba(18,81,96,0.08)`}}>

        <button onClick={()=>setSidebar(true)} style={{
          width:36,height:36,borderRadius:9,background:T.teal,border:'none',cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="15" height="12" viewBox="0 0 15 12" fill="none">
            <path d="M0 1h15M0 6h15M0 11h15" stroke={T.accent} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <span style={{fontFamily:FONT_D,fontWeight:700,fontSize:15,color:T.teal,whiteSpace:'nowrap'}}>BI Legalizaciones</span>
        <span style={{opacity:.2,fontSize:15}}>/</span>
        <span style={{fontSize:14,opacity:.55,whiteSpace:'nowrap'}}>{MES[mes]} {anio}</span>

        {/* Chips activos */}
        <div style={{display:'flex',gap:6,flex:1,flexWrap:'wrap'}}>
          {[ciudad&&{l:ciudad,c:setCiudad},director&&{l:director,c:setDir}].filter(Boolean).map((f:any)=>(
            <span key={f.l} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:600,background:'rgba(18,81,96,0.09)',color:T.teal,fontFamily:FONT_B}}>
              {f.l}<button onClick={()=>f.c('')} style={{background:'none',border:'none',cursor:'pointer',opacity:.5,fontSize:12,padding:0,lineHeight:1,color:T.teal}}>✕</button>
            </span>
          ))}
        </div>

        <select value={`${anio}-${mes}`} onChange={e=>{const[a,m]=e.target.value.split('-').map(Number);setAnio(a);setMes(m)}}
          style={{fontSize:13,fontWeight:600,padding:'6px 10px',borderRadius:8,border:`1px solid rgba(18,81,96,0.15)`,background:T.white,color:T.teal,outline:'none',cursor:'pointer',fontFamily:FONT_D,flexShrink:0}}>
          {periodos.map(o=><option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{o.l}</option>)}
        </select>
      </header>

      {/* ── CONTENIDO ────────────────────────────────────────────── */}
      <main style={{maxWidth:1320,margin:'0 auto',padding:'36px 24px 80px'}}>

        {/* ═══════════════════════════════════════════════════════════
            1. KPIs DEL MES
        ═══════════════════════════════════════════════════════════ */}
        <section style={{marginBottom:48}}>
          <SH title={`${MES[mes]} ${anio}`} sub="¿Qué se resolvió este mes?"
            right={kpis?.ultima_actualizacion&&<span style={{fontSize:11,opacity:.4,fontFamily:FONT_B}}>
              Act. {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            </span>}/>

          {!kpis?<Sk h={260}/>:(()=>{
            const apr = kpis.aprobadas_exitoso+kpis.aprobadas_novedades
            return (
              <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:16}}>
                {/* Gauge */}
                <Card>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:4}}>
                    <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',opacity:.4,textAlign:'center',fontFamily:FONT_B}}>Cumplimiento vs meta</p>
                    <Gauge pct={kpis.pct_cumplimiento} meta={kpis.meta_negocios} onEdit={()=>setMeta(true)}/>
                  </div>
                </Card>

                {/* 6 KPI cards */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                  {[
                    {l:'Total del mes',    v:kpis.total_resolucion,    col:T.teal,   sub:`${apr} aprobadas · ${kpis.rechazadas} rechazadas`},
                    {l:'Sin novedades ✓',  v:kpis.aprobadas_exitoso,   col:T.green,  sub:apr>0?`${((kpis.aprobadas_exitoso/apr)*100).toFixed(0)}% de las aprobadas`:undefined},
                    {l:'Con novedades',    v:kpis.aprobadas_novedades, col:T.amber,  sub:apr>0?`${((kpis.aprobadas_novedades/apr)*100).toFixed(0)}% de las aprobadas`:undefined},
                    {l:'Rechazadas',       v:kpis.rechazadas,          col:kpis.rechazadas>0?T.coral:T.teal, sub:undefined},
                    {l:'Ventas caídas',    v:kpis.ventas_caidas,       col:kpis.ventas_caidas>0?T.red:T.teal, sub:undefined},
                    {l:'En ventana cierre',v:`${kpis.pct_ventana_cierre}%`, col:kpis.pct_ventana_cierre>40?T.amber:T.teal, sub:`${kpis.en_ventana_cierre} aprobadas en últimos días del mes`},
                  ].map(k=>(
                    <div key={k.l} style={{background:T.beigeD,borderRadius:12,padding:'18px 20px'}}>
                      <p style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',opacity:.5,marginBottom:10,lineHeight:1.4,fontFamily:FONT_B}}>{k.l}</p>
                      <p style={{fontFamily:FONT_D,fontSize:34,fontWeight:800,color:k.col,margin:0,lineHeight:1,letterSpacing:'-.02em'}}>
                        {typeof k.v==='number'?fN(k.v):k.v}
                      </p>
                      {k.sub&&<p style={{fontSize:11,marginTop:7,opacity:.55,lineHeight:1.4,fontFamily:FONT_B}}>{k.sub}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </section>

        {/* ═══════════════════════════════════════════════════════════
            2. PROYECTOS — tabla principal (solicitada como primer nivel)
        ═══════════════════════════════════════════════════════════ */}
        <section style={{marginBottom:48}}>
          <SH title="Resultados por proyecto" sub="¿Cuánto se legalizó, dónde y cuánto vale?"/>
          {!proy?<Sk h={220}/>:(
            <Card p={0}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,fontFamily:FONT_B}}>
                  <thead>
                    <tr style={{background:T.beigeD}}>
                      {['Proyecto','Director','Ciudad','Total aprobadas','Sin novedades','Con novedades','Rechazadas','Pipeline activo','Ventas caídas','Valor total','Lead time prom.'].map(h=>(
                        <th key={h} style={{padding:'11px 13px',textAlign:['Proyecto','Director','Ciudad'].includes(h)?'left':'right',
                          fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',opacity:.55,
                          borderBottom:`1.5px solid rgba(18,81,96,0.1)`,whiteSpace:'nowrap',color:T.teal}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(proy.proyectos||[]).map((p:any,i:number)=>{
                      const apr=(p.exitosas||0)+(p.con_novedades||0)
                      const pct=proy.total_aprobadas>0?(apr/proy.total_aprobadas*100).toFixed(1):'0.0'
                      return (
                        <tr key={p.proyecto||i} style={{borderBottom:`1px solid rgba(18,81,96,0.055)`,
                          background:i%2===0?T.white:'rgba(244,240,229,0.35)'}}>
                          <td style={{padding:'11px 13px',fontWeight:700,maxWidth:170,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.proyecto||'Sin asignar'}</td>
                          <td style={{padding:'11px 13px',fontSize:12,opacity:.65}}>{p.director||'—'}</td>
                          <td style={{padding:'11px 13px',fontSize:12,opacity:.65}}>{p.ciudad||'—'}</td>
                          <td style={{padding:'11px 13px',textAlign:'right'}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8}}>
                              <div style={{width:36,height:4,borderRadius:99,background:'rgba(18,81,96,0.1)',overflow:'hidden'}}>
                                <div style={{width:`${Math.min(Number(pct),100)}%`,height:'100%',background:T.teal,borderRadius:99}}/>
                              </div>
                              <span style={{fontWeight:700,color:T.green}}>{fN(apr)}</span>
                              <span style={{fontSize:10,opacity:.4}}>({pct}%)</span>
                            </div>
                          </td>
                          <td style={{padding:'11px 13px',textAlign:'right',color:T.green,fontWeight:600}}>{fN(p.exitosas)}</td>
                          <td style={{padding:'11px 13px',textAlign:'right',color:T.amber,fontWeight:600}}>{fN(p.con_novedades)}</td>
                          <td style={{padding:'11px 13px',textAlign:'right',color:(p.rechazadas||0)>0?T.coral:undefined}}>{fN(p.rechazadas)}</td>
                          <td style={{padding:'11px 13px',textAlign:'right',color:T.teal2}}>{fN(p.pipeline_activo)}</td>
                          <td style={{padding:'11px 13px',textAlign:'right',color:(p.ventas_caidas||0)>0?T.red:undefined}}>{fN(p.ventas_caidas)}</td>
                          <td style={{padding:'11px 13px',textAlign:'right',fontWeight:700}}>{fM(p.suma_valor_inmueble)}</td>
                          <td style={{padding:'11px 13px',textAlign:'right',opacity:.7}}>{fD(p.avg_lead_time)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{background:T.beigeD,fontWeight:700}}>
                      <td colSpan={3} style={{padding:'11px 13px',fontSize:12,fontFamily:FONT_D}}>TOTAL COMPAÑÍA</td>
                      <td style={{padding:'11px 13px',textAlign:'right',color:T.green,fontFamily:FONT_D,fontSize:14}}>{fN(proy.total_aprobadas)}</td>
                      <td colSpan={7}/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════
            3. PIPELINE — qué viene en camino
        ═══════════════════════════════════════════════════════════ */}
        <section style={{marginBottom:48}}>
          <SH title={`${pipe?fN(pipe.total_pipeline):'…'} legalizaciones en proceso`} sub="¿Qué viene en camino?"/>
          {!pipe?<Sk h={180}/>:(
            <Card>
              {/* Narrative sentence */}
              <p style={{fontSize:14,lineHeight:1.7,marginBottom:20,opacity:.75,fontFamily:FONT_B}}>
                Hay <strong style={{color:T.teal,fontFamily:FONT_D}}>{fN(pipe.total_pipeline)}</strong> legalizaciones activas distribuidas en 4 etapas del proceso.
                {pipe.caidas_del_mes>0&&<> Este mes cayeron <strong style={{color:T.red}}>{pipe.caidas_del_mes}</strong> ventas.</>}
              </p>

              {/* Barra proporcional */}
              <div style={{display:'flex',gap:4,height:60,borderRadius:12,overflow:'hidden',marginBottom:20}}>
                {(pipe.stages||[]).map((s:any,i:number)=>{
                  if(s.count===0) return null
                  return (
                    <div key={s.etapa_codigo} style={{
                      flex:s.count,minWidth:4,background:STAGE_COLORS[i]||T.teal,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      transition:'flex .8s cubic-bezier(.4,0,.2,1)'}}>
                      {s.pct_del_total>8&&<span style={{color:T.white,fontSize:15,fontFamily:FONT_D,fontWeight:700}}>{s.count}</span>}
                    </div>
                  )
                })}
              </div>

              {/* Leyenda con detalle */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
                {(pipe.stages||[]).map((s:any,i:number)=>(
                  <div key={s.etapa_codigo}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                      <div style={{width:10,height:10,borderRadius:3,background:STAGE_COLORS[i]||T.teal,flexShrink:0}}/>
                      <span style={{fontSize:11,fontWeight:600,fontFamily:FONT_B}}>{s.etapa_label}</span>
                    </div>
                    <p style={{fontFamily:FONT_D,fontSize:28,fontWeight:800,color:STAGE_COLORS[i]||T.teal,margin:'4px 0 2px'}}>{fN(s.count)}</p>
                    <p style={{fontSize:11,opacity:.45,fontFamily:FONT_B}}>{s.pct_del_total}% del total{s.aging_promedio!=null?` · ${s.aging_promedio}d prom.`:''}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════
            4. TENDENCIA — evolución mensual
        ═══════════════════════════════════════════════════════════ */}
        <section style={{marginBottom:48}}>
          <SH title="Evolución mensual" sub="¿Cómo vamos en el tiempo?"/>
          {!tend?<Sk h={270}/>:(
            <Card>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:20}}>
                {[{c:T.teal,l:'Aprobadas'},{c:T.coral,l:'Rechazadas'},{c:T.red,l:'Caídas'},{c:T.accent,l:'Meta',d:true}].map(({c,l,d})=>(
                  <div key={l} style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:20,height:d?0:2.5,borderTop:d?`2px dashed ${c}`:undefined,background:d?undefined:c,borderRadius:99}}/>
                    <span style={{fontSize:12,opacity:.6,fontFamily:FONT_B}}>{l}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={235}>
                <AreaChart data={tend.meses} margin={{top:4,right:8,left:-22,bottom:0}}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.teal} stopOpacity={.13}/>
                      <stop offset="95%" stopColor={T.teal} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,81,96,0.06)"/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:'rgba(18,81,96,0.5)',fontFamily:FONT_B}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:'rgba(18,81,96,0.4)',fontFamily:FONT_B}} axisLine={false} tickLine={false}/>
                  <Tooltip {...TT} formatter={(v:any,n:any)=>[fN(v), n==='aprobadas'?'Aprobadas':n==='rechazadas'?'Rechazadas':n==='ventas_caidas'?'Caídas':'Meta']}/>
                  <Area type="monotone" dataKey="meta" stroke={T.accent} strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} connectNulls/>
                  <Area type="monotone" dataKey="aprobadas" stroke={T.teal} strokeWidth={2.5} fill="url(#gA)" dot={{fill:T.teal,r:3,strokeWidth:0}} activeDot={{r:5}}/>
                  <Area type="monotone" dataKey="rechazadas" stroke={T.coral} strokeWidth={1.5} fill="none" dot={{fill:T.coral,r:2,strokeWidth:0}}/>
                  <Area type="monotone" dataKey="ventas_caidas" stroke={T.red} strokeWidth={1.5} fill="none" dot={{fill:T.red,r:2,strokeWidth:0}}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════
            5. TIEMPOS — salud del proceso
        ═══════════════════════════════════════════════════════════ */}
        <section style={{marginBottom:48}}>
          <SH title="¿Qué tan rápido va el proceso?" sub="Velocidad y cuellos de botella"/>
          {!times?<Sk h={240}/>:(
            <Card>
              {/* Headline global */}
              {times.global?.p50_lead_time!=null&&(
                <div style={{display:'flex',gap:32,flexWrap:'wrap',marginBottom:28,padding:'20px 24px',borderRadius:10,background:T.beigeD}}>
                  <div>
                    <p style={{fontSize:11,opacity:.45,marginBottom:5,fontFamily:FONT_B}}>La mitad de las legalizaciones se aprueba en menos de</p>
                    <p style={{fontFamily:FONT_D,fontSize:44,fontWeight:800,color:T.teal,margin:0,lineHeight:1}}>
                      {times.global.p50_lead_time}<span style={{fontSize:20,fontWeight:400,opacity:.5,marginLeft:6,fontFamily:FONT_B}}>días</span>
                    </p>
                  </div>
                  <div style={{display:'flex',gap:24,alignItems:'center'}}>
                    {[['Promedio',times.global.avg_lead_time],['9 de cada 10 en menos de',times.global.p90_lead_time]].map(([l,v])=>(
                      <div key={l as string}>
                        <p style={{fontSize:11,opacity:.45,marginBottom:5,fontFamily:FONT_B}}>{l}</p>
                        <p style={{fontFamily:FONT_D,fontSize:24,fontWeight:700,color:T.teal,margin:0}}>{fD(v as number)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Por stage */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:20,marginBottom:28}}>
                {(times.por_stage||[]).filter((s:any)=>s.n>0).map((s:any)=>{
                  const col = !s.p50_dias?'rgba(18,81,96,0.3)':s.p50_dias<=15?T.green:s.p50_dias<=30?T.amber:T.coral
                  const txt = !s.p50_dias?'':s.p50_dias<=15?'Rápido':s.p50_dias<=30?'Normal':'Lento'
                  return (
                    <div key={s.stage}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                        <span style={{fontSize:13,fontWeight:600,fontFamily:FONT_B}}>{s.label}</span>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          {txt&&<span style={{fontSize:11,fontWeight:600,color:col,fontFamily:FONT_B}}>{txt}</span>}
                          <span style={{fontFamily:FONT_D,fontSize:18,fontWeight:700,color:T.teal}}>{fD(s.avg_dias)}</span>
                        </div>
                      </div>
                      {/* Barra semáforo */}
                      <div style={{height:10,borderRadius:99,background:'rgba(18,81,96,0.07)',position:'relative',overflow:'hidden'}}>
                        <div style={{position:'absolute',inset:'0 auto 0 0',width:'25%',background:T.green,opacity:.18}}/>
                        <div style={{position:'absolute',inset:'0 auto 0 0',left:'25%',width:'25%',background:T.amber,opacity:.18}}/>
                        {s.avg_dias!=null&&(
                          <div style={{position:'absolute',top:'50%',transform:'translate(-50%,-50%)',
                            left:`${Math.min((s.avg_dias/60)*100,96)}%`,
                            width:14,height:14,borderRadius:'50%',background:col,border:'2.5px solid white'}}/>
                        )}
                      </div>
                      <div style={{display:'flex',gap:10,marginTop:5}}>
                        <span style={{fontSize:10,opacity:.38,fontFamily:FONT_B}}>Mediana: {fD(s.p50_dias)}</span>
                        <span style={{fontSize:10,opacity:.38,fontFamily:FONT_B}}>P90: {fD(s.p90_dias)}</span>
                        <span style={{fontSize:10,opacity:.38,fontFamily:FONT_B}}>n={fN(s.n)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Ranking proyectos */}
              {(times.por_proyecto||[]).length>0&&(
                <>
                  <p style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',opacity:.38,marginBottom:14,fontFamily:FONT_B}}>Velocidad por proyecto</p>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {times.por_proyecto.slice(0,10).map((p:any)=>{
                      const maxLt=times.por_proyecto[0]?.avg_lead_time||1
                      const col=p.semaforo==='verde'?T.green:p.semaforo==='amarillo'?T.amber:p.semaforo==='rojo'?T.coral:'rgba(18,81,96,0.3)'
                      return (
                        <div key={p.proyecto}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <div style={{width:8,height:8,borderRadius:'50%',background:col,flexShrink:0}}/>
                              <span style={{fontSize:12,fontWeight:600,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:FONT_B}}>{p.proyecto}</span>
                              <span style={{fontSize:11,opacity:.38,fontFamily:FONT_B}}>({fN(p.n)})</span>
                            </div>
                            <span style={{fontSize:13,fontWeight:700,fontFamily:FONT_D}}>{fD(p.avg_lead_time)}</span>
                          </div>
                          <div style={{height:5,borderRadius:99,background:'rgba(18,81,96,0.07)'}}>
                            <div style={{height:'100%',borderRadius:99,background:col,opacity:.72,width:`${((p.avg_lead_time||0)/maxLt)*100}%`,transition:'width .7s'}}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{display:'flex',gap:14,marginTop:14,paddingTop:12,borderTop:`1px solid rgba(18,81,96,0.07)`}}>
                    {[{c:T.green,l:'Rápido (≤15d)'},{c:T.amber,l:'Normal (16–30d)'},{c:T.coral,l:'Lento (>30d)'}].map(({c,l})=>(
                      <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:c}}/>
                        <span style={{fontSize:11,opacity:.5,fontFamily:FONT_B}}>{l}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════
            6. CIUDADES
        ═══════════════════════════════════════════════════════════ */}
        <section style={{marginBottom:48}}>
          <SH title="Distribución geográfica" sub="¿Dónde ocurren las legalizaciones?"/>
          {!mapa?<Sk h={200}/>:(
            <Card p={0}>
              <TablaCiudades ciudades={mapa.ciudades||[]}/>
            </Card>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════
            7. CANALES
        ═══════════════════════════════════════════════════════════ */}
        <section style={{marginBottom:48}}>
          <SH title="Canales de atribución" sub="¿Por qué canal llegan los negocios?"/>
          {!cana?<Sk h={200}/>:(
            <Card>
              {[{k:'por_atribucion',l:'Canal de atribución'},{k:'por_gestion_original',l:'Gestión comercial original'},{k:'por_gestion_secundario',l:'Gestión comercial secundario'}].map(({k,l})=>{
                const rows=(cana[k]||[]).filter((r:any)=>r.canal&&r.canal!=='')
                if(!rows.length) return null
                const maxA=Math.max(...rows.map((r:any)=>r.aprobadas),1)
                return (
                  <div key={k} style={{marginBottom:28}}>
                    <p style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',opacity:.4,marginBottom:14,fontFamily:FONT_B}}>{l}</p>
                    <div style={{display:'flex',flexDirection:'column',gap:9}}>
                      {rows.map((r:any,i:number)=>(
                        <div key={r.canal} style={{display:'flex',alignItems:'center',gap:12}}>
                          <span style={{fontSize:12,fontWeight:600,width:188,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:FONT_B}}>{r.canal}</span>
                          <div style={{flex:1,height:26,borderRadius:7,background:'rgba(18,81,96,0.06)',overflow:'hidden',position:'relative'}}>
                            <div style={{position:'absolute',inset:'0 auto 0 0',background:canalColors[i%canalColors.length],
                              width:`${(r.aprobadas/maxA)*100}%`,borderRadius:7,opacity:.82,transition:'width .7s'}}/>
                            {(r.aprobadas/maxA)>0.12&&(
                              <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',
                                fontSize:11,fontWeight:700,color:T.white,fontFamily:FONT_D}}>{fN(r.aprobadas)}</span>
                            )}
                          </div>
                          <span style={{fontSize:11,fontWeight:600,width:40,textAlign:'right',flexShrink:0,fontFamily:FONT_B}}>{r.pct_del_total}%</span>
                          <span style={{fontSize:11,opacity:.4,width:44,textAlign:'right',flexShrink:0,fontFamily:FONT_B}}>{fD(r.avg_lead_time)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════
            8. TABLA DETALLE — cada legalización con link a HubSpot
        ═══════════════════════════════════════════════════════════ */}
        <section style={{marginBottom:48}}>
          <SH title="Legalizaciones individuales"
            sub="Trazabilidad a HubSpot"
            right={det&&<span style={{fontSize:12,opacity:.45,fontFamily:FONT_B}}>{fN(det.total)} registros</span>}/>
          {!det?<Sk h={300}/>:(
            <Card p={0}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,fontFamily:FONT_B}}>
                  <thead>
                    <tr style={{background:T.beigeD}}>
                      {['Legalización','Proyecto / Director','Stage','Canal','Comprador','Valor','Fecha aprobación','Lead time',''].map(h=>(
                        <th key={h} style={{padding:'11px 12px',textAlign:['Legalización','Proyecto / Director','Stage','Canal','Comprador'].includes(h)?'left':'right',
                          fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',
                          opacity:.55,borderBottom:`1.5px solid rgba(18,81,96,0.1)`,whiteSpace:'nowrap',color:T.teal}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ldDet?Array(6).fill(0).map((_,i)=>(
                      <tr key={i}>{Array(9).fill(0).map((_,j)=>(
                        <td key={j} style={{padding:'12px'}}><div style={{height:12,borderRadius:4,background:'rgba(18,81,96,0.07)',animation:'shimmer 1.5s ease infinite'}}/></td>
                      ))}</tr>
                    )):(det.rows||[]).map((r:any)=>(
                      <tr key={r.hs_object_id} style={{borderBottom:`1px solid rgba(18,81,96,0.055)`}}>
                        <td style={{padding:'11px 12px'}}>
                          <p style={{fontWeight:600,fontSize:12,marginBottom:1,whiteSpace:'nowrap'}}>{r.nombre_legalizacion||`#${r.hs_object_id}`}</p>
                          <p style={{fontSize:10,opacity:.4}}>ID {r.hs_object_id}</p>
                        </td>
                        <td style={{padding:'11px 12px'}}>
                          <p style={{fontSize:12,fontWeight:500}}>{r.proyecto||'—'}</p>
                          <p style={{fontSize:11,opacity:.4}}>{r.director||''}</p>
                        </td>
                        <td style={{padding:'11px 12px'}}><Badge c={r.etapa_codigo}/></td>
                        <td style={{padding:'11px 12px',fontSize:12,opacity:.65}}>{r.canal_atribucion||'—'}</td>
                        <td style={{padding:'11px 12px',fontSize:12,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.nombrecomprador||'—'}</td>
                        <td style={{padding:'11px 12px',textAlign:'right',fontSize:12,fontWeight:600}}>{fM(r.valor_del_inmueble)}</td>
                        <td style={{padding:'11px 12px',textAlign:'right',fontSize:12,opacity:.6}}>
                          {r.fecha_aprobacion_final?new Date(r.fecha_aprobacion_final).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'2-digit'}):<span style={{opacity:.35}}>En proceso</span>}
                        </td>
                        <td style={{padding:'11px 12px',textAlign:'right',fontSize:12,fontWeight:600,
                          color:!r.dias_lead_time?undefined:r.dias_lead_time>30?T.coral:r.dias_lead_time>15?T.amber:T.green}}>
                          {fD(r.dias_lead_time)}
                        </td>
                        <td style={{padding:'11px 12px',textAlign:'right'}}>
                          <a href={r.hubspot_url} target="_blank" rel="noopener noreferrer"
                            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                              width:30,height:30,borderRadius:8,background:T.teal,textDecoration:'none'}}
                            title="Ver en HubSpot">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Paginación */}
              {det.total>50&&(
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderTop:`1px solid rgba(18,81,96,0.07)`}}>
                  <button onClick={()=>fetchDet(pagina-1)} disabled={pagina<=1}
                    style={{fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',background:T.beigeD,color:T.teal,opacity:pagina<=1?0.35:1,fontFamily:FONT_B}}>← Anterior</button>
                  <span style={{fontSize:12,opacity:.5,fontFamily:FONT_B}}>Pág. {pagina} · {fN(det.total)} total</span>
                  <button onClick={()=>fetchDet(pagina+1)} disabled={pagina>=Math.ceil(det.total/50)}
                    style={{fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',background:T.beigeD,color:T.teal,opacity:pagina>=Math.ceil(det.total/50)?0.35:1,fontFamily:FONT_B}}>Siguiente →</button>
                </div>
              )}
            </Card>
          )}
        </section>

      </main>

      {/* Modal meta */}
      {showMeta&&kpis&&(
        <MetaModal anio={anio} mes={mes} actual={kpis.meta_negocios}
          onClose={()=>setMeta(false)}
          onSaved={n=>{
            setK((prev:any)=>prev?{...prev,meta_negocios:n,
              pct_cumplimiento:n>0?parseFloat(((prev.aprobadas_exitoso+prev.aprobadas_novedades)/n*100).toFixed(1)):0}:prev)
            setMeta(false)
          }}/>
      )}
    </div>
  )
}
