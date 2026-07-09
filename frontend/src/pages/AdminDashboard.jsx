import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../services/api";
import { useSignalR } from "../services/useSignalR";
import { useAuth } from "../services/AuthContext";

const C={navySecondary:"#27446E",orange:"#F28C28",orangeDark:"#E57200",white:"#FFFFFF",offWhite:"#FCFDFF",gray:"#C8CDD6",critical:"#D1453B"};
const SEV_COLOR={0:C.navySecondary,1:C.orange,2:C.orangeDark,3:C.critical};
const CLASS_AR={"Damaged Road":"طريق تالف","Normal Road":"طريق سليم","Damaged Home":"مبنى متضرر","Normal Building":"مباني سليمة","Big Trash":"نفايات كبيرة","Small Trash":"نفايات صغيرة","BIG TRASH":"نفايات كبيرة","SMALL TRASH":"نفايات صغيرة","NORMAL ROAD":"طريق سليم","DAMAGED ROAD":"طريق تالف","NORMAL BUILDINGS":"مباني سليمة","DAMAGED HOME":"مبنى متضرر"};

// Zone colors per problem type
const ZONE_COLOR=(cls)=>{
  if(!cls)return C.navySecondary;
  const lc=cls.toLowerCase();
  if(lc.includes("trash"))return"#ef4444";       // Red — Trash
  if(lc.includes("road"))return"#3b82f6";        // Blue — Roads
  if(lc.includes("home")||lc.includes("building"))return"#22c55e"; // Green — Buildings
  return C.orange;
};

const POWERBI_URL="https://app.powerbi.com/view?r=eyJrIjoiZDcwODY0MTctOTgxOS00ZjQ4LThkYWUtYTlhOWY2ODE3ZDk5IiwidCI6ImVhZjYyNGM4LWEwYzQtNDE5NS04N2QyLTQ0M2U1ZDc1MTZjZCIsImMiOjh9";

const sortReports=(l)=>[...l].sort((a,b)=>(b.severityScore??0)-(a.severityScore??0)||new Date(b.createdAt)-new Date(a.createdAt));

function StatCard({icon,label,value,color}){
  return(
    <div style={{borderRadius:16,padding:20,background:"rgba(39,68,110,.28)",border:"1px solid rgba(200,205,214,.15)"}} dir="rtl">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:24}}>{icon}</span>
        <div style={{width:8,height:8,borderRadius:"50%",background:color,animation:"rqp 2s ease-in-out infinite"}}/>
      </div>
      <p style={{fontSize:30,fontWeight:800,color:C.white,margin:"0 0 4px"}}>{value}</p>
      <p style={{fontSize:13,color:C.gray,margin:0}}>{label}</p>
    </div>
  );
}

