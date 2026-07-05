import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../services/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]   = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const data = await login(form.email, form.password);
      navigate(data.role === "Admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#070d1a" }}>
      {/* Left — branding */}
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 relative overflow-hidden"
           style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #071525 100%)" }}>
        {/* decorative circles */}
        <div className="absolute w-96 h-96 rounded-full opacity-10"
             style={{ background: "radial-gradient(circle, #22d3ee, transparent)", top: "-80px", left: "-80px" }} />
        <div className="absolute w-64 h-64 rounded-full opacity-10"
             style={{ background: "radial-gradient(circle, #10b981, transparent)", bottom: "40px", right: "-40px" }} />

        <div className="relative z-10 text-center px-12">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, #22d3ee22, #10b98122)", border: "1px solid #22d3ee33" }}>
            <span className="text-5xl">🌿</span>
          </div>
          <h1 className="text-5xl font-bold mb-3"
              style={{ background: "linear-gradient(135deg, #22d3ee, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            RAQIB
          </h1>
          <p className="text-lg mb-8" style={{ color: "#64748b" }}>نظام الرصد والإبلاغ الذكي</p>
          <div className="space-y-3 text-right" dir="rtl">
            {["رصد ذكي بالذكاء الاصطناعي", "خريطة تفاعلية للمشكلات", "تحليل فوري للصور"].map(f => (
              <div key={f} className="flex items-center gap-3 justify-end">
                <span style={{ color: "#94a3b8" }} className="text-sm">{f}</span>
                <div className="w-2 h-2 rounded-full" style={{ background: "#22d3ee" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-8" style={{ background: "#0d1f35", border: "1px solid #1e3a5f" }}>
            <div className="text-center mb-8" dir="rtl">
              <h2 className="text-2xl font-bold text-white mb-1">تسجيل الدخول</h2>
              <p style={{ color: "#64748b" }} className="text-sm">أدخل بياناتك للمتابعة</p>
            </div>

            <form onSubmit={handle} className="space-y-4" dir="rtl">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "#94a3b8" }}>البريد الإلكتروني</label>
                <input
                  type="email" required value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="example@email.com"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-600 focus:outline-none transition-all"
                  style={{ background: "#071525", border: "1px solid #1e3a5f" }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "#94a3b8" }}>كلمة المرور</label>
                <input
                  type="password" required value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-600 focus:outline-none transition-all"
                  style={{ background: "#071525", border: "1px solid #1e3a5f" }}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl text-sm text-red-300"
                     style={{ background: "#ef444422", border: "1px solid #ef444444" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                      className="w-full py-3 rounded-xl font-bold text-black transition-all hover:opacity-90 disabled:opacity-50 mt-2"
                      style={{ background: "linear-gradient(135deg, #22d3ee, #10b981)" }}>
                {loading ? "جارٍ التحقق..." : "دخول"}
              </button>
            </form>

            <p className="text-center mt-6 text-sm" style={{ color: "#64748b" }} dir="rtl">
              ليس لديك حساب؟{" "}
              <Link to="/register" style={{ color: "#22d3ee" }} className="hover:underline">
                إنشاء حساب جديد
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
