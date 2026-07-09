export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5179";
export const BASE = `${BASE_URL}/api`;

const getToken = () => localStorage.getItem("raqib_token");

const headers = (isForm = false) => ({
  ...(!isForm && { "Content-Type": "application/json" }),
  ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
});

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: headers(opts.form),
  });

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({ message: res.statusText }));
    const message = Array.isArray(errPayload)
      ? errPayload.join("، ")
      : errPayload.message || errPayload.title || "حدث خطأ";

    const error = new Error(message);
    error.status = res.status;
    error.payload = errPayload;
    error.needsVerification = Boolean(errPayload.needsVerification);
    error.userId = errPayload.userId;
    throw error;
  }
  return res.json();
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────
  register:  (data) => request("/auth/register",  { method: "POST", body: JSON.stringify(data) }),
  login:     (data) => request("/auth/login",     { method: "POST", body: JSON.stringify(data) }),
  verifyOtp: (userId, otp) =>
    request("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ userId, otp }),
    }),
  resendOtp: (email) =>
    request("/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  // ── Reports ───────────────────────────────────────────────
  createReport: (formData) =>
    fetch(`${BASE}/reports`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body:    formData,
    }).then(r => r.json()),

  getMyReports: () => request("/reports/my"),
  getMapPoints: () => request("/reports/map"),
  getReport:    (id) => request(`/reports/${id}`),
  sendChat:     (reportId, userMessage) =>
    request("/reports/chat", {
      method: "POST",
      body: JSON.stringify({ reportId, userMessage }),
    }),
  getChatHistory: (reportId) => request(`/reports/chat/${reportId}`),

  // ── Admin ─────────────────────────────────────────────────
  getDashboard: () => request("/admin/dashboard"),
  getAllReports: () => request("/admin/reports"),
  getAllUsers:   () => request("/admin/users"),
  updateStatus:  (id, status) =>
    request(`/reports/${id}/status`, { method: "PATCH", body: JSON.stringify(status) }),
  toggleUser:   (id) =>
    request(`/admin/users/${id}/toggle`, { method: "PATCH" }),
};
