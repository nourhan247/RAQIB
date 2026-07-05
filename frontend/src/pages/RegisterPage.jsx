import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm]   = useState({ fullName: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("كلمة المرور غير متطابقة");
    setError(""); setLoading(true);
    try {
      await api.register({ fullName: form.fullName, email: form.email, password: form.password });
      navigate("/login?registered=1");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "fullName",  label: "الاسم الكامل",       type: "text",     placeholder: "أحمد محمد" },
    { key: "email",     label: "البريد الإلكتروني",   type: "email",    placeholder: "example@email.com" },
    { key: "password",  label: "كلمة المرور",          type: "password", placeholder: "••••••••" },
    { key: "confirm",   label: "تأكيد كلمة المرور",   type: "password", placeholder: "••••••••" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: "#070d1a" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, #22d3ee22, #10b98122)", border: "1px solid #22d3ee33" }}>
            <span className="text-3xl">🌿</span>
          </div>
          <h1 className="text-3xl font-bold"
              style={{ background: "linear-gradient(135deg, #22d3ee, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            RAQIB
          </h1>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "#0d1f35", border: "1px solid #1e3a5f" }}>
          <h2 className="text-xl font-bold text-white text-center mb-6" dir="rtl">إنشاء حساب جديد</h2>

          <form onSubmit={handle} className="space-y-4" dir="rtl">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-sm mb-1.5" style={{ color: "#94a3b8" }}>{f.label}</label>
                <input
                  type={f.type} required value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-600 focus:outline-none"
                  style={{ background: "#071525", border: "1px solid #1e3a5f" }}
                />
              </div>
            ))}

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm text-red-300"
                   style={{ background: "#ef444422", border: "1px solid #ef444444" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
                    className="w-full py-3 rounded-xl font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #22d3ee, #10b981)" }}>
              {loading ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
            </button>
          </form>

          <p className="text-center mt-5 text-sm" style={{ color: "#64748b" }} dir="rtl">
            لديك حساب بالفعل؟{" "}
            <Link to="/login" style={{ color: "#22d3ee" }} className="hover:underline">تسجيل الدخول</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
