import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../services/api";
import { useSignalR } from "../services/useSignalR";
import { useAuth } from "../services/AuthContext";

// ── Brand tokens — same system as UserDashboard / Login / Register ──
const C = {
  navyPrimary: "#17325A",
  navySecondary: "#27446E",
  orange: "#F28C28",
  orangeDark: "#E57200",
  white: "#FFFFFF",
  offWhite: "#FCFDFF",
  lightGray: "#EAEBEC",
  gray: "#C8CDD6",
  critical: "#D1453B", // reserved only for the highest severity tier
};

// severity 0 → 3 (calm navy → attention orange → critical red)
const SEV_COLOR = { 0: C.navySecondary, 1: C.orange, 2: C.orangeDark, 3: C.critical };
const CLASS_AR  = {
  "BIG TRASH": "نفايات كبيرة", "SMALL TRASH": "نفايات صغيرة",
  "NORMAL ROAD": "طريق سليم", "DAMAGED ROAD": "طريق تالف",
  "NORMAL BUILDINGS": "مباني سليمة", "DAMAGED HOME": "مبنى متضرر",
};

// a report counts as "critical" → triggers notification + gets pinned to the top
const CRITICAL_THRESHOLD = 3;
// how long a just-arrived item stays visually highlighted (ms)
const HIGHLIGHT_MS = 6000;

// Power BI "Publish to Web" embed link (public — no auth/token needed).
// Swap this for a secure org-embed (reportId/embedUrl/accessToken from your
// backend) later on if the report ever contains sensitive data.
const POWERBI_EMBED_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiZDcwODY0MTctOTgxOS00ZjQ4LThkYWUtYTlhOWY2ODE3ZDk5IiwidCI6ImVhZjYyNGM4LWEwYzQtNDE5NS04N2QyLTQ0M2U1ZDc1MTZjZCIsImMiOjh9";


// Always show the most dangerous / most recent reports first
const sortReports = (list) =>
  [...list].sort(
    (a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0) ||
              new Date(b.createdAt) - new Date(a.createdAt)
  );

