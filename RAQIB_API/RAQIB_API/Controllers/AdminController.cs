using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using RAQIB.Core.Interfaces;
using RAQIB.Core.Models;

namespace RAQIB.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly IReportRepository _repo;
    private readonly UserManager<ApplicationUser> _users;

    public AdminController(IReportRepository repo, UserManager<ApplicationUser> users)
    {
        _repo = repo;
        _users = users;
    }

    // GET /api/admin/dashboard
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard()
    {
        var stats = await _repo.GetDashboardStatsAsync();
        return Ok(stats);
    }

    // GET /api/admin/reports
    [HttpGet("reports")]
    public async Task<IActionResult> AllReports()
    {
        var reports = await _repo.GetAllAsync();
        return Ok(reports.Select(r => new
        {
            r.Id,
            r.ImagePath,
            r.Message,
            r.Latitude,
            r.Longitude,
            r.Governorate,
            r.Area,
            r.Street,
            r.Address,
            r.PredictedClass,
            r.SeverityLabel,
            r.SeverityScore,
            r.Confidence,
            r.DamagePercentage,
            r.AiSeverityScore,
            r.AiReply,
            Status = r.Status.ToString(),
            r.CreatedAt,
            r.ResolvedAt,
            UserName = r.User?.FullName,
            UserEmail = r.User?.Email,
            UserId = r.UserId,
        }));
    }

    // GET /api/admin/users
    [HttpGet("users")]
    public async Task<IActionResult> AllUsers()
    {
        var users = _users.Users.Select(u => new
        {
            u.Id,
            u.FullName,
            u.Email,
            u.CreatedAt,
            u.IsActive,
            ReportCount = u.Reports.Count
        }).ToList();
        return Ok(users);
    }

    // PATCH /api/admin/users/{id}/toggle
    [HttpPatch("users/{id}/toggle")]
    public async Task<IActionResult> ToggleUser(string id)
    {
        var user = await _users.FindByIdAsync(id);
        if (user == null) return NotFound();
        user.IsActive = !user.IsActive;
        await _users.UpdateAsync(user);
        return Ok(new { user.IsActive });
    }
}