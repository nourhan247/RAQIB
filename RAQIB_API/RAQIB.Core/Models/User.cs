using Microsoft.AspNetCore.Identity;
namespace RAQIB.Core.Models;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public ICollection<Report> Reports { get; set; } = new List<Report>();
}
