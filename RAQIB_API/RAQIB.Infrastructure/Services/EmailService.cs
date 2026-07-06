using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using RAQIB.Core.Interfaces;
using RAQIB.Core.Models;
using Microsoft.Extensions.Configuration;

namespace RAQIB.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;

    public EmailService(IConfiguration config) => _config = config;

    // ── OTP Email ─────────────────────────────────────────────
    public async Task SendOtpEmailAsync(string toEmail, string fullName, string otp)
    {
        var body = $"""
            <div style="font-family:Arial;direction:rtl;padding:32px;background:#0f172a;color:#fff;border-radius:16px;max-width:480px;margin:auto">
              <div style="text-align:center;margin-bottom:24px">
                <span style="font-size:40px">🌿</span>
                <h1 style="background:linear-gradient(135deg,#22d3ee,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:8px 0">
                  RAQIB
                </h1>
              </div>

              <h2 style="color:#e2e8f0;margin-bottom:8px">مرحباً {fullName} 👋</h2>
              <p style="color:#94a3b8;margin-bottom:24px">
                أدخل الكود التالي لتأكيد بريدك الإلكتروني. صلاحيته 10 دقائق.
              </p>

              <div style="background:#1e3a5f;border:1px solid #22d3ee33;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
                <span style="font-size:42px;font-weight:bold;letter-spacing:12px;color:#22d3ee;font-family:monospace">
                  {otp}
                </span>
              </div>

              <p style="color:#64748b;font-size:13px;text-align:center">
                إذا لم تقم بإنشاء هذا الحساب يمكنك تجاهل هذه الرسالة.
              </p>
            </div>
            """;

        await SendAsync(toEmail, "كود تأكيد RAQIB — " + otp, body);
    }

    // ── High Severity Alert ───────────────────────────────────
    public async Task SendHighSeverityAlertAsync(Report report, string adminEmail)
    {
        var body = $"""
            <div style="font-family:Arial;direction:rtl;padding:20px;background:#0f172a;color:#fff;border-radius:12px">
              <h2 style="color:#ef4444">🚨 تنبيه بلاغ عالي الخطورة</h2>
              <table style="width:100%;border-collapse:collapse;margin-top:16px">
                <tr><td style="padding:8px;color:#94a3b8">التصنيف</td>
                    <td style="padding:8px;font-weight:bold;color:#f97316">{report.PredictedClass}</td></tr>
                <tr><td style="padding:8px;color:#94a3b8">درجة الخطورة</td>
                    <td style="padding:8px;font-weight:bold;color:#ef4444">{report.SeverityLabel}</td></tr>
                <tr><td style="padding:8px;color:#94a3b8">الموقع</td>
                    <td style="padding:8px">{report.Address ?? $"{report.Latitude}, {report.Longitude}"}</td></tr>
                <tr><td style="padding:8px;color:#94a3b8">رسالة المستخدم</td>
                    <td style="padding:8px">{report.Message}</td></tr>
                <tr><td style="padding:8px;color:#94a3b8">الوقت</td>
                    <td style="padding:8px">{report.CreatedAt:yyyy-MM-dd HH:mm} UTC</td></tr>
              </table>
            </div>
            """;

        await SendAsync(adminEmail, "🚨 RAQIB — تنبيه بلاغ عالي الخطورة", body);
    }

    // ── Send ─────────────────────────────────────────────────
    private async Task SendAsync(string to, string subject, string htmlBody)
    {
        try
        {
            var msg = new MimeMessage();
            msg.From.Add(new MailboxAddress("RAQIB", _config["Email:From"]));
            msg.To.Add(new MailboxAddress("", to));
            msg.Subject = subject;
            msg.Body    = new TextPart("html") { Text = htmlBody };

            using var smtp = new SmtpClient();

            // ← أضف السطر ده عشان يتجاهل الـ SSL certificate validation
            smtp.ServerCertificateValidationCallback = (s, c, h, e) => true;

            await smtp.ConnectAsync(
                _config["Email:Host"],
                int.Parse(_config["Email:Port"]!),
                SecureSocketOptions.StartTls);
            await smtp.AuthenticateAsync(_config["Email:User"], _config["Email:Pass"]);
            await smtp.SendAsync(msg);
            await smtp.DisconnectAsync(true);

            Console.WriteLine($"✓ Email sent to {to}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"✗ Email error: {ex.Message}");
            throw;
        }
    }
}
