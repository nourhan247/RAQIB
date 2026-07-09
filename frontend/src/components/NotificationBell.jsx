import React, { useEffect, useRef, useState } from "react";

const C = {
  orange: "#F28C28",
  orangeDark: "#E57200",
  gray: "#C8CDD6",
  white: "#FFFFFF",
  critical: "#D1453B",
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export default function NotificationBell({ notifications = [], unreadCount = 0, onMarkRead, onMarkAllRead, onOpen }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && typeof onOpen === "function") onOpen();
  };

  return (
    <div ref={rootRef} className="rq-notif-root" dir="rtl">
      <style>{`
        .rq-notif-root{position:relative}
        .rq-notif-btn{position:relative;width:38px;height:38px;border-radius:10px;border:none;background:rgba(200,205,214,.1);color:${C.white};cursor:pointer;font-size:17px;display:flex;align-items:center;justify-content:center;transition:background .15s}
        .rq-notif-btn:hover{background:rgba(242,140,40,.14)}
        .rq-notif-badge{position:absolute;top:-4px;left:-4px;min-width:16px;height:16px;padding:0 3px;border-radius:999px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;background:${C.critical};color:#fff}
        .rq-notif-panel{position:absolute;top:46px;left:0;width:340px;max-height:420px;overflow-y:auto;background:#0d1f35;border:1px solid rgba(242,140,40,.25);border-radius:14px;box-shadow:0 20px 45px rgba(0,0,0,.4);z-index:4000}
        .rq-notif-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(200,205,214,.12)}
        .rq-notif-title{font-size:14px;font-weight:700;color:${C.white}}
        .rq-notif-markall{font-size:11.5px;color:${C.orange};background:none;border:none;cursor:pointer;font-family:inherit}
        .rq-notif-empty{padding:32px 16px;text-align:center;font-size:13px;color:${C.gray}}
        .rq-notif-item{padding:12px 14px;border-bottom:1px solid rgba(200,205,214,.08);cursor:pointer;transition:background .15s}
        .rq-notif-item:hover{background:rgba(242,140,40,.06)}
        .rq-notif-item.unread{background:rgba(242,140,40,.05)}
        .rq-notif-item-title{font-size:12.5px;font-weight:700;color:${C.white};margin:0 0 4px}
        .rq-notif-item-msg{font-size:12px;color:${C.gray};margin:0 0 6px;line-height:1.6}
        .rq-notif-item-time{font-size:10.5px;color:rgba(200,205,214,.5)}
        .rq-notif-dot{width:7px;height:7px;border-radius:50%;background:${C.orange};display:inline-block;margin-left:6px}
      `}</style>

      <button className="rq-notif-btn" onClick={toggle} aria-label="الإشعارات">
        🔔
        {unreadCount > 0 && (
          <span className="rq-notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="rq-notif-panel">
          <div className="rq-notif-hdr">
            <span className="rq-notif-title">الإشعارات</span>
            {notifications.some((n) => !n.isRead) && (
              <button className="rq-notif-markall" onClick={onMarkAllRead}>
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="rq-notif-empty">لا توجد إشعارات بعد</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`rq-notif-item ${!n.isRead ? "unread" : ""}`}
                onClick={() => !n.isRead && onMarkRead && onMarkRead(n.id)}
              >
                <p className="rq-notif-item-title">
                  {!n.isRead && <span className="rq-notif-dot" />}
                  {n.title}
                </p>
                <p className="rq-notif-item-msg">{n.message}</p>
                <span className="rq-notif-item-time">{timeAgo(n.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
