using RAQIB.Core.Interfaces;

namespace RAQIB.Infrastructure.Services;

public class ImageStorageService : IImageStorageService
{
    private readonly string _uploadsPath;

    public ImageStorageService() {}

    public async Task<string> SaveImageAsync(Stream imageStream, string fileName)
    {
        var ext      = Path.GetExtension(fileName).ToLowerInvariant();
        var safeName = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(_uploadsPath, safeName);

        using var fs = new FileStream(fullPath, FileMode.Create);
        await imageStream.CopyToAsync(fs);

        return $"/uploads/{safeName}";   // relative URL
    }

    public void DeleteImage(string imagePath)
    {
        var fullPath = Path.Combine(_uploadsPath, Path.GetFileName(imagePath));
        if (File.Exists(fullPath)) File.Delete(fullPath);
    }
}
