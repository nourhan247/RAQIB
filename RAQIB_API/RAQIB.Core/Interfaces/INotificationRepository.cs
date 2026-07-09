using RAQIB.Core.Models;

namespace RAQIB.Core.Interfaces;

public interface INotificationRepository
{
    Task<Notification> CreateAsync(Notification notification);
    Task<IEnumerable<Notification>> GetByUserIdAsync(string userId, int take = 50);
    Task<int> GetUnreadCountAsync(string userId);
    Task<bool> MarkAsReadAsync(int id, string userId);
    Task MarkAllAsReadAsync(string userId);
}