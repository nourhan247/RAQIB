using Microsoft.AspNetCore.Hosting;
using RAQIB.Core.Interfaces;

namespace RAQIB.Infrastructure.Services;

public class ImageStorageService : IImageStorageService
{
    private readonly string _uploadsPath;

    public ImageStorageService(IWebHostEnvironment env)
    {
        // لو wwwroot مش موجود اعمله
        if (!Directory.Exists(env.WebRootPath))
        {
            Directory.CreateDirectory(env.WebRootPath);
        }

        _uploadsPath = Path.Combine(env.WebRootPath, "uploads");

        if (!Directory.Exists(_uploadsPath))
        {
            Directory.CreateDirectory(_uploadsPath);
        }
    }

    public async Task<string> SaveImageAsync(Stream imageStream, string fileName)
    {
        var extension = Path.GetExtension(fileName);

        var newFileName = $"{Guid.NewGuid()}{extension}";

        var fullPath = Path.Combine(_uploadsPath, newFileName);

        using var fileStream = new FileStream(fullPath, FileMode.Create);

        await imageStream.CopyToAsync(fileStream);

        return $"/uploads/{newFileName}";
    }

    public void DeleteImage(string imagePath)
    {
        var fileName = Path.GetFileName(imagePath);

        var fullPath = Path.Combine(_uploadsPath, fileName);

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }
}