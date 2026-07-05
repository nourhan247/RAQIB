using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RAQIB.API.Hubs;
using RAQIB.Core.DTOs;
using RAQIB.Core.Interfaces;
using RAQIB.Core.Models;

namespace RAQIB.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportRepository   _repo;
    private readonly IAiAgentService     _ai;
    private readonly IImageStorageService _storage;
    private readonly IEmailService       _email;
    private readonly NotificationService _notify;
    private readonly IConfiguration      _config;

    public ReportsController(
        IReportRepository repo, IAiAgentService ai,
        IImageStorageService storage, IEmailService email,
        NotificationService notify, IConfiguration config)
    {
        _repo    = repo;
        _ai      = ai;
        _storage = storage;
        _email   = email;
        _notify  = notify;
        _config  = config;
    }

    // POST /api/reports  — اليوزر يرفع صورة + رسالة + موقع
    [HttpPost]
    public async Task<IActionResult> Create([FromForm] CreateReportDto dto, IFormFile image)
    {
        if (image == null || image.Length == 0)
            return BadRequest("الصورة مطلوبة");

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp" };
        if (!allowedTypes.Contains(image.ContentType))
            return BadRequest("نوع الصورة غير مدعوم");

        if (image.Length > 10 * 1024 * 1024)
            return BadRequest("حجم الصورة يتجاوز 10MB");

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        // 1. حفظ الصورة
        using var stream   = image.OpenReadStream();
        var imagePath = await _storage.SaveImageAsync(stream, image.FileName);

        // 2. إرسال للـ AI Agent
        stream.Position = 0;
        AiPredictionDto prediction;
        try
        {
            using var aiStream = image.OpenReadStream();
            prediction = await _ai.PredictAsync(aiStream, image.FileName);
        }
        catch
        {
            prediction = new AiPredictionDto(
                "UNKNOWN", "غير معروف", 0, 0,
                "تعذر تحليل الصورة حالياً، سيتم المراجعة يدوياً.", new());
        }

        // 3. حفظ في DB
        var report = new Report
        {
            UserId         = userId,
            ImagePath      = imagePath,
            Message        = dto.Message,
            Latitude       = dto.Latitude,
            Longitude      = dto.Longitude,
            Address        = dto.Address,
            PredictedClass = prediction.PredictedClass,
            SeverityLabel  = prediction.SeverityLabel,
            SeverityScore  = prediction.SeverityScore,
            Confidence     = prediction.Confidence,
            AiReply        = prediction.AiReply,
        };

        await _repo.CreateAsync(report);

        // 4. رد فوري على اليوزر عبر SignalR
        var replyPayload = new
        {
            reportId       = report.Id,
            predictedClass = prediction.PredictedClass,
            severityLabel  = prediction.SeverityLabel,
            severityScore  = prediction.SeverityScore,
            confidence     = prediction.Confidence,
            aiReply        = prediction.AiReply,
            imagePath,
        };
        await _notify.SendAiReplyAsync(userId, replyPayload);

        // 5. تحديث الخريطة للكل
        await _notify.BroadcastMapUpdateAsync(new
        {
            report.Id, report.Latitude, report.Longitude,
            prediction.PredictedClass, prediction.SeverityLabel,
            prediction.SeverityScore, report.CreatedAt
        });

        // 6. تنبيه الأدمن لو خطورة عالية
        if (prediction.SeverityScore >= 3)
        {
            await _notify.SendNewReportAlertAsync(replyPayload);
            var adminEmail = _config["AdminEmail"]!;
            _ = Task.Run(() => _email.SendHighSeverityAlertAsync(report, adminEmail));
        }

        return Ok(MapToDto(report));
    }

    // GET /api/reports/my
    [HttpGet("my")]
    public async Task<IActionResult> GetMy()
    {
        var userId  = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var reports = await _repo.GetByUserIdAsync(userId);
        return Ok(reports.Select(MapToDto));
    }

    // GET /api/reports/map  — للخريطة (كل اليوزرز يشوفوها)
    [HttpGet("map")]
    public async Task<IActionResult> GetMapPoints()
    {
        var points = await _repo.GetMapPointsAsync();
        return Ok(points);
    }

    // GET /api/reports/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var report = await _repo.GetByIdAsync(id);
        if (report == null) return NotFound();

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var isAdmin = User.IsInRole("Admin");
        if (!isAdmin && report.UserId != userId)
            return Forbid();

        return Ok(MapToDto(report));
    }

    // PATCH /api/reports/{id}/status  — Admin فقط
    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] string status)
    {
        var report = await _repo.GetByIdAsync(id);
        if (report == null) return NotFound();

        if (Enum.TryParse<ReportStatus>(status, out var parsed))
        {
            report.Status = parsed;
            if (parsed == ReportStatus.Resolved)
                report.ResolvedAt = DateTime.UtcNow;
            await _repo.UpdateAsync(report);
            return Ok();
        }
        return BadRequest("حالة غير صحيحة");
    }

    private static ReportResponseDto MapToDto(Report r) => new(
        r.Id, r.User?.FullName ?? "", r.ImagePath, r.Message,
        r.Latitude, r.Longitude, r.Address,
        r.PredictedClass, r.SeverityLabel, r.SeverityScore,
        r.Confidence, r.AiReply, r.Status.ToString(), r.CreatedAt
    );
}
