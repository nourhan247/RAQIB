using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace RAQIB.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    // Admin فقط يجوين group "admins"
    public override async Task OnConnectedAsync()
    {
        if (Context.User?.IsInRole("Admin") == true)
            await Groups.AddToGroupAsync(Context.ConnectionId, "admins");

        await base.OnConnectedAsync();
    }
}

// Helper service لإرسال notifications من أي مكان
public class NotificationService
{
    private readonly IHubContext<NotificationHub> _hub;

    public NotificationService(IHubContext<NotificationHub> hub) => _hub = hub;

    // بيبعت لليوزر المحدد رد الـ AI
    public async Task SendAiReplyAsync(string userId, object payload) =>
        await _hub.Clients.User(userId).SendAsync("AiReply", payload);

    // بيبعت للأدمن تنبيه بلاغ جديد
    public async Task SendNewReportAlertAsync(object payload) =>
        await _hub.Clients.Group("admins").SendAsync("NewReport", payload);

    // بيبعت للكل تحديث الخريطة
    public async Task BroadcastMapUpdateAsync(object mapPoint) =>
        await _hub.Clients.All.SendAsync("MapUpdate", mapPoint);

    // ── NEW: بيبعت لليوزر المحدد إشعار (يظهر في الـ notification bell) ──
    public async Task SendNotificationAsync(string userId, object payload) =>
        await _hub.Clients.User(userId).SendAsync("Notification", payload);
}
