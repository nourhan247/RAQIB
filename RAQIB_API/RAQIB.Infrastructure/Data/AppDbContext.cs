using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RAQIB.Core.Models;

namespace RAQIB.Infrastructure.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Report> Reports => Set<Report>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Report>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.ImagePath).IsRequired();
            e.Property(r => r.Message).HasMaxLength(2000);
            e.Property(r => r.PredictedClass).HasMaxLength(100);
            e.Property(r => r.SeverityLabel).HasMaxLength(50);
            e.Property(r => r.AiReply).HasMaxLength(4000);
            e.Property(r => r.Address).HasMaxLength(500);
            e.Property(r => r.Latitude).HasColumnType("decimal(10,7)");
            e.Property(r => r.Longitude).HasColumnType("decimal(10,7)");
            e.Property(r => r.Confidence).HasColumnType("decimal(5,4)");

            e.HasOne(r => r.User)
             .WithMany(u => u.Reports)
             .HasForeignKey(r => r.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            // Index على الـ location للـ geo queries
            e.HasIndex(r => new { r.Latitude, r.Longitude });
            e.HasIndex(r => r.CreatedAt);
            e.HasIndex(r => r.SeverityScore);
        });

        builder.Entity<ApplicationUser>(e =>
        {
            e.Property(u => u.FullName).HasMaxLength(200);
        });
    }
}
