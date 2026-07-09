using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using RAQIB.Core.DTOs;
using RAQIB.Core.Interfaces;
using RAQIB.Core.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace RAQIB.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly SignInManager<ApplicationUser> _signIn;
    private readonly IConfiguration _config;
    private readonly IEmailService _email;
    private readonly IMemoryCache _cache;

    public AuthController(
        UserManager<ApplicationUser> users,
        SignInManager<ApplicationUser> signIn,
        IConfiguration config,
        IEmailService email,
        IMemoryCache cache)
    {
        _users  = users;
        _signIn = signIn;
        _config = config;
        _email  = email;
        _cache  = cache;
    }

    // ── Register ─────────────────────────────────────────────
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        Console.WriteLine("========== REGISTER ==========");
        Console.WriteLine($"Email: {dto.Email}");
        Console.WriteLine($"Full Name: {dto.FullName}");
        Console.WriteLine("==============================");
        var existing = await _users.FindByEmailAsync(dto.Email);

        Console.WriteLine(existing == null
            ? "User NOT found"
            : $"User FOUND: {existing.Email}");

        if (existing != null)
            return BadRequest(new[] { "البريد الإلكتروني مستخدم بالفعل" });

        var user = new ApplicationUser
        {
            FullName = dto.FullName,
            Email    = dto.Email,
            UserName = dto.Email,
        };

        var result = await _users.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
            return BadRequest(result.Errors.Select(e => e.Description));

        await _users.AddToRoleAsync(user, "User");

        // ── توليد OTP 6 أرقام ──
        var otp     = new Random().Next(100000, 999999).ToString();
        var cacheKey = $"otp_{user.Id}";

        // احتفظ بالـ OTP في الـ cache لمدة 10 دقايق
        _cache.Set(cacheKey, otp, TimeSpan.FromMinutes(10));

        // ابعت الإيميل
        await _email.SendOtpEmailAsync(dto.Email, dto.FullName, otp);

        return Ok(new { message = "تم إنشاء الحساب. تحقق من بريدك الإلكتروني للحصول على الكود.", userId = user.Id });
    }

    // ── Verify OTP ───────────────────────────────────────────
    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpDto dto)
    {
        var user = await _users.FindByIdAsync(dto.UserId);
        if (user == null)
            return BadRequest("مستخدم غير موجود");

        var cacheKey = $"otp_{user.Id}";

        if (!_cache.TryGetValue(cacheKey, out string? savedOtp))
            return BadRequest("انتهت صلاحية الكود، اطلب كوداً جديداً");

        if (savedOtp != dto.Otp)
            return BadRequest("الكود غير صحيح");

        // تأكيد الإيميل
        user.EmailConfirmed = true;
        await _users.UpdateAsync(user);

        // احذف الـ OTP من الـ cache
        _cache.Remove(cacheKey);

        return Ok(new { message = "تم تأكيد البريد الإلكتروني بنجاح" });
    }

    // ── Resend OTP ───────────────────────────────────────────
    [HttpPost("resend-otp")]
    public async Task<IActionResult> ResendOtp([FromBody] ResendOtpDto dto)
    {
        var user = await _users.FindByEmailAsync(dto.Email);
        if (user == null)
            return BadRequest("البريد الإلكتروني غير موجود");

        if (user.EmailConfirmed)
            return BadRequest("البريد الإلكتروني مؤكد بالفعل");

        var otp      = new Random().Next(100000, 999999).ToString();
        var cacheKey = $"otp_{user.Id}";
        _cache.Set(cacheKey, otp, TimeSpan.FromMinutes(10));

        await _email.SendOtpEmailAsync(dto.Email, user.FullName, otp);

        return Ok(new { message = "تم إرسال كود جديد", userId = user.Id });
    }

    // ── Login ────────────────────────────────────────────────
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var user = await _users.FindByEmailAsync(dto.Email);
        if (user == null)
            return Unauthorized("بيانات غير صحيحة");

        if (!user.EmailConfirmed)
            return Unauthorized(new { message = "يرجى تأكيد البريد الإلكتروني أولاً", needsVerification = true, userId = user.Id });

        if (!user.IsActive)
            return Unauthorized("الحساب غير مفعل");

        var result = await _signIn.CheckPasswordSignInAsync(user, dto.Password, false);
        if (!result.Succeeded)
            return Unauthorized("بيانات غير صحيحة");

        var roles = await _users.GetRolesAsync(user);
        var token = GenerateJwt(user, roles);

        return Ok(new AuthResultDto(
            token,
            user.Id,
            user.FullName,
            roles.FirstOrDefault() ?? "User",
            DateTime.UtcNow.AddDays(7)
        ));
    }

    // ── JWT Generator ────────────────────────────────────────
    private string GenerateJwt(ApplicationUser user, IList<string> roles)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email!),
            new(ClaimTypes.Name, user.FullName),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var token = new JwtSecurityToken(
            issuer:             _config["Jwt:Issuer"],
            audience:           _config["Jwt:Audience"],
            claims:             claims,
            expires:            DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
