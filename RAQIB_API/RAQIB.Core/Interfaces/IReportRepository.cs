using RAQIB.Core.DTOs;
using RAQIB.Core.Models;

namespace RAQIB.Core.Interfaces;

public interface IReportRepository
{
    Task<Report> CreateAsync(Report report);
    Task<Report?> GetByIdAsync(int id);
    Task<IEnumerable<Report>> GetByUserIdAsync(string userId);
    Task<IEnumerable<Report>> GetAllAsync();
    Task<IEnumerable<MapPointDto>> GetMapPointsAsync();
    Task<DashboardStatsDto> GetDashboardStatsAsync();
    Task UpdateAsync(Report report);
    Task<int> GetReportCountInAreaAsync(double lat, double lng, double radiusKm = 0.5);
}

public interface IAiAgentService
{
    Task<AiPredictionDto> PredictAsync(Stream imageStream, string fileName);
}

public interface IEmailService
{
    Task SendHighSeverityAlertAsync(Report report, string adminEmail);
    Task SendWelcomeEmailAsync(
    string toEmail,
    string fullName,
    string confirmLink);
}

public interface IImageStorageService
{
    Task<string> SaveImageAsync(Stream imageStream, string fileName);
    void DeleteImage(string imagePath);
}
