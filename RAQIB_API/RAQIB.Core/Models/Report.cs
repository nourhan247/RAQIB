namespace RAQIB.Core.Models;

public class Report
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    // User input
    public string ImagePath { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? Address { get; set; }

    // AI result
    public string? PredictedClass { get; set; }
    public string? SeverityLabel { get; set; }
    public int SeverityScore { get; set; }         // 0=none 1=low 2=medium 3=high
    public double Confidence { get; set; }
    public string? AiReply { get; set; }

    // Meta
    public ReportStatus Status { get; set; } = ReportStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
}

public enum ReportStatus
{
    Pending,
    InProgress,
    Resolved,
    Rejected
}
