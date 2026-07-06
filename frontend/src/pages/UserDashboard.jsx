import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../services/api";
import { useSignalR } from "../services/useSignalR";
import { useAuth } from "../services/AuthContext";

// ── Brand tokens (same system as Login / Register) ───────────
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

// ── Severity → brand-consistent spectrum (navy = calm, orange = attention, red reserved for critical only) ──
const SEV_COLOR = { 0: C.navySecondary, 1: C.orange, 2: C.orangeDark, 3: C.critical };
const SEV_ICON  = { 0: "✅", 1: "🟡", 2: "🟠", 3: "🔴" };
const CLASS_AR  = {
  "BIG TRASH": "نفايات كبيرة", "SMALL TRASH": "نفايات صغيرة",
  "NORMAL ROAD": "طريق سليم", "DAMAGED ROAD": "طريق تالف",
  "NORMAL BUILDINGS": "مباني سليمة", "DAMAGED HOME": "مبنى متضرر",
};

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "البحر الأحمر", "البحيرة",
  "الفيوم", "الغربية", "الإسماعيلية", "المنوفية", "المنيا", "القليوبية",
  "الوادي الجديد", "السويس", "أسوان", "أسيوط", "بني سويف", "بورسعيد",
  "دمياط", "الشرقية", "جنوب سيناء", "كفر الشيخ", "مطروح", "الأقصر",
  "قنا", "شمال سيناء", "سوهاج",
];

// ── Location picker on map click ─────────────────────────────
function LocationPicker({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng) });
  return null;
}

// ── Recenters the map whenever `target` changes (e.g. after geolocation) ──
function FlyToController({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 1.2 });
  }, [target, map]);
  return null;
}

