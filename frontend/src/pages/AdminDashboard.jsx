import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import "leaflet/dist/leaflet.css";
import { api } from "../services/api";
import { useSignalR } from "../services/useSignalR";
import { useAuth } from "../services/AuthContext";

const SEV_COLOR = { 0: "#22d3ee", 1: "#f59e0b", 2: "#f97316", 3: "#ef4444" };
const CLASS_AR  = {
  "BIG TRASH": "نفايات كبيرة", "SMALL TRASH": "نفايات صغيرة",
  "NORMAL ROAD": "طريق سليم", "DAMAGED ROAD": "طريق تالف",
  "NORMAL BUILDINGS": "مباني سليمة", "DAMAGED HOME": "مبنى متضرر",
};
const PIE_COLORS = ["#22d3ee","#10b981","#f59e0b","#f97316","#ef4444","#8b5cf6"];

function StatCard({ icon, label, value, color }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "#0d1f35", border: "1px solid #1e3a5f" }} dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm" style={{ color: "#64748b" }}>{label}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { logout } = useAuth();
  const [stats, setStats]       = useState(null);
  const [reports, setReports]   = useState([]);
  const [mapPoints, setMapPoints] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [alerts, setAlerts]     = useState([]);

  const load = useCallback(async () => {
    const [s, r, m] = await Promise.all([
      api.getDashboard(), api.getAllReports(), api.getMapPoints()
    ]);
    setStats(s); setReports(r); setMapPoints(m);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onMapUpdate = useCallback((p) => setMapPoints(prev => [...prev, p]), []);
  const onNewReport = useCallback((p) => {
    setAlerts(prev => [{ ...p, time: new Date() }, ...prev.slice(0, 9)]);
    load();
  }, [load]);

  useSignalR(() => {}, onMapUpdate, onNewReport);

  const byClassData = stats ? Object.entries(stats.countByClass).map(([k, v]) => ({
    name: CLASS_AR[k] || k, value: v
  })) : [];

  const byDayData = stats ? Object.entries(stats.countByDay).map(([k, v]) => ({
    date: k.slice(5), count: v
  })) : [];

  const tabs = [
    { id: "overview", label: "📊 نظرة عامة" },
    { id: "map",      label: "🗺️ الخريطة" },
    { id: "reports",  label: "📋 البلاغات" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#070d1a", fontFamily: "Cairo, sans-serif" }}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-3 border-b"
           style={{ background: "#0d1f35", borderColor: "#1e3a5f" }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌿</span>
          <span className="font-bold text-xl"
                style={{ background: "linear-gradient(135deg,#22d3ee,#10b981)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            RAQIB Admin
          </span>
        </div>
        <div className="flex items-center gap-4" dir="rtl">
          {alerts.length > 0 && (
            <div className="relative">
              <span className="text-xl cursor-pointer">🔔</span>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                    style={{ background: "#ef4444", color: "white" }}>
                {alerts.length}
              </span>
            </div>
          )}
          <button onClick={logout}
                  className="text-sm px-3 py-1.5 rounded-lg"
                  style={{ background: "#1e3a5f", color: "#94a3b8" }}>
            خروج
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: "#1e3a5f" }} dir="rtl">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className="px-5 py-2.5 text-sm font-medium transition-all"
                    style={{
                      color: activeTab === t.id ? "#22d3ee" : "#64748b",
                      borderBottom: activeTab === t.id ? "2px solid #22d3ee" : "2px solid transparent",
                      background: "transparent"
                    }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && stats && (
          <div className="space-y-6" dir="rtl">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon="📊" label="إجمالي البلاغات"    value={stats.totalReports}       color="#22d3ee" />
              <StatCard icon="⏳" label="قيد الانتظار"        value={stats.pendingReports}      color="#f59e0b" />
              <StatCard icon="✅" label="تم الحل"             value={stats.resolvedReports}     color="#10b981" />
              <StatCard icon="🔴" label="خطورة عالية"         value={stats.highSeverityReports} color="#ef4444" />
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Bar chart — by day */}
              <div className="rounded-2xl p-5" style={{ background: "#0d1f35", border: "1px solid #1e3a5f" }}>
                <h3 className="font-bold text-white mb-4">البلاغات (آخر 7 أيام)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byDayData}>
                    <XAxis dataKey="date" stroke="#334155" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 8 }}
                             labelStyle={{ color: "#94a3b8" }} itemStyle={{ color: "#22d3ee" }} />
                    <Bar dataKey="count" fill="#22d3ee" radius={[4,4,0,0]} name="البلاغات" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart — by class */}
              <div className="rounded-2xl p-5" style={{ background: "#0d1f35", border: "1px solid #1e3a5f" }}>
                <h3 className="font-bold text-white mb-4">توزيع التصنيفات</h3>
                <div className="flex items-center">
                  <ResponsiveContainer width="60%" height={200}>
                    <PieChart>
                      <Pie data={byClassData} dataKey="value" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                        {byClassData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {byClassData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                             style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs" style={{ color: "#94a3b8" }}>{d.name}</span>
                        <span className="text-xs font-bold text-white mr-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live alerts */}
            {alerts.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: "#0d1f35", border: "1px solid #ef444433" }}>
                <h3 className="font-bold mb-3" style={{ color: "#ef4444" }}>🚨 تنبيهات حية</h3>
                <div className="space-y-2">
                  {alerts.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b"
                         style={{ borderColor: "#1e3a5f" }}>
                      <span style={{ color: SEV_COLOR[a.severityScore] }}>●</span>
                      <span className="text-sm text-white">{CLASS_AR[a.predictedClass] || a.predictedClass}</span>
                      <span className="text-xs mr-auto" style={{ color: "#64748b" }}>
                        {a.time?.toLocaleTimeString("ar-EG")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Map Tab ── */}
        {activeTab === "map" && (
          <div className="rounded-2xl overflow-hidden" style={{ height: "65vh" }}>
            <MapContainer center={[26.8, 30.8]} zoom={6}
                          style={{ height: "100%", width: "100%" }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                         attribution='&copy; CARTO' />
              {mapPoints.map((p, i) => (
                <CircleMarker key={i} center={[p.latitude, p.longitude]}
                              radius={10 + (p.countInArea * 4)}
                              pathOptions={{
                                color: SEV_COLOR[p.severityScore],
                                fillColor: SEV_COLOR[p.severityScore],
                                fillOpacity: 0.35, weight: 2
                              }}>
                  <Popup>
                    <div dir="rtl" className="text-sm space-y-1 min-w-32">
                      <p className="font-bold">{CLASS_AR[p.predictedClass] || p.predictedClass}</p>
                      <p>الخطورة: <span style={{ color: SEV_COLOR[p.severityScore] }}>{p.severityLabel}</span></p>
                      <p>عدد البلاغات: {p.countInArea}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}

        {/* ── Reports Tab ── */}
        {activeTab === "reports" && (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #1e3a5f" }} dir="rtl">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#0d1f35", borderBottom: "1px solid #1e3a5f" }}>
                  {["#", "المستخدم", "التصنيف", "الخطورة", "الحالة", "التاريخ"].map(h => (
                    <th key={h} className="px-4 py-3 text-right font-medium" style={{ color: "#64748b" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #0f2032", background: i % 2 ? "#080e1c" : "transparent" }}
                      className="hover:bg-opacity-50 transition">
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#334155" }}>#{r.id}</td>
                    <td className="px-4 py-3 text-white">{r.userName}</td>
                    <td className="px-4 py-3" style={{ color: "#94a3b8" }}>
                      {CLASS_AR[r.predictedClass] || r.predictedClass || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: `${SEV_COLOR[r.severityScore]}22`, color: SEV_COLOR[r.severityScore] }}>
                        {r.severityLabel || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs"
                            style={{ background: "#1e3a5f", color: "#64748b" }}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#334155" }}>
                      {new Date(r.createdAt).toLocaleDateString("ar-EG")}
                    </td>
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
