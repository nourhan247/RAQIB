import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../services/api";
import { useSignalR } from "../services/useSignalR";
import { useAuth } from "../services/AuthContext";

// ── Severity colors ───────────────────────────────────────────
const SEV_COLOR = { 0: "#22d3ee", 1: "#f59e0b", 2: "#f97316", 3: "#ef4444" };
const SEV_ICON  = { 0: "✅", 1: "💛", 2: "🟠", 3: "🔴" };
const CLASS_AR  = {
  "BIG TRASH": "نفايات كبيرة", "SMALL TRASH": "نفايات صغيرة",
  "NORMAL ROAD": "طريق سليم", "DAMAGED ROAD": "طريق تالف",
  "NORMAL BUILDINGS": "مباني سليمة", "DAMAGED HOME": "مبنى متضرر",
};

// ── Location picker on map click ─────────────────────────────
function LocationPicker({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng) });
  return null;
}

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const [messages, setMessages]     = useState([
    { role: "system", text: "👋 أهلاً! ارفع صورة وحدد الموقع على الخريطة لبدء التحليل." }
  ]);
  const [mapPoints, setMapPoints]   = useState([]);
  const [history, setHistory]       = useState([]);
  const [image, setImage]           = useState(null);
  const [imagePreview, setPreview]  = useState(null);
  const [message, setMessage]       = useState("");
  const [location, setLocation]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState("chat"); // chat | history
  const chatEndRef = useRef(null);

  // Load initial data
  useEffect(() => {
    api.getMapPoints().then(setMapPoints).catch(() => {});
    api.getMyReports().then(setHistory).catch(() => {});
  }, []);

  // Scroll chat to bottom
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // SignalR handlers
  const onAiReply = useCallback((payload) => {
    setMessages(p => [...p, {
      role: "ai",
      text: payload.aiReply,
      class: payload.predictedClass,
      severity: payload.severityLabel,
      severityScore: payload.severityScore,
      confidence: payload.confidence,
      imagePath: payload.imagePath,
    }]);
    setLoading(false);
  }, []);

  const onMapUpdate = useCallback((point) => {
    setMapPoints(p => [...p, point]);
  }, []);

  useSignalR(onAiReply, onMapUpdate, () => {});

  // Handle image pick
  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  // Submit report
  const handleSubmit = async () => {
    if (!image) return alert("ارفع صورة أولاً");
    if (!location) return alert("حدد الموقع على الخريطة");

    const fd = new FormData();
    fd.append("image", image);
    fd.append("Message", message || "لا يوجد وصف");
    fd.append("Latitude",  location.lat);
    fd.append("Longitude", location.lng);

    setLoading(true);
    setMessages(p => [...p,
      { role: "user", text: message || "لا يوجد وصف", image: imagePreview }
    ]);
    setImage(null); setPreview(null); setMessage(""); setLocation(null);

    try {
      await api.createReport(fd);
      // SignalR will deliver the AI reply
    } catch {
      setMessages(p => [...p, { role: "ai", text: "⚠️ حدث خطأ أثناء الإرسال. حاول مرة أخرى." }]);
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: "#070d1a", fontFamily: "Cairo, sans-serif" }}>
      {/* ── Navbar ── */}
      <nav className="flex items-center justify-between px-6 py-3 border-b"
           style={{ background: "#0d1f35", borderColor: "#1e3a5f" }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌿</span>
          <span className="font-bold text-xl"
                style={{ background: "linear-gradient(135deg,#22d3ee,#10b981)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            RAQIB
          </span>
        </div>
        <div className="flex items-center gap-4" dir="rtl">
          <span className="text-sm" style={{ color: "#64748b" }}>أهلاً، {user?.fullName}</span>
          <button onClick={logout}
                  className="text-sm px-3 py-1.5 rounded-lg hover:opacity-80 transition"
                  style={{ background: "#1e3a5f", color: "#94a3b8" }}>
            خروج
          </button>
        </div>
      </nav>

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Chat + History ── */}
        <div className="w-full lg:w-2/5 flex flex-col border-r" style={{ borderColor: "#1e3a5f" }}>
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: "#1e3a5f" }}>
            {["chat", "history"].map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                      className="flex-1 py-3 text-sm font-medium transition-all"
                      style={{
                        color: activeTab === t ? "#22d3ee" : "#64748b",
                        borderBottom: activeTab === t ? "2px solid #22d3ee" : "2px solid transparent",
                        background: "transparent"
                      }}>
                {t === "chat" ? "💬 المحادثة" : "📋 السجل"}
              </button>
            ))}
          </div>

          {activeTab === "chat" ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`} dir="rtl">
                    <div className="max-w-xs rounded-2xl p-3 text-sm"
                         style={{
                           background: m.role === "user" ? "#1e3a5f" :
                                       m.role === "system" ? "#0d2137" : "#071525",
                           border: m.role === "ai" ? "1px solid #1e3a5f" : "none",
                           color: "#e2e8f0"
                         }}>
                      {m.image && (
                        <img src={m.image} alt="" className="rounded-xl mb-2 w-full object-cover max-h-40" />
                      )}
                      {m.role === "ai" && m.class && (
                        <div className="flex items-center gap-2 mb-2 pb-2"
                             style={{ borderBottom: "1px solid #1e3a5f" }}>
                          <span style={{ color: SEV_COLOR[m.severityScore] }}>{SEV_ICON[m.severityScore]}</span>
                          <span className="font-bold text-xs" style={{ color: SEV_COLOR[m.severityScore] }}>
                            {CLASS_AR[m.class] || m.class}
                          </span>
                          <span className="text-xs mr-auto" style={{ color: "#64748b" }}>
                            {(m.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                      <p className="whitespace-pre-line leading-6">{m.text}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start" dir="rtl">
                    <div className="rounded-2xl px-5 py-3" style={{ background: "#071525", border: "1px solid #1e3a5f" }}>
                      <div className="flex gap-1.5">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                               style={{ background: "#22d3ee", animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input area */}
              <div className="p-4 space-y-3 border-t" style={{ borderColor: "#1e3a5f" }} dir="rtl">
                {/* Image preview */}
                {imagePreview && (
                  <div className="relative w-20 h-20">
                    <img src={imagePreview} className="w-full h-full object-cover rounded-xl" alt="preview" />
                    <button onClick={() => { setImage(null); setPreview(null); }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs flex items-center justify-center"
                            style={{ background: "#ef4444", color: "white" }}>✕</button>
                  </div>
                )}

                {/* Location indicator */}
                {location && (
                  <div className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2"
                       style={{ background: "#10b98122", border: "1px solid #10b98133", color: "#10b981" }}>
                    <span>📍</span>
                    <span>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
                    <button onClick={() => setLocation(null)} className="mr-auto opacity-60 hover:opacity-100">✕</button>
                  </div>
                )}

                <div className="flex gap-2">
                  <label className="flex-shrink-0 cursor-pointer w-10 h-10 rounded-xl flex items-center justify-center transition hover:opacity-80"
                         style={{ background: "#1e3a5f" }}>
                    📷
                    <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
                  </label>
                  <input value={message} onChange={e => setMessage(e.target.value)}
                         placeholder="اكتب وصفاً للمشكلة..."
                         className="flex-1 px-4 py-2 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none"
                         style={{ background: "#071525", border: "1px solid #1e3a5f" }}
                         onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                  <button onClick={handleSubmit} disabled={loading || !image}
                          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition hover:opacity-80 disabled:opacity-30"
                          style={{ background: "linear-gradient(135deg,#22d3ee,#10b981)" }}>
                    ➤
                  </button>
                </div>
                <p className="text-xs text-center" style={{ color: "#334155" }}>
                  انقر على الخريطة لتحديد موقع المشكلة
                </p>
              </div>
            </>
          ) : (
            /* History tab */
            <div className="flex-1 overflow-y-auto p-4 space-y-3" dir="rtl">
              {history.length === 0 && (
                <p className="text-center py-12" style={{ color: "#334155" }}>لا توجد بلاغات بعد</p>
              )}
              {history.map(r => (
                <div key={r.id} className="rounded-xl p-4 space-y-2"
                     style={{ background: "#0d1f35", border: "1px solid #1e3a5f" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: SEV_COLOR[r.severityScore] }}>
                      {SEV_ICON[r.severityScore]} {CLASS_AR[r.predictedClass] || r.predictedClass}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "#1e3a5f", color: "#64748b" }}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "#94a3b8" }}>{r.message}</p>
                  <p className="text-xs" style={{ color: "#334155" }}>
                    {new Date(r.createdAt).toLocaleDateString("ar-EG", { dateStyle: "medium" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Map ── */}
        <div className="hidden lg:block flex-1 relative">
          <MapContainer
            center={[26.8, 30.8]}
            zoom={6}
            style={{ height: "100%", width: "100%", background: "#070d1a" }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            <LocationPicker onPick={setLocation} />

            {/* Selected location marker */}
            {location && (
              <CircleMarker center={[location.lat, location.lng]} radius={10}
                            pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 0.6 }}>
                <Popup>موقع البلاغ المحدد</Popup>
              </CircleMarker>
            )}

            {/* Report clusters */}
            {mapPoints.map((p, i) => (
              <CircleMarker
                key={i}
                center={[p.latitude, p.longitude]}
                radius={8 + (p.countInArea * 3)}   // يكبر مع كل بلاغ
                pathOptions={{
                  color: SEV_COLOR[p.severityScore],
                  fillColor: SEV_COLOR[p.severityScore],
                  fillOpacity: 0.4,
                  weight: 2
                }}
              >
                <Popup>
                  <div dir="rtl" className="text-sm space-y-1">
                    <p className="font-bold">{CLASS_AR[p.predictedClass] || p.predictedClass}</p>
                    <p>الخطورة: {p.severityLabel}</p>
                    <p>عدد البلاغات في المنطقة: {p.countInArea}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Map legend */}
          <div className="absolute bottom-6 right-6 rounded-xl p-4 z-[1000]"
               style={{ background: "#0d1f35cc", border: "1px solid #1e3a5f", backdropFilter: "blur(8px)" }}
               dir="rtl">
            <p className="text-xs font-bold mb-2" style={{ color: "#94a3b8" }}>مستوى الخطورة</p>
            {[
              { label: "منعدمة",  color: "#22d3ee" },
              { label: "منخفضة", color: "#f59e0b" },
              { label: "متوسطة", color: "#f97316" },
              { label: "عالية",   color: "#ef4444" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                <span className="text-xs" style={{ color: "#64748b" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