export default function UserDashboard() {
  const { user, logout } = useAuth();

  const [messages, setMessages] = useState([]);
  const [mapPoints, setMapPoints] = useState([]);
  const [history, setHistory] = useState([]);

  const [image, setImage] = useState(null);
  const [imagePreview, setPreview] = useState(null);
  const [message, setMessage] = useState("");

  const [locationInfo, setLocationInfo] = useState({ governorate: "", area: "", street: "" });
  const [pin, setPin] = useState(null);           // { lat, lng }
  const [flyTarget, setFlyTarget] = useState(null);
  const [locating, setLocating] = useState(false);

  const [loading, setLoading] = useState(false);
  const [hasChatted, setHasChatted] = useState(false);
  const [activeTab, setActiveTab] = useState("report"); // report | chat | history
  const chatEndRef = useRef(null);

  // Load initial data
  useEffect(() => {
    api.getMapPoints().then(setMapPoints).catch(() => {});
    api.getMyReports().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── SignalR handlers ──
  const onAiReply = useCallback((payload) => {
    setMessages((p) => [...p, {
      role: "ai",
      text: payload.aiReply,
      class: payload.predictedClass,
      severity: payload.severityLabel,
      severityScore: payload.severityScore,
      confidence: payload.confidence,
      imagePath: payload.imagePath,
    }]);
    setLoading(false);
    setHasChatted(true);
    setActiveTab("chat");
  }, []);

  const onMapUpdate = useCallback((point) => { setMapPoints((p) => [...p, point]); }, []);

  useSignalR(onAiReply, onMapUpdate, () => {});

  // ── Reverse geocoding (best-effort, never blocks the user) ──
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`
      );
      const data = await res.json();
      const a = data.address || {};
      setLocationInfo((p) => ({
        governorate: a.state || a.county || p.governorate,
        area: a.suburb || a.city_district || a.town || a.village || p.area,
        street: a.road || p.street,
      }));
    } catch {
      /* silent — user can always type it manually */
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPin({ lat: latitude, lng: longitude });
        setFlyTarget({ lat: latitude, lng: longitude });
        reverseGeocode(latitude, longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePick = (latlng) => {
    setPin(latlng);
    reverseGeocode(latlng.lat, latlng.lng);
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const locationLabel = [locationInfo.street, locationInfo.area, locationInfo.governorate]
    .filter(Boolean).join("، ");

  const canSubmit = image && pin && locationInfo.governorate;

  const handleSubmit = async () => {
    if (!image) return alert("ارفع صورة أولاً");
    if (!pin) return alert("حدد الموقع على الخريطة أو استخدم موقعك الحالي");
    if (!locationInfo.governorate) return alert("اختر المحافظة");

    const fd = new FormData();
    fd.append("image", image);
    fd.append("Message", message || "لا يوجد وصف");
    fd.append("Latitude", pin.lat);
    fd.append("Longitude", pin.lng);
    fd.append("Governorate", locationInfo.governorate);
    fd.append("Area", locationInfo.area || "");
    fd.append("Street", locationInfo.street || "");

    setLoading(true);
    setMessages((p) => [...p, {
      role: "user",
      text: message || "لا يوجد وصف",
      image: imagePreview,
      location: locationLabel,
    }]);
    setImage(null); setPreview(null); setMessage("");

    try {
      await api.createReport(fd);
      // SignalR delivers the AI reply → onAiReply switches to the chat tab
    } catch {
      setMessages((p) => [...p, { role: "ai", text: "⚠️ حدث خطأ أثناء الإرسال. حاول مرة أخرى." }]);
      setLoading(false);
    }
  };

  return (
    <div className="raqib-dash">
      <style>{`
        .raqib-dash {
          --navy-primary: ${C.navyPrimary};
          --navy-secondary: ${C.navySecondary};
          --orange: ${C.orange};
          --orange-dark: ${C.orangeDark};
          --white: ${C.white};
          --off-white: ${C.offWhite};
          --light-gray: ${C.lightGray};
          --gray: ${C.gray};
          background: #0b1c33;
          height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: Cairo, sans-serif;
          box-sizing: border-box;
        }
        .raqib-dash *, .raqib-dash *::before, .raqib-dash *::after { box-sizing: border-box; }

        /* ── Brand mark ── */
        .brand-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--orange);
          box-shadow: 0 0 8px var(--orange);
          animation: dot-breathe 2.4s ease-in-out infinite;
        }
        @keyframes dot-breathe {
          0%, 100% { box-shadow: 0 0 6px var(--orange); transform: scale(1); }
          50%      { box-shadow: 0 0 14px var(--orange); transform: scale(1.2); }
        }

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

        /* ── Cards ── */
        .rq-card {
          background: rgba(39, 68, 110, 0.28);
          border: 1px solid rgba(200, 205, 214, 0.15);
          border-radius: 16px;
        }
        .rq-card-frame { position: relative; }
        .rq-corner { position: absolute; width: 16px; height: 16px; border: 2px solid var(--orange); opacity: 0.85; }
        .rq-corner.tl { top: -1px; left: -1px; border-right: none; border-bottom: none; border-radius: 6px 0 0 0; }
        .rq-corner.tr { top: -1px; right: -1px; border-left: none; border-bottom: none; border-radius: 0 6px 0 0; }
        .rq-corner.bl { bottom: -1px; left: -1px; border-right: none; border-top: none; border-radius: 0 0 0 6px; }
        .rq-corner.br { bottom: -1px; right: -1px; border-left: none; border-top: none; border-radius: 0 0 6px 0; }

        .rq-eyebrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px; letter-spacing: 1.5px;
          color: var(--orange);
          margin-bottom: 4px;
        }

        /* ── Form controls ── */
        .rq-input, .rq-select, .rq-textarea {
          width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          border: 1px solid rgba(200, 205, 214, 0.2);
          background: rgba(13, 31, 53, 0.6);
          color: var(--off-white);
          font-size: 13.5px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          box-sizing: border-box;
          font-family: inherit;
        }
        .rq-input::placeholder, .rq-textarea::placeholder { color: rgba(200, 205, 214, 0.45); }
        .rq-input:focus, .rq-select:focus, .rq-textarea:focus {
          border-color: var(--orange);
          box-shadow: 0 0 0 3px rgba(242, 140, 40, 0.15);
        }
        .rq-select option { color: #000; }
        .rq-textarea { resize: vertical; }

        .rq-field { margin-bottom: 0; }
        .rq-field + .rq-field { margin-top: 12px; }
        .rq-field-label {
          display: block; font-size: 12px; margin-bottom: 6px; color: var(--gray);
        }

        /* ── Buttons ── */
        .rq-btn-primary {
          border: none; border-radius: 10px; font-weight: 700; color: #1a1103;
          background: linear-gradient(135deg, var(--orange), var(--orange-dark));
          box-shadow: 0 8px 18px rgba(242, 140, 40, 0.22);
          transition: transform 0.12s ease;
          cursor: pointer;
          font-family: inherit;
        }
        .rq-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
        .rq-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

        .rq-btn-ghost {
          border: 1px solid rgba(242,140,40,0.35);
          border-radius: 10px; color: var(--orange);
          background: rgba(242,140,40,0.08);
          transition: background 0.15s ease;
          cursor: pointer;
          font-family: inherit;
        }
        .rq-btn-ghost:hover { background: rgba(242,140,40,0.16); }
        .rq-btn-ghost:disabled { opacity: 0.55; cursor: not-allowed; }

        .rq-btn-logout {
          font-size: 13px; padding: 6px 12px; border-radius: 8px;
          background: rgba(200,205,214,0.1); color: var(--gray);
          border: none; cursor: pointer; transition: opacity 0.15s ease;
          font-family: inherit;
        }
        .rq-btn-logout:hover { opacity: 0.8; }

        .rq-tab {
          color: var(--gray); border: none; background: none;
          border-bottom: 2px solid transparent;
          flex: 1; padding: 12px 0; font-size: 14px; font-weight: 500;
          transition: all 0.15s ease; cursor: pointer; font-family: inherit;
        }
        .rq-tab.active { color: var(--orange); border-bottom: 2px solid var(--orange); }
        .rq-tab:disabled { opacity: 0.35; cursor: not-allowed; }

        .rq-result-card {
          animation: rq-reveal 0.45s ease-out both;
          border: 1px solid rgba(242,140,40,0.3);
          background: linear-gradient(135deg, rgba(242,140,40,0.08), rgba(39,68,110,0.35));
        }
        @keyframes rq-reveal {
          0%   { opacity: 0; transform: translateY(8px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        .locate-badge {
          position: absolute; width: 14px; height: 14px; border-radius: 50%;
          pointer-events: none;
        }
        .locate-badge .ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1.5px solid var(--orange);
          animation: locate-ping 2.4s ease-out infinite;
        }
        @keyframes locate-ping {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(3.2); opacity: 0; }
        }

        /* ── Layout ── */
        .rq-navbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 24px; border-bottom: 1px solid rgba(200,205,214,0.15);
          background: #0d1f35;
        }
        .rq-navbar-left { display: flex; align-items: center; gap: 12px; }
        .rq-navbar-right { display: flex; align-items: center; gap: 16px; }
        .rq-greeting { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--gray); }

        .rq-main { flex: 1; display: flex; overflow: hidden; }

        .rq-left-panel {
          width: 100%;
          display: flex; flex-direction: column;
          border-right: 1px solid rgba(200,205,214,0.15);
        }
        @media (min-width: 1024px) { .rq-left-panel { width: 40%; } }

        .rq-tabs { display: flex; border-bottom: 1px solid rgba(200,205,214,0.15); }

        .rq-panel-scroll { flex: 1; overflow-y: auto; padding: 16px; }
        .rq-panel-scroll.chat-scroll { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

        .rq-block { margin-bottom: 16px; }
        .rq-block-title { font-weight: 700; margin-bottom: 12px; color: var(--white); }
        .rq-block-body { padding: 16px; }
        .rq-field-stack { display: flex; flex-direction: column; gap: 12px; }

        .rq-locate-btn {
          width: 100%; padding: 10px 0; font-size: 14px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }

        .rq-pin-chip {
          font-size: 12px; padding: 8px 12px; border-radius: 10px;
          display: flex; align-items: center; gap: 8px;
          background: rgba(242,140,40,0.08); border: 1px solid rgba(242,140,40,0.25); color: var(--orange);
        }
        .rq-pin-chip .rq-map-hint { margin-right: auto; opacity: 0.8; display: none; }
        @media (max-width: 1023px) { .rq-pin-chip .rq-map-hint { display: inline; } }

        .rq-map-tip { font-size: 12px; color: var(--gray); display: none; }
        @media (min-width: 1024px) { .rq-map-tip { display: block; } }

        .rq-image-preview-wrap { position: relative; width: 100%; margin-bottom: 12px; }
        .rq-image-preview-wrap img { width: 100%; height: 176px; object-fit: cover; border-radius: 12px; display: block; }
        .rq-image-remove {
          position: absolute; top: -8px; right: -8px; width: 24px; height: 24px;
          border-radius: 50%; font-size: 12px; display: flex; align-items: center; justify-content: center;
          background: var(--critical); color: white; border: none; cursor: pointer;
        }

        .rq-dropzone {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer; border-radius: 12px; padding: 32px 0; margin-bottom: 12px;
          border: 1.5px dashed rgba(242,140,40,0.4); background: rgba(13,31,53,0.4);
          transition: opacity 0.15s ease;
        }
        .rq-dropzone:hover { opacity: 0.9; }
        .rq-dropzone .rq-dz-icon { font-size: 24px; }
        .rq-dropzone .rq-dz-label { font-size: 14px; color: var(--gray); }
        .rq-hidden-input { display: none; }

        .rq-submit-btn { width: 100%; padding: 12px 0; font-size: 14px; }
        .rq-submit-hint { font-size: 12px; text-align: center; margin-top: 8px; color: var(--gray); }

        /* ── Chat ── */
        .rq-msg-row { display: flex; }
        .rq-msg-row.from-user { justify-content: flex-end; }
        .rq-msg-row.from-ai { justify-content: flex-start; }

        .rq-msg-bubble {
          max-width: 320px; border-radius: 18px; padding: 12px; font-size: 14px; color: var(--off-white);
        }
        .rq-msg-bubble.user { background: rgba(200,205,214,0.12); }
        .rq-msg-bubble.ai { background: rgba(13,31,53,0.7); border: 1px solid rgba(200,205,214,0.15); }
        .rq-msg-bubble.result { border: none; background: none; }

        .rq-msg-image { border-radius: 12px; margin-bottom: 8px; width: 100%; object-fit: cover; max-height: 160px; display: block; }
        .rq-msg-location { font-size: 12px; margin-bottom: 4px; color: var(--gray); }
        .rq-msg-text { white-space: pre-line; line-height: 1.5; margin: 0; }

        .rq-result-header {
          display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 8px;
          border-bottom: 1px solid rgba(200,205,214,0.15);
        }
        .rq-result-class { font-weight: 700; font-size: 12px; }
        .rq-result-confidence { font-size: 12px; margin-right: auto; color: var(--gray); }

        .rq-typing-row { display: flex; justify-content: flex-start; }
        .rq-typing-bubble {
          border-radius: 18px; padding: 12px 20px;
          background: rgba(13,31,53,0.7); border: 1px solid rgba(200,205,214,0.15);
        }
        .rq-typing-dots { display: flex; gap: 6px; }
        .rq-typing-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); animation: rq-bounce 1.1s infinite; }
        @keyframes rq-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
          40% { transform: translateY(-6px); opacity: 1; }
        }

        .rq-chat-composer { padding: 16px; display: flex; flex-direction: column; gap: 12px; border-top: 1px solid rgba(200,205,214,0.15); }
        .rq-composer-preview { position: relative; width: 80px; height: 80px; }
        .rq-composer-preview img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; display: block; }
        .rq-composer-preview .rq-image-remove { top: -6px; right: -6px; width: 20px; height: 20px; }

        .rq-composer-pin { font-size: 12px; padding: 6px 12px; }
        .rq-composer-pin button {
          margin-right: auto; opacity: 0.7; background: none; border: none; color: inherit;
          cursor: pointer; font-family: inherit; font-size: inherit;
        }
        .rq-composer-pin button:hover { opacity: 1; }

        .rq-composer-row { display: flex; gap: 8px; }
        .rq-composer-attach {
          flex-shrink: 0; cursor: pointer; width: 40px; height: 40px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(200,205,214,0.1); transition: opacity 0.15s ease;
        }
        .rq-composer-attach:hover { opacity: 0.8; }
        .rq-composer-input { flex: 1; }
        .rq-composer-send {
          flex-shrink: 0; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
        }

        /* ── History ── */
        .rq-history-empty { text-align: center; padding: 48px 0; color: var(--gray); }
        .rq-history-card {
          border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px;
          background: rgba(39,68,110,0.28); border: 1px solid rgba(200,205,214,0.15);
        }
        .rq-history-card + .rq-history-card { margin-top: 12px; }
        .rq-history-top { display: flex; align-items: center; justify-content: space-between; }
        .rq-history-class { font-size: 12px; font-weight: 700; }
        .rq-history-status { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: rgba(200,205,214,0.12); color: var(--gray); }
        .rq-history-location { font-size: 12px; color: var(--orange); margin: 0; }
        .rq-history-message { font-size: 14px; color: var(--gray); margin: 0; }
        .rq-history-date { font-size: 12px; color: rgba(200,205,214,0.5); margin: 0; }

        /* ── Map panel ── */
        .rq-map-panel { display: none; flex: 1; position: relative; }
        @media (min-width: 1024px) { .rq-map-panel { display: block; } }

        .rq-map-badge { position: absolute; top: 16px; right: 16px; z-index: 1000; }
        .rq-map-badge .rq-card { padding: 8px 12px; backdrop-filter: blur(8px); }

        .rq-legend {
          position: absolute; bottom: 24px; right: 24px; z-index: 1000; border-radius: 12px; padding: 16px;
          background: rgba(13,31,53,0.85); border: 1px solid rgba(200,205,214,0.15); backdrop-filter: blur(8px);
        }
        .rq-legend-title { font-size: 12px; font-weight: 700; margin-bottom: 8px; color: var(--gray); }
        .rq-legend-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .rq-legend-row:last-child { margin-bottom: 0; }
        .rq-legend-dot { width: 12px; height: 12px; border-radius: 50%; }
        .rq-legend-label { font-size: 12px; color: var(--gray); }

        .rq-popup-title { font-weight: 700; margin: 0; }
        .rq-popup-line { margin: 2px 0 0; }

        @media (prefers-reduced-motion: reduce) {
          .brand-dot, .logo-ring, .brand-name, .rq-result-card, .locate-badge .ring, .rq-typing-dot { animation: none !important; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav className="rq-navbar">
        <div className="rq-navbar-left">
          <div className="logo-mark">
            <span className="logo-ring l1" />
            <span className="logo-ring l2" />
            <span className="logo-core" />
          </div>
          <span className="brand-name">RAQIB</span>
        </div>
        <div className="rq-navbar-right" dir="rtl">
          <span className="rq-greeting">
            <span className="brand-dot" /> أهلاً، {user?.fullName}
          </span>
          <button onClick={logout} className="rq-btn-logout">
            خروج
          </button>
        </div>
      </nav>

      {/* ── Main layout ── */}
      <div className="rq-main">

        {/* ── Left: Report wizard / Chat / History ── */}
        <div className="rq-left-panel">

          {/* Tabs */}
          <div className="rq-tabs">
            <button onClick={() => setActiveTab("report")}
                    className={`rq-tab ${activeTab === "report" ? "active" : ""}`}>
               بلاغ جديد
            </button>
            <button onClick={() => hasChatted && setActiveTab("chat")} disabled={!hasChatted}
                    className={`rq-tab ${activeTab === "chat" ? "active" : ""}`}>
               المحادثة
            </button>
            <button onClick={() => setActiveTab("history")}
                    className={`rq-tab ${activeTab === "history" ? "active" : ""}`}>
               السجل
            </button>
          </div>

          {/* ── Report wizard ── */}
          {activeTab === "report" && (
            <div className="rq-panel-scroll" dir="rtl">
              <div className="rq-card-frame rq-block">
                <span className="rq-corner tl" /><span className="rq-corner tr" />
                <span className="rq-corner bl" /><span className="rq-corner br" />
                <div className="rq-card rq-block-body">
                  <div className="rq-eyebrow">LOCATION_DATA</div>
                  <h3 className="rq-block-title" style={{ color: C.white }}>موقع المشكلة</h3>

                  <div className="rq-field-stack">
                    <div className="rq-field">
                      <label className="rq-field-label">المحافظة</label>
                      <select className="rq-select" value={locationInfo.governorate}
                              onChange={(e) => setLocationInfo((p) => ({ ...p, governorate: e.target.value }))}>
                        <option value="">اختر المحافظة</option>
                        {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="rq-field">
                      <label className="rq-field-label">المنطقة</label>
                      <input className="rq-input" value={locationInfo.area}
                             onChange={(e) => setLocationInfo((p) => ({ ...p, area: e.target.value }))}
                             placeholder="مثال: مدينة نصر" />
                    </div>
                    <div className="rq-field">
                      <label className="rq-field-label">الشارع</label>
                      <input className="rq-input" value={locationInfo.street}
                             onChange={(e) => setLocationInfo((p) => ({ ...p, street: e.target.value }))}
                             placeholder="مثال: شارع مصطفى النحاس" />
                    </div>

                    <button onClick={useMyLocation} disabled={locating}
                            className="rq-btn-ghost rq-locate-btn">
                      {locating ? "جارٍ تحديد موقعك..." : " استخدم موقعي الحالي"}
                    </button>

                    {pin && (
                      <div className="rq-pin-chip">
                        
                        <span>{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span>
                        <span className="rq-map-hint">حدد على الخريطة</span>
                      </div>
                    )}
                    <p className="rq-map-tip">
                      أو انقر على الخريطة يمين الشاشة لتثبيت الموقع بدقة.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rq-card-frame">
                <span className="rq-corner tl" /><span className="rq-corner tr" />
                <span className="rq-corner bl" /><span className="rq-corner br" />
                <div className="rq-card rq-block-body">
                  <div className="rq-eyebrow">IMAGE_ANALYSIS</div>
                  <h3 className="rq-block-title" style={{ color: C.white }}>صورة المشكلة</h3>

                  {imagePreview ? (
                    <div className="rq-image-preview-wrap">
                      <img src={imagePreview} alt="preview" />
                      <button onClick={() => { setImage(null); setPreview(null); }}
                              className="rq-image-remove">✕</button>
                    </div>
                  ) : (
                    <label className="rq-dropzone">
                      <span className="rq-dz-icon">📷</span>
                      <span className="rq-dz-label">اضغط لرفع صورة المشكلة</span>
                      <input type="file" accept="image/*" className="rq-hidden-input" onChange={handleImage} />
                    </label>
                  )}

                  <textarea className="rq-textarea rq-block" rows={2} value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="اكتب وصفاً مختصراً للمشكلة (اختياري)" />

                  <button onClick={handleSubmit} disabled={loading || !canSubmit}
                          className="rq-btn-primary rq-submit-btn">
                    {loading ? "جارٍ تحليل الصورة..." : "إرسال البلاغ للتحليل"}
                  </button>
                  {!canSubmit && !loading && (
                    <p className="rq-submit-hint">
                      حدد المحافظة والموقع وارفع صورة أولاً
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Chat (unlocked after first analysis) ── */}
          {activeTab === "chat" && (
            <>
              <div className="rq-panel-scroll chat-scroll">
                {messages.map((m, i) => {
                  const isResult = m.role === "ai" && m.class;
                  return (
                    <div key={i} className={`rq-msg-row ${m.role === "user" ? "from-user" : "from-ai"}`} dir="rtl">
                      <div className={`rq-msg-bubble ${m.role === "user" ? "user" : "ai"} ${isResult ? "result rq-result-card" : ""}`}>
                        {m.image && <img src={m.image} alt="" className="rq-msg-image" />}
                        {m.location && (
                          <p className="rq-msg-location">📍 {m.location}</p>
                        )}
                        {isResult && (
                          <div className="rq-result-header">
                            <span>{SEV_ICON[m.severityScore]}</span>
                            <span className="rq-result-class" style={{ color: SEV_COLOR[m.severityScore] }}>
                              {CLASS_AR[m.class] || m.class}
                            </span>
                            <span className="rq-result-confidence">
                              {(m.confidence * 100).toFixed(0)}% ثقة
                            </span>
                          </div>
                        )}
                        <p className="rq-msg-text">{m.text}</p>
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div className="rq-typing-row" dir="rtl">
                    <div className="rq-typing-bubble">
                      <div className="rq-typing-dots">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="rq-typing-dot" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="rq-chat-composer" dir="rtl">
                {imagePreview && (
                  <div className="rq-composer-preview">
                    <img src={imagePreview} alt="preview" />
                    <button onClick={() => { setImage(null); setPreview(null); }}
                            className="rq-image-remove">✕</button>
                  </div>
                )}
                {pin && (
                  <div className="rq-pin-chip rq-composer-pin">
                    <span>📍</span><span>{locationLabel || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}</span>
                    <button onClick={() => setActiveTab("report")}>تعديل</button>
                  </div>
                )}
                <div className="rq-composer-row">
                  <label className="rq-composer-attach">
                    📷
                    <input type="file" accept="image/*" className="rq-hidden-input" onChange={handleImage} />
                  </label>
                  <input value={message} onChange={(e) => setMessage(e.target.value)}
                         placeholder="اكتب بلاغاً جديداً بنفس الموقع..."
                         className="rq-input rq-composer-input"
                         onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                  <button onClick={handleSubmit} disabled={loading || !image}
                          className="rq-btn-primary rq-composer-send">➤</button>
                </div>
              </div>
            </>
          )}

          {/* ── History ── */}
          {activeTab === "history" && (
            <div className="rq-panel-scroll" dir="rtl">
              {history.length === 0 && (
                <p className="rq-history-empty">لا توجد بلاغات بعد</p>
              )}
              {history.map((r) => (
                <div key={r.id} className="rq-history-card">
                  <div className="rq-history-top">
                    <span className="rq-history-class" style={{ color: SEV_COLOR[r.severityScore] }}>
                      {SEV_ICON[r.severityScore]} {CLASS_AR[r.predictedClass] || r.predictedClass}
                    </span>
                    <span className="rq-history-status">
                      {r.status}
                    </span>
                  </div>
                  {(r.governorate || r.area || r.street) && (
                    <p className="rq-history-location">
                      📍 {[r.street, r.area, r.governorate].filter(Boolean).join("، ")}
                    </p>
                  )}
                  <p className="rq-history-message">{r.message}</p>
                  <p className="rq-history-date">
                    {new Date(r.createdAt).toLocaleDateString("ar-EG", { dateStyle: "medium" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Map ── */}
        <div className="rq-map-panel">
          <MapContainer center={[26.8, 30.8]} zoom={6} style={{ height: "100%", width: "100%", background: "#0b1c33" }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            <LocationPicker onPick={handlePick} />
            <FlyToController target={flyTarget} />

            {pin && (
              <CircleMarker center={[pin.lat, pin.lng]} radius={10}
                            pathOptions={{ color: C.orange, fillColor: C.orange, fillOpacity: 0.6 }}>
                <Popup>موقع البلاغ المحدد</Popup>
              </CircleMarker>
            )}

            {mapPoints.map((p, i) => (
              <CircleMarker key={i} center={[p.latitude, p.longitude]} radius={8 + p.countInArea * 3}
                            pathOptions={{ color: SEV_COLOR[p.severityScore], fillColor: SEV_COLOR[p.severityScore], fillOpacity: 0.4, weight: 2 }}>
                <Popup>
                  <div dir="rtl">
                    <p className="rq-popup-title">{CLASS_AR[p.predictedClass] || p.predictedClass}</p>
                    <p className="rq-popup-line">الخطورة: {p.severityLabel}</p>
                    <p className="rq-popup-line">عدد البلاغات في المنطقة: {p.countInArea}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Live-map badge, brand corner frame */}
          <div className="rq-card-frame rq-map-badge">
            <span className="rq-corner tl" /><span className="rq-corner tr" />
            <span className="rq-corner bl" /><span className="rq-corner br" />
            <div className="rq-card">
              <span className="rq-eyebrow" style={{ marginBottom: 0 }}>LIVE_MAP</span>
            </div>
          </div>

          {/* Legend */}
          <div className="rq-legend" dir="rtl">
            <p className="rq-legend-title">مستوى الخطورة</p>
            {[
              { label: "منعدمة", color: SEV_COLOR[0] },
              { label: "منخفضة", color: SEV_COLOR[1] },
              { label: "متوسطة", color: SEV_COLOR[2] },
              { label: "عالية", color: SEV_COLOR[3] },
            ].map((l) => (
              <div key={l.label} className="rq-legend-row">
                <div className="rq-legend-dot" style={{ background: l.color }} />
                <span className="rq-legend-label">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}