namespace RAQIB.Core.DTOs;

// ── Auth ─────────────────────────────────────────
public record RegisterDto(string FullName, string Email, string Password);
public record LoginDto(string Email, string Password);
public record AuthResultDto(string Token, string UserId, string FullName, string Role, DateTime Expires);

// ── Report ───────────────────────────────────────
public record CreateReportDto(
    string Message,
    double Latitude,
    double Longitude,
    string? Address
);

public record ReportResponseDto(
    int Id,
    string UserName,
    string ImagePath,
    string Message,
    double Latitude,
    double Longitude,
    string? Address,
    string? PredictedClass,
    string? SeverityLabel,
    int SeverityScore,
    double Confidence,
    string? AiReply,
    string Status,
    DateTime CreatedAt
);

// ── AI Agent ─────────────────────────────────────
public record AiPredictionDto(
    string PredictedClass,
    string SeverityLabel,
    int SeverityScore,
    double Confidence,
    string AiReply,
    Dictionary<string, double> AllProbs
);

// ── Map ──────────────────────────────────────────
public record MapPointDto(
    int ReportId,
    double Latitude,
    double Longitude,
    string PredictedClass,
    string SeverityLabel,
    int SeverityScore,
    int CountInArea,      // عدد البلاغات في نفس المنطقة — يحدد حجم الدائرة
    DateTime CreatedAt
);

// ── Dashboard (Admin) ─────────────────────────────
public record DashboardStatsDto(
    int TotalReports,
    int PendingReports,
    int ResolvedReports,
    int HighSeverityReports,
    Dictionary<string, int> CountByClass,
    Dictionary<string, int> CountByDay     // آخر 7 أيام
);
