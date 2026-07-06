import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../services/api";

export default function VerifyOtpPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const userId    = location.state?.userId || "";
  const email     = location.state?.email  || "";

  const [otp, setOtp]         = useState(["", "", "", "", "", ""]);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setTimer] = useState(60);
  const inputRefs = useRef([]);

  // Countdown للـ resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setTimer(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // لو مفيش userId يرجع للـ register
  useEffect(() => {
    if (!userId) navigate("/register");
  }, [userId, navigate]);

  const handleChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0)
      inputRefs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) {
      setOtp(paste.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) return setError("أدخل الكود كاملاً");
    setError(""); setLoading(true);
    try {
      await api.verifyOtp(userId, code);
      setSuccess("تم التأكيد بنجاح! جارٍ التحويل...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.message || "الكود غير صحيح");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await api.resendOtp(email);
      setTimer(60);
      setError("");
      setSuccess("تم إرسال كود جديد");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: "#070d1a" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
               style={{ background: "linear-gradient(135deg,#22d3ee22,#10b98122)", border: "1px solid #22d3ee33" }}>
            <span className="text-3xl">🌿</span>
          </div>
          <h1 className="text-3xl font-bold"
              style={{ background: "linear-gradient(135deg,#22d3ee,#10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            RAQIB
          </h1>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "#0d1f35", border: "1px solid #1e3a5f" }}>
          <div className="text-center mb-6" dir="rtl">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
                 style={{ background: "#22d3ee22", border: "1px solid #22d3ee44" }}>
              <span className="text-2xl">📧</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">تأكيد البريد الإلكتروني</h2>
            <p className="text-sm" style={{ color: "#64748b" }}>
              أدخل الكود المكون من 6 أرقام الذي أرسلناه إلى
            </p>
            <p className="text-sm font-medium mt-1" style={{ color: "#22d3ee" }}>
              {email}
            </p>
          </div>

          {/* OTP inputs */}
          <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-2xl font-bold rounded-xl focus:outline-none transition-all"
                style={{
                  background: "#071525",
                  border: digit ? "2px solid #22d3ee" : "1px solid #1e3a5f",
                  color: "#22d3ee",
                  caretColor: "#22d3ee"
                }}
              />
            ))}
          </div>

          {/* Error / Success */}
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm text-red-300 mb-4 text-center"
                 style={{ background: "#ef444422", border: "1px solid #ef444444" }} dir="rtl">
              {error}
            </div>
          )}
          {success && (
            <div className="px-4 py-3 rounded-xl text-sm text-green-300 mb-4 text-center"
                 style={{ background: "#10b98122", border: "1px solid #10b98144" }} dir="rtl">
              {success}
            </div>
          )}

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={loading || otp.join("").length < 6}
            className="w-full py-3 rounded-xl font-bold text-black transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#22d3ee,#10b981)" }}
          >
            {loading ? "جارٍ التحقق..." : "تأكيد الكود"}
          </button>

          {/* Resend */}
          <div className="text-center mt-5" dir="rtl">
            <p className="text-sm" style={{ color: "#64748b" }}>
              لم يصلك الكود؟{" "}
              <button
                onClick={handleResend}
                disabled={resendTimer > 0}
                className="font-medium transition-all"
                style={{ color: resendTimer > 0 ? "#334155" : "#22d3ee", cursor: resendTimer > 0 ? "default" : "pointer" }}
              >
                {resendTimer > 0 ? `إعادة الإرسال (${resendTimer}s)` : "إعادة الإرسال"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