function StatCard({ icon, label, value, color }) {
  return (
    <div className="rq-stat-card" dir="rtl">
      <div className="rq-stat-top">
        <span className="rq-stat-icon">{icon}</span>
        <div className="rq-stat-dot" style={{ background: color }} />
      </div>
      <p className="rq-stat-value">{value}</p>
      <p className="rq-stat-label">{label}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { logout } = useAuth();
  const [stats, setStats]         = useState(null);
  const [reports, setReports]     = useState([]);
  const [mapPoints, setMapPoints] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [alerts, setAlerts]       = useState([]);
  const [toasts, setToasts]       = useState([]);
  const [highlightIds, setHighlightIds] = useState(() => new Set());
  const [loadError, setLoadError] = useState(null);

  // ── Data load ──
  // Promise.allSettled instead of Promise.all: if one endpoint fails (auth,
  // not deployed yet, etc.) the other two still render instead of leaving
  // the whole page blank.
  const load = useCallback(async () => {
    const [s, r, m] = await Promise.allSettled([
      api.getDashboard(), api.getAllReports(), api.getMapPoints()
    ]);

    if (s.status === "fulfilled") setStats(s.value);
    if (r.status === "fulfilled") setReports(sortReports(r.value));
    if (m.status === "fulfilled") setMapPoints(m.value);

    const failed = [s, r, m].filter((x) => x.status === "rejected");
    if (failed.length) {
      failed.forEach((f) => console.error("AdminDashboard load error:", f.reason));
      setLoadError("تعذر تحميل بعض بيانات الداشبورد. افتح الـ console (F12) لمعرفة السبب.");
    } else {
      setLoadError(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Ask permission once, so we can raise a system notification for critical reports ──
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const pushToast = useCallback((text, severityScore) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, severityScore }]);
    setTimeout(() => dismissToast(id), 6000);
  }, []);

  // ── Live map: a new point arrives ──
  const onMapUpdate = useCallback((p) => {
    const stamped = { ...p, _key: `${Date.now()}-${Math.random()}`, _isNew: true };
    setMapPoints((prev) => [...prev, stamped]);
    setTimeout(() => {
      setMapPoints((prev) => prev.map((pt) => (pt._key === stamped._key ? { ...pt, _isNew: false } : pt)));
    }, HIGHLIGHT_MS);
  }, []);

  // ── Live reports: a new report arrives ──
  const onNewReport = useCallback((p) => {
    setAlerts((prev) => [{ ...p, time: new Date() }, ...prev.slice(0, 9)]);

    const row = {
      id: p.reportId ?? p.id,
      userName: p.userName,
      governorate: p.governorate,
      area: p.area,
      street: p.street,
      latitude: p.latitude,
      longitude: p.longitude,
      predictedClass: p.predictedClass,
      severityScore: p.severityScore,
      severityLabel: p.severityLabel,
      status: p.status ?? "قيد الانتظار",
      createdAt: p.createdAt ?? new Date().toISOString(),
    };

    // merge + always re-sort so higher severity floats to the top of the table
    setReports((prev) => sortReports([row, ...prev.filter((r) => r.id !== row.id)]));

    // flag it for a temporary visual highlight in the table
    setHighlightIds((prev) => new Set(prev).add(row.id));
    setTimeout(() => {
      setHighlightIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }, HIGHLIGHT_MS);

    if ((p.severityScore ?? 0) >= CRITICAL_THRESHOLD) {
      pushToast(` بلاغ حرج جديد من ${p.userName || "مستخدم"} — ${CLASS_AR[p.predictedClass] || p.predictedClass}`, p.severityScore);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("بلاغ بخطورة حرجة", {
          body: `${p.userName || "مستخدم"}: ${CLASS_AR[p.predictedClass] || p.predictedClass}`,
        });
      }
    }

    // refresh aggregate stats (kept in sync with server truth)
    load();
  }, [load, pushToast]);

  useSignalR(() => {}, onMapUpdate, onNewReport);

  // NOTE for backend teammate: the Power BI dashboard embed goes in the
  // "rq-pbi-card" block below (Overview tab). Once you have a backend endpoint
  // that returns { reportId, embedUrl, accessToken, expiration } from the
  // Power BI REST API, swap the placeholder <div> for a <PowerBIEmbed /> from
  // `powerbi-client-react` (npm install powerbi-client powerbi-client-react).

  const tabs = [
    { id: "overview", label: " نظرة عامة" },
    { id: "map",      label: " الخريطة الحية" },
    { id: "reports",  label: " بلاغات المستخدمين" },
  ];

  return (
    <div className="raqib-admin">
      <style>{`
        .raqib-admin {
          --navy-primary: ${C.navyPrimary};
          --navy-secondary: ${C.navySecondary};
          --orange: ${C.orange};
          --orange-dark: ${C.orangeDark};
          --white: ${C.white};
          --off-white: ${C.offWhite};
          --light-gray: ${C.lightGray};
          --gray: ${C.gray};
          --critical: ${C.critical};
          min-height: 100vh;
          background: #0b1c33;
          font-family: Cairo, sans-serif;
          box-sizing: border-box;
        }
        .raqib-admin *, .raqib-admin *::before, .raqib-admin *::after { box-sizing: border-box; }

        /* ── Shared brand pieces ── */
        .logo-mark {
          position: relative; width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
        }
        .logo-ring {
          position: absolute; border-radius: 50%;
          border: 1.4px solid var(--orange);
          opacity: 0;
          animation: logo-pulse 2.6s ease-out infinite;
        }
        .logo-ring.l1 { width: 30px; height: 30px; animation-delay: 0s; }
        .logo-ring.l2 { width: 30px; height: 30px; animation-delay: 1.3s; }
        @keyframes logo-pulse {
          0%   { transform: scale(0.35); opacity: 0.9; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .logo-core { width: 8px; height: 8px; border-radius: 50%; background: var(--orange-dark); z-index: 1; }

        .brand-name {
          font-weight: 800; letter-spacing: 2px; font-size: 20px;
          background: linear-gradient(90deg, var(--off-white) 0%, var(--off-white) 40%, var(--orange) 50%, var(--off-white) 60%, var(--off-white) 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: name-sheen 6s ease-in-out infinite;
        }
        @keyframes name-sheen {
          0%   { background-position: 200% 0; }
          65%  { background-position: -20% 0; }
          100% { background-position: -20% 0; }
        }

        .rq-card {
          background: rgba(39, 68, 110, 0.28);
          border: 1px solid rgba(200, 205, 214, 0.15);
          border-radius: 16px;
        }

        .rq-btn-ghost {
          border: 1px solid rgba(242,140,40,0.35);
          border-radius: 10px; color: var(--orange);
          background: rgba(242,140,40,0.08);
          transition: background 0.15s ease;
          cursor: pointer; font-family: inherit; padding: 8px 16px; font-size: 13px;
        }
        .rq-btn-ghost:hover { background: rgba(242,140,40,0.16); }

        .rq-btn-logout {
          font-size: 13px; padding: 6px 12px; border-radius: 8px;
          background: rgba(200,205,214,0.1); color: var(--gray);
          border: none; cursor: pointer; transition: opacity 0.15s ease; font-family: inherit;
        }
        .rq-btn-logout:hover { opacity: 0.8; }

        /* ── Navbar ── */
        .rq-navbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 24px; border-bottom: 1px solid rgba(200,205,214,0.15);
          background: #0d1f35;
        }
        .rq-navbar-left { display: flex; align-items: center; gap: 12px; }
        .rq-navbar-right { display: flex; align-items: center; gap: 16px; }

        .rq-bell-wrap { position: relative; cursor: pointer; }
        .rq-bell-icon { font-size: 20px; }
        .rq-bell-badge {
          position: absolute; top: -4px; right: -6px; width: 16px; height: 16px; border-radius: 50%;
          font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
          background: var(--critical); color: white;
        }

        /* ── Toasts ── */
        .rq-toast-stack {
          position: fixed; top: 20px; left: 20px; z-index: 3000;
          display: flex; flex-direction: column; gap: 10px; max-width: 340px;
        }
        .rq-toast {
          border-radius: 12px; padding: 12px 14px; font-size: 13px; color: var(--off-white);
          background: rgba(13,31,53,0.95); border: 1px solid rgba(209,69,59,0.5);
          box-shadow: 0 10px 24px rgba(0,0,0,0.35);
          display: flex; align-items: flex-start; gap: 10px;
          animation: rq-toast-in 0.25s ease-out both;
        }
        @keyframes rq-toast-in {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .rq-toast-text { flex: 1; line-height: 1.5; }
        .rq-toast-close {
          background: none; border: none; color: var(--gray); cursor: pointer; font-size: 13px; line-height: 1;
        }
        .rq-toast-close:hover { color: var(--off-white); }

        /* ── Content shell ── */
        .rq-content { max-width: 1280px; margin: 0 auto; padding: 24px; }

        .rq-tabs { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid rgba(200,205,214,0.15); }
        .rq-tab {
          padding: 10px 20px; font-size: 14px; font-weight: 500; background: none; cursor: pointer;
          border: none; border-bottom: 2px solid transparent; color: var(--gray); transition: all 0.15s ease;
          font-family: inherit;
        }
        .rq-tab.active { color: var(--orange); border-bottom-color: var(--orange); }

        .rq-section { display: flex; flex-direction: column; gap: 24px; }

        .rq-error-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 12px 16px; border-radius: 12px; margin-bottom: 20px; font-size: 13px;
          background: rgba(209,69,59,0.12); border: 1px solid rgba(209,69,59,0.35); color: var(--off-white);
        }
        .rq-loading-text { color: var(--gray); font-size: 14px; }

        /* ── Stat cards ── */
        .rq-stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media (min-width: 1024px) { .rq-stat-grid { grid-template-columns: repeat(4, 1fr); } }
        .rq-stat-card { border-radius: 16px; padding: 20px; background: rgba(39,68,110,0.28); border: 1px solid rgba(200,205,214,0.15); }
        .rq-stat-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .rq-stat-icon { font-size: 24px; }
        .rq-stat-dot { width: 8px; height: 8px; border-radius: 50%; animation: rq-pulse 2s ease-in-out infinite; }
        @keyframes rq-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .rq-stat-value { font-size: 30px; font-weight: 800; color: var(--white); margin: 0 0 4px; }
        .rq-stat-label { font-size: 13px; color: var(--gray); margin: 0; }

        /* ── Power BI embed ── */
        .rq-pbi-card { border-radius: 16px; overflow: hidden; background: rgba(39,68,110,0.28); border: 1px solid rgba(200,205,214,0.15); }
        .rq-pbi-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; }
        .rq-pbi-title { font-weight: 700; color: var(--white); margin: 0; }
        .rq-pbi-badge {
          font-size: 11px; padding: 4px 10px; border-radius: 999px; color: var(--orange);
          background: rgba(242,140,40,0.1); border: 1px solid rgba(242,140,40,0.3);
        }
        .rq-pbi-frame {
          position: relative; min-height: 480px;
          border-top: 1px dashed rgba(200,205,214,0.15);
        }
        .rq-pbi-iframe { width: 100%; height: 480px; border: none; display: block; }

        /* ── Live alerts ── */
        .rq-alerts-card { border-radius: 16px; padding: 20px; background: rgba(39,68,110,0.28); border: 1px solid rgba(209,69,59,0.3); }
        .rq-alerts-title { font-weight: 700; margin: 0 0 12px; color: var(--critical); }
        .rq-alert-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(200,205,214,0.12); }
        .rq-alert-row:last-child { border-bottom: none; }
        .rq-alert-dot { font-size: 14px; }
        .rq-alert-class { font-size: 14px; color: var(--white); }
        .rq-alert-time { font-size: 12px; margin-right: auto; color: var(--gray); }

        /* ── Map ── */
        .rq-map-card { border-radius: 16px; overflow: hidden; height: 65vh; position: relative; }
        .rq-map-legend {
          position: absolute; bottom: 20px; right: 20px; z-index: 1000; border-radius: 12px; padding: 14px 16px;
          background: rgba(13,31,53,0.88); border: 1px solid rgba(200,205,214,0.15); backdrop-filter: blur(8px);
        }
        .rq-map-legend-title { font-size: 12px; font-weight: 700; color: var(--gray); margin: 0 0 8px; }
        .rq-map-legend-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .rq-map-legend-row:last-child { margin-bottom: 0; }
        .rq-map-legend-dot { width: 11px; height: 11px; border-radius: 50%; }
        .rq-map-legend-label { font-size: 12px; color: var(--gray); }
        .rq-popup-title { font-weight: 700; margin: 0; }
        .rq-popup-line { margin: 2px 0 0; }

        /* leaflet marker pulse for freshly-arrived reports */
        .rq-marker-pulse { animation: rq-marker-pulse 1.1s ease-in-out infinite; }
        @keyframes rq-marker-pulse {
          0%, 100% { stroke-width: 2; opacity: 0.9; }
          50%      { stroke-width: 5; opacity: 1; }
        }

        /* ── Reports table ── */
        .rq-table-card { border-radius: 16px; overflow: hidden; border: 1px solid rgba(200,205,214,0.15); }
        .rq-table { width: 100%; font-size: 14px; border-collapse: collapse; }
        .rq-table thead tr { background: rgba(13,31,53,0.9); border-bottom: 1px solid rgba(200,205,214,0.15); }
        .rq-table th { padding: 12px 16px; text-align: right; font-weight: 500; color: var(--gray); }
        .rq-table td { padding: 12px 16px; border-bottom: 1px solid rgba(15,32,50,0.7); }
        .rq-table tr.odd { background: rgba(8,14,28,0.4); }
        .rq-table tr.even { background: transparent; }
        .rq-table tr.rq-row-critical {
          background: rgba(209,69,59,0.16) !important;
          animation: rq-row-flash 1.4s ease-in-out 3;
        }
        @keyframes rq-row-flash {
          0%, 100% { background-color: rgba(209,69,59,0.16); }
          50%      { background-color: rgba(209,69,59,0.32); }
        }
        .rq-td-id { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: rgba(200,205,214,0.5); }
        .rq-td-user { color: var(--white); }
        .rq-td-class { color: var(--gray); }
        .rq-pill { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
        .rq-pill-severity { font-weight: 700; }
        .rq-pill-status { background: rgba(200,205,214,0.14); color: var(--gray); }
        .rq-td-date { font-size: 12px; color: rgba(200,205,214,0.5); }

        @media (prefers-reduced-motion: reduce) {
          .brand-name, .rq-stat-dot, .rq-marker-pulse, .rq-toast, .rq-row-critical { animation: none !important; }
        }
      `}</style>

      {/* ── Toasts ── */}
      {toasts.length > 0 && (
        <div className="rq-toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className="rq-toast" dir="rtl">
              <span className="rq-toast-text">{t.text}</span>
              <button className="rq-toast-close" onClick={() => dismissToast(t.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Navbar ── */}
      <nav className="rq-navbar">
        <div className="rq-navbar-left">
          <div className="logo-mark">
            <span className="logo-ring l1" />
            <span className="logo-ring l2" />
            <span className="logo-core" />
          </div>
          <span className="brand-name">RAQIB Admin</span>
        </div>
        <div className="rq-navbar-right" dir="rtl">
          {alerts.length > 0 && (
            <div className="rq-bell-wrap" onClick={() => setActiveTab("reports")}>
              <span className="rq-bell-icon">🔔</span>
              <span className="rq-bell-badge">{alerts.length}</span>
            </div>
          )}
          <button onClick={logout} className="rq-btn-logout">خروج</button>
        </div>
      </nav>

      <div className="rq-content">
        {/* Tabs */}
        <div className="rq-tabs" dir="rtl">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`rq-tab ${activeTab === t.id ? "active" : ""}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="rq-error-banner" dir="rtl">
            <span> {loadError}</span>
            <button className="rq-btn-ghost" onClick={load}>إعادة المحاولة</button>
          </div>
        )}

        {/* ── Overview: KPIs + Power BI dashboard + live alerts ── */}
        {activeTab === "overview" && (
          <div className="rq-section" dir="rtl">
            {stats ? (
              <div className="rq-stat-grid">
                <StatCard label="إجمالي البلاغات"    value={stats.totalReports}       color={C.navySecondary} />
                <StatCard label="قيد الانتظار"        value={stats.pendingReports}      color={C.orange} />
                <StatCard label="تم الحل"             value={stats.resolvedReports}     color={C.orangeDark} />
                <StatCard  label="خطورة عالية"         value={stats.highSeverityReports} color={C.critical} />
              </div>
            ) : (
              !loadError && <p className="rq-loading-text">جارٍ تحميل الإحصائيات...</p>
            )}

            <div className="rq-pbi-card">
              <div className="rq-pbi-header">
                <h3 className="rq-pbi-title">لوحة Power BI</h3>
                <span className="rq-pbi-badge">تحديث تلقائي</span>
              </div>
              <div className="rq-pbi-frame">
                <iframe
                  title="raqib-powerbi-overview"
                  className="rq-pbi-iframe"
                  src={POWERBI_EMBED_URL}
                  allowFullScreen
                />
              </div>
            </div>

            {alerts.length > 0 && (
              <div className="rq-alerts-card">
                <h3 className="rq-alerts-title"> تنبيهات حية</h3>
                <div>
                  {alerts.slice(0, 5).map((a, i) => (
                    <div key={i} className="rq-alert-row">
                      <span className="rq-alert-dot" style={{ color: SEV_COLOR[a.severityScore] }}>●</span>
                      <span className="rq-alert-class">{CLASS_AR[a.predictedClass] || a.predictedClass}</span>
                      <span className="rq-alert-time">{a.time?.toLocaleTimeString("ar-EG")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Live map ── */}
        {activeTab === "map" && (
          <div className="rq-map-card">
            <MapContainer center={[26.8, 30.8]} zoom={6} style={{ height: "100%", width: "100%" }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CARTO" />
              {mapPoints.map((p, i) => (
                <CircleMarker
                  key={p._key || i}
                  center={[p.latitude, p.longitude]}
                  radius={10 + (p.countInArea || 0) * 4}
                  pathOptions={{
                    color: SEV_COLOR[p.severityScore],
                    fillColor: SEV_COLOR[p.severityScore],
                    fillOpacity: 0.35,
                    weight: 2,
                    className: p._isNew ? "rq-marker-pulse" : "",
                  }}
                >
                  <Popup>
                    <div dir="rtl">
                      <p className="rq-popup-title">{CLASS_AR[p.predictedClass] || p.predictedClass}</p>
                      <p className="rq-popup-line">الخطورة: <span style={{ color: SEV_COLOR[p.severityScore] }}>{p.severityLabel}</span></p>
                      <p className="rq-popup-line">عدد البلاغات: {p.countInArea}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>

            <div className="rq-map-legend" dir="rtl">
              <p className="rq-map-legend-title">مستوى الخطورة</p>
              {[
                { label: "منعدمة", color: SEV_COLOR[0] },
                { label: "منخفضة", color: SEV_COLOR[1] },
                { label: "متوسطة", color: SEV_COLOR[2] },
                { label: "حرجة",   color: SEV_COLOR[3] },
              ].map((l) => (
                <div key={l.label} className="rq-map-legend-row">
                  <div className="rq-map-legend-dot" style={{ background: l.color }} />
                  <span className="rq-map-legend-label">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Reports table ── */}
        {activeTab === "reports" && (
          <div className="rq-table-card" dir="rtl">
            <table className="rq-table">
              <thead>
                <tr>
                  {["المعرف", "المحافظة", "المنطقة", "الشارع", "المشكلة", "خط العرض", "خط الطول", "تاريخ البلاغ", "الخطورة","درجه الضرر","الشدة"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`${i % 2 ? "odd" : "even"} ${highlightIds.has(r.id) ? "rq-row-critical" : ""}`}
                  >
                    <td className="rq-td-id">#{r.id}</td>
                    <td className="rq-td-user">{r.governorate || "—"}</td>
                    <td className="rq-td-class">{r.area || "—"}</td>
                    <td className="rq-td-class">{r.street || "—"}</td>
                    <td className="rq-td-class">{CLASS_AR[r.predictedClass] || r.predictedClass || "—"}</td>
                    <td className="rq-td-date">{r.latitude != null ? r.latitude.toFixed(5) : "—"}</td>
                    <td className="rq-td-date">{r.longitude != null ? r.longitude.toFixed(5) : "—"}</td>
                    <td className="rq-td-date">{new Date(r.createdAt).toLocaleDateString("ar-EG")}</td>
                    <td>
                      <span className="rq-pill rq-pill-severity"
                            style={{ background: `${SEV_COLOR[r.severityScore]}22`, color: SEV_COLOR[r.severityScore] }}>
                        {r.severityLabel || "—"}
                      </span>
                    </td>
                    <td><span className="rq-pill rq-pill-status">{r.status}</span></td>
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