export default function AdminDashboard(){
  const{logout}=useAuth();
  const[stats,setStats]=useState(null);
  const[reports,setReports]=useState([]);
  const[mapPoints,setMapPoints]=useState([]);
  const[activeTab,setActiveTab]=useState("overview");
  const[alerts,setAlerts]=useState([]);
  const[toasts,setToasts]=useState([]);
  const[highlightIds,setHighlightIds]=useState(()=>new Set());
  const[loadError,setLoadError]=useState(null);
  const HIGHLIGHT_MS=6000;

  const load=useCallback(async()=>{
    const[s,r,m]=await Promise.allSettled([api.getDashboard(),api.getAllReports(),api.getMapPoints()]);
    if(s.status==="fulfilled")setStats(s.value);
    if(r.status==="fulfilled")setReports(sortReports(r.value));
    if(m.status==="fulfilled")setMapPoints(m.value);
    const failed=[s,r,m].filter(x=>x.status==="rejected");
    if(failed.length){setLoadError("تعذر تحميل بعض البيانات.");}else{setLoadError(null);}
  },[]);

  useEffect(()=>{load();},[load]);

  const dismissToast=(id)=>setToasts(p=>p.filter(t=>t.id!==id));
  const pushToast=useCallback((text)=>{
    const id=`${Date.now()}-${Math.random()}`;
    setToasts(p=>[...p,{id,text}]);setTimeout(()=>dismissToast(id),6000);
  },[]);

  const onMapUpdate=useCallback((p)=>{
    const stamped={...p,_key:`${Date.now()}-${Math.random()}`,_isNew:true};
    setMapPoints(prev=>[...prev,stamped]);
    setTimeout(()=>setMapPoints(prev=>prev.map(pt=>pt._key===stamped._key?{...pt,_isNew:false}:pt)),HIGHLIGHT_MS);
  },[]);

  const onNewReport=useCallback((p)=>{
    setAlerts(prev=>[{...p,time:new Date()},...prev.slice(0,9)]);
    const row={id:p.reportId??p.id,userName:p.userName,governorate:p.governorate,area:p.area,street:p.street,latitude:p.latitude,longitude:p.longitude,predictedClass:p.predictedClass,severityScore:p.severityScore,severityLabel:p.severityLabel,status:p.status??"Pending",createdAt:p.createdAt??new Date().toISOString()};
    setReports(prev=>sortReports([row,...prev.filter(r=>r.id!==row.id)]));
    setHighlightIds(prev=>{const n=new Set(prev);n.add(row.id);return n;});
    setTimeout(()=>setHighlightIds(prev=>{const n=new Set(prev);n.delete(row.id);return n;}),HIGHLIGHT_MS);
    if((p.severityScore??0)>=3)pushToast(`🚨 بلاغ حرج: ${CLASS_AR[p.predictedClass]||p.predictedClass} — ${p.userName||"مستخدم"}`);
    load();
  },[load,pushToast]);

  useSignalR(()=>{},onMapUpdate,onNewReport);

  const tabs=[{id:"overview",label:"📊 نظرة عامة"},{id:"map",label:"🗺️ الخريطة"},{id:"reports",label:"📋 البلاغات"}];

  return(
    <div className="raqib-admin">
      <style>{`
        .raqib-admin{--o:#F28C28;--od:#E57200;--gray:#C8CDD6;--off:#FCFDFF;--red:#D1453B;
          min-height:100vh;background:#0b1c33;font-family:Cairo,sans-serif;box-sizing:border-box}
        .raqib-admin *{box-sizing:border-box}
        @keyframes rqp{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes lp{0%{transform:scale(.35);opacity:.9}100%{transform:scale(1.8);opacity:0}}
        @keyframes sheen{0%{background-position:200% 0}65%,100%{background-position:-20% 0}}
        @keyframes toast-in{0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:none}}
        .logo-mark{position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center}
        .logo-ring{position:absolute;border-radius:50%;border:1.4px solid var(--o);opacity:0;animation:lp 2.6s ease-out infinite}
        .logo-ring.l1{width:30px;height:30px}.logo-ring.l2{width:30px;height:30px;animation-delay:1.3s}
        .logo-core{width:8px;height:8px;border-radius:50%;background:var(--od);z-index:1}
        .brand-name{font-weight:800;letter-spacing:2px;font-size:20px;background:linear-gradient(90deg,var(--off) 0%,var(--off) 40%,var(--o) 50%,var(--off) 60%,var(--off) 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:sheen 6s ease-in-out infinite}
        .rq-nav{display:flex;align-items:center;justify-content:space-between;padding:12px 24px;border-bottom:1px solid rgba(200,205,214,.15);background:#0d1f35}
        .rq-nav-l,.rq-nav-r{display:flex;align-items:center;gap:12px}
        .rq-btn-out{font-size:13px;padding:6px 12px;border-radius:8px;background:rgba(200,205,214,.1);color:var(--gray);border:none;cursor:pointer;font-family:inherit}
        .rq-toast-stack{position:fixed;top:20px;left:20px;z-index:3000;display:flex;flex-direction:column;gap:10px;max-width:340px}
        .rq-toast{border-radius:12px;padding:12px 14px;font-size:13px;color:var(--off);background:rgba(13,31,53,.95);border:1px solid rgba(209,69,59,.5);box-shadow:0 10px 24px rgba(0,0,0,.35);display:flex;align-items:flex-start;gap:10px;animation:toast-in .25s ease-out both}
        .rq-toast-close{background:none;border:none;color:var(--gray);cursor:pointer;font-size:13px}
        .rq-content{max-width:1280px;margin:0 auto;padding:24px}
        .rq-tabs{display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid rgba(200,205,214,.15)}
        .rq-tab{padding:10px 20px;font-size:14px;font-weight:500;background:none;cursor:pointer;border:none;border-bottom:2px solid transparent;color:var(--gray);transition:all .15s;font-family:inherit}
        .rq-tab.on{color:var(--o);border-bottom-color:var(--o)}
        .rq-stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
        @media(min-width:1024px){.rq-stat-grid{grid-template-columns:repeat(4,1fr)}}
        .rq-pbi-card{border-radius:16px;overflow:hidden;background:rgba(39,68,110,.28);border:1px solid rgba(200,205,214,.15)}
        .rq-pbi-hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 20px}
        .rq-pbi-title{font-weight:700;color:#fff;margin:0}
        .rq-pbi-badge{font-size:11px;padding:4px 10px;border-radius:999px;color:var(--o);background:rgba(242,140,40,.1);border:1px solid rgba(242,140,40,.3)}
        .rq-pbi-frame{border-top:1px dashed rgba(200,205,214,.15)}
        .rq-section{display:flex;flex-direction:column;gap:24px}
        .rq-err-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:13px;background:rgba(209,69,59,.12);border:1px solid rgba(209,69,59,.35);color:var(--off)}
        .rq-ghost{border:1px solid rgba(242,140,40,.35);border-radius:10px;color:var(--o);background:rgba(242,140,40,.08);transition:background .15s;cursor:pointer;font-family:inherit;padding:8px 16px;font-size:13px}
        .rq-alerts-card{border-radius:16px;padding:20px;background:rgba(39,68,110,.28);border:1px solid rgba(209,69,59,.3)}
        .rq-alert-row{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(200,205,214,.12)}
        .rq-alert-row:last-child{border-bottom:none}
        .rq-map-card{border-radius:16px;overflow:hidden;height:65vh;position:relative}
        .rq-map-legend{position:absolute;bottom:20px;right:20px;z-index:1000;border-radius:12px;padding:14px 16px;background:rgba(13,31,53,.88);border:1px solid rgba(200,205,214,.15);backdrop-filter:blur(8px)}
        .rq-map-leg-title{font-size:12px;font-weight:700;color:var(--gray);margin:0 0 8px}
        .rq-map-leg-row{display:flex;align-items:center;gap:8px;margin-bottom:4px}
        .rq-map-leg-dot{width:11px;height:11px;border-radius:50%}.rq-map-leg-label{font-size:12px;color:var(--gray)}
        .rq-table-card{border-radius:16px;overflow:hidden;border:1px solid rgba(200,205,214,.15)}
        .rq-table{width:100%;font-size:13px;border-collapse:collapse}
        .rq-table thead tr{background:rgba(13,31,53,.9);border-bottom:1px solid rgba(200,205,214,.15)}
        .rq-table th{padding:12px 14px;text-align:right;font-weight:500;color:var(--gray)}
        .rq-table td{padding:11px 14px;border-bottom:1px solid rgba(15,32,50,.7)}
        .rq-table tr.odd{background:rgba(8,14,28,.4)}.rq-table tr.even{background:transparent}
        .rq-table tr.hi{background:rgba(209,69,59,.16)!important;animation:flash 1.4s ease-in-out 3}
        @keyframes flash{0%,100%{background-color:rgba(209,69,59,.16)}50%{background-color:rgba(209,69,59,.32)}}
        .rq-pill{padding:2px 10px;border-radius:999px;font-size:12px}
        .rq-pill-sev{font-weight:700}.rq-pill-status{background:rgba(200,205,214,.14);color:var(--gray)}
        .rq-td-id{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(200,205,214,.5)}
        .rq-gov-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        @media(min-width:1024px){.rq-gov-stats{grid-template-columns:repeat(4,1fr)}}
        .rq-gov-card{border-radius:12px;padding:14px;background:rgba(39,68,110,.28);border:1px solid rgba(200,205,214,.15)}
        .rq-gov-name{font-size:13px;font-weight:700;color:#fff;margin:0 0 4px}
        .rq-gov-count{font-size:22px;font-weight:800;color:var(--o);margin:0}
        .leaflet-popup-content-wrapper{background:#0d1f35!important;border:1px solid #1e3a5f!important;color:#e2e8f0!important;border-radius:12px!important}
        .leaflet-popup-tip{background:#0d1f35!important}
      `}</style>

      {/* Toasts */}
      {toasts.length>0&&(
        <div className="rq-toast-stack">
          {toasts.map(t=>(
            <div key={t.id} className="rq-toast" dir="rtl">
              <span style={{flex:1,lineHeight:1.5}}>{t.text}</span>
              <button className="rq-toast-close" onClick={()=>dismissToast(t.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <nav className="rq-nav">
        <div className="rq-nav-l">
          <div className="logo-mark"><span className="logo-ring l1"/><span className="logo-ring l2"/><span className="logo-core"/></div>
          <span className="brand-name">RAQIB Admin</span>
        </div>
        <div className="rq-nav-r" dir="rtl">
          {alerts.length>0&&(
            <div style={{position:"relative",cursor:"pointer"}} onClick={()=>setActiveTab("reports")}>
              <span style={{fontSize:20}}>🔔</span>
              <span style={{position:"absolute",top:-4,right:-6,width:16,height:16,borderRadius:"50%",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",background:C.critical,color:"white"}}>{alerts.length}</span>
            </div>
          )}
          <button onClick={logout} className="rq-btn-out">خروج</button>
        </div>
      </nav>

      <div className="rq-content">
        <div className="rq-tabs" dir="rtl">
          {tabs.map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} className={`rq-tab ${activeTab===t.id?"on":""}`}>{t.label}</button>)}
        </div>

        {loadError&&(
          <div className="rq-err-banner" dir="rtl">
            <span>{loadError}</span>
            <button className="rq-ghost" onClick={load}>إعادة المحاولة</button>
          </div>
        )}

        {/* ── Overview ── */}
        {activeTab==="overview"&&(
          <div className="rq-section" dir="rtl">
            {stats?(
              <>
                <div className="rq-stat-grid">
                  <StatCard icon="📊" label="إجمالي البلاغات" value={stats.totalReports} color={C.navySecondary}/>
                  <StatCard icon="⏳" label="قيد الانتظار" value={stats.pendingReports} color={C.orange}/>
                  <StatCard icon="✅" label="تم الحل" value={stats.resolvedReports} color={C.orangeDark}/>
                  <StatCard icon="🔴" label="خطورة عالية" value={stats.highSeverityReports} color={C.critical}/>
                </div>

                {/* Governorate stats */}
                {stats.countByGovernorate&&Object.keys(stats.countByGovernorate).length>0&&(
                  <div>
                    <h3 style={{color:"#fff",margin:"0 0 12px",fontSize:16}}>البلاغات لكل محافظة</h3>
                    <div className="rq-gov-stats">
                      {Object.entries(stats.countByGovernorate).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([gov,cnt])=>(
                        <div key={gov} className="rq-gov-card">
                          <p className="rq-gov-name">{gov}</p>
                          <p className="rq-gov-count">{cnt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ):(!loadError&&<p style={{color:C.gray,fontSize:14}}>جارٍ تحميل الإحصائيات...</p>)}

            {/* Power BI */}
            <div className="rq-pbi-card">
              <div className="rq-pbi-hdr">
                <h3 className="rq-pbi-title">لوحة Power BI</h3>
                <span className="rq-pbi-badge">تحديث تلقائي</span>
              </div>
              <div className="rq-pbi-frame">
                <iframe title="raqib-powerbi" style={{width:"100%",height:480,border:"none",display:"block"}} src={POWERBI_URL} allowFullScreen/>
              </div>
            </div>

            {/* Live alerts */}
            {alerts.length>0&&(
              <div className="rq-alerts-card">
                <h3 style={{fontWeight:700,margin:"0 0 12px",color:C.critical}}>🚨 تنبيهات حية</h3>
                {alerts.slice(0,5).map((a,i)=>(
                  <div key={i} className="rq-alert-row">
                    <span style={{color:SEV_COLOR[a.severityScore],fontSize:14}}>●</span>
                    <span style={{fontSize:14,color:"#fff"}}>{CLASS_AR[a.predictedClass]||a.predictedClass}</span>
                    {a.governorate&&<span style={{fontSize:12,color:C.orange}}>📍 {a.governorate}</span>}
                    <span style={{fontSize:12,marginRight:"auto",color:C.gray}}>{a.time?.toLocaleTimeString("ar-EG")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Map with zones ── */}
        {activeTab==="map"&&(
          <div className="rq-map-card">
            <MapContainer center={[26.8,30.8]} zoom={6} style={{height:"100%",width:"100%"}}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CARTO"/>
              {mapPoints.map((p,i)=>{
                const zoneColor=ZONE_COLOR(p.predictedClass);
                return(
                  <CircleMarker key={p._key||i} center={[p.latitude,p.longitude]}
                                radius={12+(p.countInArea||0)*4}
                                pathOptions={{color:zoneColor,fillColor:zoneColor,fillOpacity:.35,weight:p._isNew?4:2}}>
                    <Popup>
                      <div dir="rtl">
                        <p style={{fontWeight:700,margin:0}}>{CLASS_AR[p.predictedClass]||p.predictedClass}</p>
                        <p style={{margin:"2px 0 0"}}>الخطورة: <span style={{color:SEV_COLOR[p.severityScore]}}>{p.severityLabel}</span></p>
                        {p.governorate&&<p style={{margin:"2px 0 0"}}>المحافظة: {p.governorate}</p>}
                        {p.area&&<p style={{margin:"2px 0 0"}}>المنطقة: {p.area}</p>}
                        <p style={{margin:"2px 0 0"}}>عدد البلاغات: {p.countInArea}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
            <div className="rq-map-legend" dir="rtl">
              <p className="rq-map-leg-title">نوع المشكلة</p>
              {[{l:"نفايات (Red Zone)",c:"#ef4444"},{l:"طرق (Blue Zone)",c:"#3b82f6"},{l:"مباني (Green Zone)",c:"#22c55e"}].map(x=>(
                <div key={x.l} className="rq-map-leg-row">
                  <div className="rq-map-leg-dot" style={{background:x.c}}/><span className="rq-map-leg-label">{x.l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Reports table ── */}
        {activeTab==="reports"&&(
          <div className="rq-table-card" dir="rtl">
            <table className="rq-table">
              <thead>
                <tr>
                  {["#","اليوزر","المحافظة","المنطقة","الشارع","المشكلة","نسبة الضرر","الخطورة","الحالة","التاريخ"].map(h=>(
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r,i)=>(
                  <tr key={r.id} className={`${i%2?"odd":"even"} ${highlightIds.has(r.id)?"hi":""}`}>
                    <td className="rq-td-id">#{r.id}</td>
                    <td style={{color:"#fff"}}>{r.userName||"—"}</td>
                    <td style={{color:C.gray}}>{r.governorate||"—"}</td>
                    <td style={{color:C.gray}}>{r.area||"—"}</td>
                    <td style={{color:C.gray}}>{r.street||"—"}</td>
                    <td style={{color:C.gray}}>{CLASS_AR[r.predictedClass]||r.predictedClass||"—"}</td>
                    <td style={{color:C.gray}}>{r.damagePercentage!=null?`${r.damagePercentage.toFixed(1)}%`:"—"}</td>
                    <td>
                      <span className="rq-pill rq-pill-sev" style={{background:`${SEV_COLOR[r.severityScore]}22`,color:SEV_COLOR[r.severityScore]}}>
                        {r.severityLabel||"—"}
                      </span>
                    </td>
                    <td><span className="rq-pill rq-pill-status">{r.status}</span></td>
                    <td style={{fontSize:12,color:"rgba(200,205,214,.5)"}}>{new Date(r.createdAt).toLocaleDateString("ar-EG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}